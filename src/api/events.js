/**
 * Sky conditions at an observer location.
 *
 * What is left of the old astronomy-events module. The calendar of eclipses,
 * conjunctions and meteor showers was removed; the solar and lunar state is
 * kept because the shell header and the dashboard both report whether the sky
 * at the active location is dark enough to observe.
 */

import { db } from '../mock/db.js';
import { moonPhase, sunLookAngles, skyCondition } from '../engine/sun.js';
import { gmstFor } from '../engine/propagate.js';
import { call, envelope } from './client.js';

export const events = {
  /** Sky conditions at an observer location now: the dashboard header strip. */
  skyNow(locationId) {
    return call(() => {
      const store = db();
      const location =
        store.locations.find((l) => l.id === locationId) ??
        store.locations.find((l) => l.isDefault) ??
        store.locations[0];

      const now = new Date();
      const sun = sunLookAngles(now, location, gmstFor(now));
      const moon = moonPhase(now);

      // Walk forward to the next time the sky crosses the darkness threshold.
      const threshold = store.settings.twilightThresholdDeg;
      let nextChangeAt = null;
      const currentlyDark = sun.elevation <= threshold;
      for (let m = 5; m <= 60 * 26; m += 5) {
        const t = new Date(now.getTime() + m * 60000);
        const e = sunLookAngles(t, location, gmstFor(t)).elevation;
        if (currentlyDark ? e > threshold : e <= threshold) {
          nextChangeAt = t.toISOString();
          break;
        }
      }

      return envelope(
        {
          location,
          sunElevation: sun.elevation,
          sunAzimuth: sun.azimuth,
          condition: skyCondition(sun.elevation),
          dark: currentlyDark,
          threshold,
          nextChangeAt,
          moon,
        },
        {
          source: 'engine',
          sourceLabel: 'Computed from the solar and lunar models',
          kind: 'computed',
          retrievedAt: now.toISOString(),
        },
      );
    }, { scale: 0.5 });
  },
};
