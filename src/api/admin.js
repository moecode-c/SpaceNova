/** Administration (SRS module 15). */

import { db, resetDb } from '../mock/db.js';
import { ROLES } from '../mock/people.js';
import { SOURCE_HEALTH, DEGRADED_MODE_RULES } from '../mock/ops.js';
import { call, envelope, ApiError, paginate, comparator, matchesQuery } from './client.js';

function audit(action, label, target, detail, tone = 'info') {
  const store = db();
  const actor = store.users.find((u) => u.role === 'admin') ?? store.users[0];
  store.auditLog.unshift({
    id: `al-${Date.now()}`,
    action,
    label,
    tone,
    actorId: actor.id,
    actorName: actor.name,
    target,
    detail,
    at: new Date().toISOString(),
    ip: '10.0.0.1',
  });
}

export const admin = {
  users(query = {}) {
    return call(() => {
      const store = db();
      const { q, role, status, sort = 'name', direction = 'asc', page = 1, pageSize = 15 } = query;
      let rows = store.users.filter(
        (u) =>
          matchesQuery(u, q, ['name', 'email', 'institution']) &&
          (!role || role.length === 0 || role.includes(u.role)) &&
          (!status || status.length === 0 || status.includes(u.status)),
      );
      rows = rows.sort(comparator(sort, direction));
      return envelope(paginate(rows, { page, pageSize }), {
        source: 'fixture-people',
        sourceLabel: 'Account register',
        roles: Object.values(ROLES).filter((r) => r.key !== 'guest'),
      });
    });
  },

  updateUser(userId, patch) {
    return call(() => {
      const user = db().users.find((u) => u.id === userId);
      if (!user) throw new ApiError('Account not found.', { status: 404, code: 'not_found' });
      const before = { role: user.role, status: user.status };
      Object.assign(user, patch);
      if (patch.role) {
        user.roleLabel = ROLES[patch.role].label;
        audit('user.role', 'Changed an account role', user.email,
          `Role changed from ${before.role} to ${patch.role}.`);
      }
      if (patch.status && patch.status !== before.status) {
        audit(
          patch.status === 'suspended' ? 'user.suspend' : 'user.reinstate',
          patch.status === 'suspended' ? 'Suspended an account' : 'Reinstated an account',
          user.email,
          `Status changed from ${before.status} to ${patch.status}.`,
          patch.status === 'suspended' ? 'bad' : 'good',
        );
      }
      return envelope(user, { source: 'fixture-people' });
    });
  },

  dataSources() {
    return call(() => {
      const store = db();
      return envelope(
        {
          sources: store.dataSources,
          health: SOURCE_HEALTH,
          degradedModeRules: DEGRADED_MODE_RULES,
          degradedModeLimitHours: store.settings.degradedModeLimitHours,
          summary: {
            nominal: store.dataSources.filter((s) => s.health === 'nominal').length,
            degraded: store.dataSources.filter((s) => s.health === 'degraded' || s.health === 'rate-limited').length,
            offline: store.dataSources.filter((s) => s.health === 'offline').length,
            servingFromCache: store.dataSources.filter((s) => s.servingFromCache).length,
          },
        },
        { source: 'fixture-ops', sourceLabel: 'Ingestion health' },
      );
    });
  },

  toggleSource(sourceId, enabled) {
    return call(() => {
      const source = db().dataSources.find((s) => s.id === sourceId);
      if (!source) throw new ApiError('Data source not found.', { status: 404, code: 'not_found' });
      source.enabled = enabled;
      audit(
        enabled ? 'source.enable' : 'source.disable',
        enabled ? 'Enabled a data source' : 'Disabled a data source',
        source.name,
        enabled ? 'Re-enabled after provider confirmation.' : 'Disabled pending provider confirmation.',
        enabled ? 'good' : 'warn',
      );
      return envelope(source, { source: 'fixture-ops' });
    }, { scale: 0.6 });
  },

  runIngest(sourceId) {
    return call(() => {
      const source = db().dataSources.find((s) => s.id === sourceId);
      if (!source) throw new ApiError('Data source not found.', { status: 404, code: 'not_found' });
      if (!source.enabled) {
        throw new ApiError('Enable the source before running it.', { status: 409, code: 'disabled' });
      }
      if (source.health === 'offline') {
        source.lastAttemptAt = new Date().toISOString();
        source.failuresLastDay += 1;
        audit('ingest.run', 'Ran an ingestion job manually', source.name,
          'Attempt failed: provider unreachable. Degraded mode continues.', 'warn');
        throw new ApiError(
          'The provider is unreachable. Degraded mode is still serving cached data.',
          { status: 503, code: 'upstream_unavailable' },
        );
      }
      const now = new Date();
      source.lastAttemptAt = now.toISOString();
      source.lastSuccessAt = now.toISOString();
      source.cacheAgeMinutes = 0;
      source.servingFromCache = false;
      source.health = 'nominal';
      source.healthLabel = SOURCE_HEALTH.nominal.label;
      source.healthTone = SOURCE_HEALTH.nominal.tone;
      source.nextRefreshAt = new Date(now.getTime() + source.ttlMinutes * 60000).toISOString();
      audit('ingest.run', 'Ran an ingestion job manually', source.name, 'Fetch validated and stored.');
      return envelope(source, { source: 'fixture-ops' });
    }, { scale: 1.6 });
  },

  purgeCache(sourceId) {
    return call(() => {
      const source = db().dataSources.find((s) => s.id === sourceId);
      if (!source) throw new ApiError('Data source not found.', { status: 404, code: 'not_found' });
      source.recordsStored = 0;
      source.cacheAgeMinutes = 0;
      source.servingFromCache = false;
      audit('cache.purge', 'Purged a source cache', source.name,
        'Cache cleared. The next scheduled run repopulates it.', 'warn');
      return envelope(source, { source: 'fixture-ops' });
    });
  },

  settings() {
    return call(() => {
      const store = db();
      return envelope(store.settings, {
        source: 'fixture-ops',
        sourceLabel: 'Global thresholds',
        note: 'Thresholds are stored as data. Changing one here changes every later computation without a rebuild.',
      });
    }, { scale: 0.4 });
  },

  updateSettings(patch) {
    return call(() => {
      const store = db();
      const changes = [];
      for (const [key, value] of Object.entries(patch)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Record the nested keys that actually differ. Listing the whole
          // group every time would make the audit log claim changes that were
          // never made.
          const merged = { ...store.settings[key], ...value };
          for (const [sub, next] of Object.entries(value)) {
            if (store.settings[key]?.[sub] !== next) {
              changes.push(`${key}.${sub}: ${store.settings[key]?.[sub]} to ${next}`);
            }
          }
          store.settings[key] = merged;
        } else if (store.settings[key] !== value) {
          changes.push(`${key}: ${store.settings[key]} to ${value}`);
          store.settings[key] = value;
        }
      }
      if (changes.length) {
        audit('threshold.update', 'Changed a global threshold', changes[0].split(':')[0],
          `Changed ${changes.join('; ')}.`);
      }
      return envelope(store.settings, { source: 'fixture-ops' });
    });
  },

  auditLog(query = {}) {
    return call(() => {
      const store = db();
      const { q, action, page = 1, pageSize = 20 } = query;
      let rows = store.auditLog.filter(
        (r) =>
          matchesQuery(r, q, ['label', 'actorName', 'target', 'detail']) &&
          (!action || action.length === 0 || action.includes(r.action)),
      );
      rows = rows.sort(comparator('at', 'desc'));
      return envelope(paginate(rows, { page, pageSize }), {
        source: 'fixture-ops',
        sourceLabel: 'Audit log (append only)',
        actions: [...new Set(store.auditLog.map((r) => r.action))].sort(),
      });
    });
  },

  catalogue(query = {}) {
    return call(() => {
      const store = db();
      const { q, page = 1, pageSize = 15, sort = 'name', direction = 'asc' } = query;
      let rows = store.objects.filter((o) =>
        matchesQuery({ ...o, noradId: String(o.noradId) }, q, ['name', 'intlDes', 'operator', 'noradId']),
      );
      rows = rows.sort(comparator(sort, direction));
      return envelope(paginate(rows, { page, pageSize }), {
        source: 'fixture-catalogue',
        sourceLabel: 'Catalogue administration',
      });
    });
  },

  updateObject(objectId, patch) {
    return call(() => {
      const object = db().objectsById.get(objectId);
      if (!object) throw new ApiError('Object not found.', { status: 404, code: 'not_found' });
      Object.assign(object, patch);
      audit('catalog.edit', 'Edited a catalogue record', object.name,
        `Fields changed: ${Object.keys(patch).join(', ')}.`);
      return envelope(object, { source: 'fixture-catalogue' });
    });
  },

  /** Rebuild every fixture from its seed. Useful while reviewing the build. */
  resetFixtures() {
    return call(() => {
      resetDb();
      return envelope({ reset: true }, { source: 'fixture' });
    }, { scale: 1.2 });
  },
};
