/**
 * Space weather indices.
 *
 * No longer a screen of its own. The figures stay because the decay model in
 * engine/decay.js scales atmospheric density from F10.7 and Kp, and the
 * dashboard reports the current geomagnetic state in a single tile.
 */

import { db } from '../mock/db.js';
import { call, envelope } from './client.js';

export const spaceWeather = {
  /** The headline values, for the dashboard tile and the public banner. */
  summary() {
    return call(() => {
      const store = db();
      const weather = store.spaceWeather;
      return envelope(
        {
          updatedAt: weather.updatedAt,
          kp: weather.current.kp,
          kpBand: weather.current.kpBand,
          solarWindSpeedKms: weather.current.solarWindSpeedKms,
          bzNt: weather.current.bzNt,
          xrayClass: weather.current.xrayClass,
          f107: weather.current.f107,
          auroraProbability: weather.current.auroraProbability,
          latestFlare: weather.flares[0] ?? null,
          nextOutlook: weather.outlook[0] ?? null,
        },
        {
          source: 'fixture-swpc',
          sourceLabel: 'Space weather provider (fixture)',
          retrievedAt: weather.updatedAt,
        },
      );
    }, { scale: 0.5 });
  },
};
