/**
 * Launch schedule.
 *
 * The separate mission register was removed; a launch record carries its own
 * payload, destination and provider, which is what every screen asked of it.
 */

import { db } from '../mock/db.js';
import { call, envelope, ApiError, paginate, comparator, matchesQuery } from './client.js';

export const launches = {
  list(query = {}) {
    return call(() => {
      const store = db();
      const {
        q, provider, statusKey, upcoming, payloadKind,
        sort = 'net', direction = 'asc', page = 1, pageSize = 20,
      } = query;

      let rows = store.launches.filter(
        (l) =>
          matchesQuery(l, q, ['name', 'payloadName', 'provider', 'vehicle', 'padLocation', 'destination']) &&
          (!provider || provider.length === 0 || provider.includes(l.provider)) &&
          (!statusKey || statusKey.length === 0 || statusKey.includes(l.statusKey)) &&
          (!payloadKind || payloadKind.length === 0 || payloadKind.includes(l.payloadKind)) &&
          (upcoming === undefined || l.upcoming === upcoming),
      );

      rows = rows.sort(comparator(sort, direction));

      return envelope(paginate(rows, { page, pageSize }), {
        source: 'fixture-launch-library',
        sourceLabel: 'Launch schedule provider (fixture)',
        retrievedAt: store.builtAt.toISOString(),
        providers: [...new Set(store.launches.map((l) => l.provider))].sort(),
        statuses: [...new Set(store.launches.map((l) => l.statusKey))],
      });
    });
  },

  next(count = 4) {
    return call(() => {
      const rows = db()
        .launches.filter((l) => l.upcoming)
        .slice(0, count);
      return envelope(rows, {
        source: 'fixture-launch-library',
        sourceLabel: 'Launch schedule provider (fixture)',
      });
    }, { scale: 0.5 });
  },

  get(launchId) {
    return call(() => {
      const store = db();
      const launch = store.launches.find((l) => l.id === launchId);
      if (!launch) throw new ApiError('Launch not found.', { status: 404, code: 'not_found' });
      return envelope({ launch }, { source: 'fixture-launch-library' });
    });
  },
};
