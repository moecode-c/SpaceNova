/**
 * Data sources, ingestion health and the audit log.
 * Phase 1 fixtures for SRS modules 13 and 15.
 */

import { rng, slug, clamp } from '../lib/random.js';

const SOURCE_SEED = [
  ['Celestrak GP', 'element-sets', 'https://celestrak.org/NORAD/elements/gp.php', 'Open, attribution requested', 360, 1000, 'nominal'],
  ['Space-Track', 'element-sets', 'https://www.space-track.org/basicspacedata', 'Account and user agreement required; redistribution restricted', 720, 300, 'rate-limited'],
  ['Launch Library', 'launches', 'https://ll.thespacedevs.com/2.2.0/launch', 'Open, attribution required', 60, 15, 'nominal'],
  ['NOAA SWPC', 'space-weather', 'https://services.swpc.noaa.gov/json', 'United States public domain', 15, 0, 'nominal'],
  ['NASA DONKI', 'space-weather', 'https://api.nasa.gov/DONKI', 'Open with an API key', 60, 1000, 'nominal'],
  ['Solar system ephemeris', 'events', 'https://ssd.jpl.nasa.gov/api/horizons.api', 'Open, attribution requested', 1440, 0, 'nominal'],
  ['Cloud cover forecast', 'weather', 'https://api.open-meteo.com/v1/forecast', 'Open for non-commercial use', 60, 10000, 'degraded'],
  ['SatNOGS DB', 'metadata', 'https://db.satnogs.org/api', 'Open, share-alike', 1440, 0, 'offline'],
];

export const SOURCE_HEALTH = {
  nominal: { label: 'Nominal', tone: 'good', description: 'Last fetch validated and stored.' },
  'rate-limited': { label: 'Rate limited', tone: 'warn', description: 'Backing off; serving cached data within its time to live.' },
  degraded: { label: 'Degraded', tone: 'warn', description: 'Partial responses. Affected fields fall back to cache.' },
  offline: { label: 'Offline', tone: 'bad', description: 'Unreachable. Degraded mode is serving the last known good data.' },
};

export function buildDataSources(now = new Date()) {
  return SOURCE_SEED.map(([name, kind, endpoint, licence, ttlMinutes, rateLimitPerHour, health]) => {
    const random = rng(`source-${name}`);
    const lastSuccess = new Date(
      now.getTime() - (health === 'offline' ? random.range(5, 34) * 3600000 : random.range(1, 50) * 60000),
    );
    return {
      id: slug(name),
      name,
      kind,
      endpoint,
      licence,
      ttlMinutes,
      rateLimitPerHour,
      health,
      healthLabel: SOURCE_HEALTH[health].label,
      healthTone: SOURCE_HEALTH[health].tone,
      lastSuccessAt: lastSuccess.toISOString(),
      lastAttemptAt: new Date(now.getTime() - random.range(0.5, 12) * 60000).toISOString(),
      nextRefreshAt: new Date(now.getTime() + random.range(2, ttlMinutes) * 60000).toISOString(),
      // Cache is stale once the age passes the time to live; degraded mode then
      // serves it with a banner up to the degraded-mode limit (SRS G.2).
      cacheAgeMinutes: Math.round((now.getTime() - lastSuccess.getTime()) / 60000),
      servingFromCache: health === 'offline' || health === 'rate-limited',
      recordsStored: random.int(420, 184000),
      requestsLastHour: random.int(2, Math.max(4, Math.round(rateLimitPerHour * 0.7)) || 40),
      failuresLastDay: health === 'nominal' ? random.int(0, 2) : random.int(4, 48),
      validationFailuresLastDay: random.int(0, health === 'degraded' ? 26 : 3),
      meanLatencyMs: random.int(90, 1800),
      enabled: health !== 'offline' ? true : true,
      notes:
        health === 'offline'
          ? 'Provider returned 503 on every attempt for the last five hours. Escalated; cache is inside the 48 hour degraded-mode limit.'
          : health === 'rate-limited'
            ? 'Hourly quota reached at 14:20. Backing off with jitter until the window resets.'
            : health === 'degraded'
              ? 'Cloud-cover fields missing beyond seven days. The pass score drops the cloud term and renormalises.'
              : null,
    };
  });
}

/** The condition/action rows of SRS Appendix G.2, as data for the screen. */
export const DEGRADED_MODE_RULES = [
  ['Source responds with valid data', 'Store the record with a provenance entry, reset the cache time to live, mark the source nominal.'],
  ['Source responds with data that fails validation', 'Reject the response, keep the previous cache entry, increment the validation failure counter, raise a source warning.'],
  ['Source times out', 'Retry twice with backoff, then serve cache and mark the source degraded.'],
  ['Source returns a rate-limit error', 'Stop requests until the quota window resets, serve cache, mark the source rate limited.'],
  ['Cached data within its time to live', 'Serve the cache silently. Panels show the data age as normal.'],
  ['Cached data past its time to live, inside the degraded-mode limit', 'Serve the cache with a visible staleness banner naming the source and the age.'],
  ['No cached data at all', 'Return no value. The panel shows an explicit unavailable state and the score drops the affected term.'],
];

/**
 * The administrative actions the audit log records.
 *
 * The keys match the ones api/admin.js writes when an administrator acts, so a
 * seeded entry and a live one are the same shape.
 */
const AUDIT_ACTIONS = [
  ['user.role', 'Changed an account role', 'info'],
  ['user.suspend', 'Suspended an account', 'bad'],
  ['user.reinstate', 'Reinstated an account', 'good'],
  ['source.enable', 'Enabled a data source', 'good'],
  ['source.disable', 'Disabled a data source', 'warn'],
  ['ingest.run', 'Ran an ingestion job manually', 'info'],
  ['cache.purge', 'Purged a source cache', 'warn'],
  ['threshold.update', 'Changed a global threshold', 'info'],
  ['catalog.edit', 'Edited a catalogue record', 'info'],
];

export function buildAuditLog(users, now = new Date()) {
  const random = rng('audit-v1');
  const admins = users.filter((u) => u.role === 'admin');
  return Array.from({ length: 44 }, (_, i) => {
    const [action, label, tone] = random.pick(AUDIT_ACTIONS);
    const actor = random.pick(admins);
    return {
      id: `al-${44 - i}`,
      action,
      label,
      tone,
      actorId: actor.id,
      actorName: actor.name,
      target: random.pick([
        'layla.haddad@example.org', 'Celestrak GP', 'minElevationDeg', 'ISS (ZARYA)',
        'Falcon 9 | Starlink Group 11-24', 'Pass Prediction Accuracy', 'NOAA SWPC',
        'twilightThresholdDeg', 'yusuf.demir@example.org',
      ]),
      detail: random.pick([
        'Changed from 10 to 12 degrees. Reason recorded: urban horizon obstruction.',
        'Affiliation verified against the institutional directory.',
        'Repeated 503 responses. Disabled pending provider confirmation.',
        'Cache purged after a validation failure run of 26 records.',
        'Record corrected: international designator had a transposed digit.',
        'Account suspended after a report of automated scraping.',
      ]),
      at: new Date(now.getTime() - (i * random.range(0.6, 7) + 0.2) * 3600000).toISOString(),
      ip: `${random.int(2, 220)}.${random.int(0, 255)}.${random.int(0, 255)}.${random.int(1, 254)}`,
    };
  });
}
