/**
 * Pass prediction and observation planning (SRS module 5).
 *
 * Prediction runs through the engine in src/engine, so the numbers on screen
 * are genuinely computed rather than stored. The response carries the
 * thresholds that were applied, because a window is only meaningful alongside
 * the minimum elevation and twilight threshold used to find it.
 */

import { db, cloudForecastFor } from '../mock/db.js';
import { satrecFor } from '../engine/propagate.js';
import { findPasses, passTrack } from '../engine/passes.js';
import { resolveConflicts } from '../engine/score.js';
import { freshnessOf } from '../engine/freshness.js';
import { call, envelope, ApiError } from './client.js';

function resolveObserver(locationId) {
  const store = db();
  const location =
    store.locations.find((l) => l.id === locationId) ??
    store.locations.find((l) => l.isDefault) ??
    store.locations[0];
  return {
    location,
    observer: {
      latitude: location.latitude,
      longitude: location.longitude,
      altitudeM: location.altitudeM,
      horizonMask: location.horizonMask,
    },
  };
}

function configFor(location, overrides = {}) {
  const store = db();
  return {
    ...store.settings,
    minElevationDeg: overrides.minElevationDeg ?? location.minElevationDeg ?? store.settings.minElevationDeg,
    twilightThresholdDeg: overrides.twilightThresholdDeg ?? store.settings.twilightThresholdDeg,
    requireIllumination: overrides.requireIllumination ?? store.settings.requireIllumination,
  };
}

export const passes = {
  /**
   * Predict passes for a set of objects over one observer location.
   *
   * @param {object} query
   * @param {string[]} query.objectIds
   * @param {string} [query.locationId]
   * @param {number} [query.hours]
   * @param {boolean} [query.visibleOnly]
   * @param {number} [query.minScore]
   * @param {object} [query.thresholds]
   */
  predict(query) {
    return call(() => {
      const { objectIds = [], locationId, hours = 72, visibleOnly = false, minScore = 0, thresholds } = query;
      const store = db();
      const { location, observer } = resolveObserver(locationId);
      const config = configFor(location, thresholds ?? {});
      const forecast = cloudForecastFor(location.id);
      const now = new Date();

      const refused = [];
      const all = [];

      for (const objectId of objectIds) {
        const object = store.objectsById.get(objectId);
        if (!object) continue;

        const freshness = freshnessOf(object.elementSet.epoch, now, config);
        if (!freshness.usable) {
          // SRS A.7: an expired element set is refused, and the refusal is
          // reported rather than silently dropped.
          refused.push({
            objectId: object.id,
            objectName: object.name,
            reason: 'Element set is beyond the propagation horizon.',
            freshness,
          });
          continue;
        }

        const satrec = satrecFor(object.elementSet.line1, object.elementSet.line2);
        if (!satrec) {
          refused.push({
            objectId: object.id,
            objectName: object.name,
            reason: 'Element set could not be parsed.',
            freshness,
          });
          continue;
        }

        const found = findPasses({
          satrec,
          object,
          observer,
          start: now,
          hours,
          cloudCoverAt: (date) => forecast.at(date),
          config,
        });

        all.push(
          ...found.map((p) => ({
            ...p,
            objectCategory: object.category,
            objectCategoryLabel: object.categoryLabel,
            locationId: location.id,
            locationName: location.name,
          })),
        );
      }

      const filtered = all
        .filter((p) => (visibleOnly ? p.visibility.visible : true))
        .filter((p) => p.score >= minScore)
        .sort((a, b) => new Date(a.aos) - new Date(b.aos));

      const visibleCount = all.filter((p) => p.visibility.visible).length;
      const degraded = all.some((p) => p.scoreDegraded);

      return envelope(
        {
          passes: filtered,
          refused,
          counts: {
            total: all.length,
            visible: visibleCount,
            aboveHorizonOnly: all.length - visibleCount,
            shown: filtered.length,
          },
          location,
        },
        {
          source: 'engine',
          sourceLabel: 'Computed by the propagation engine',
          kind: 'computed',
          retrievedAt: now.toISOString(),
          degraded,
          degradedReason: degraded
            ? 'No cloud forecast beyond the provider horizon. The cloud term was dropped and the score renormalised.'
            : null,
          thresholds: {
            minElevationDeg: config.minElevationDeg,
            twilightThresholdDeg: config.twilightThresholdDeg,
            requireIllumination: config.requireIllumination,
            propagationHorizonDays: config.propagationHorizonDays,
            coarseStepSeconds: config.coarseStepSeconds,
            refineToleranceSeconds: config.refineToleranceSeconds,
          },
        },
      );
    }, { scale: 1.4 });
  },

  /** One pass, with the polar track for the drawing. */
  detail({ objectId, aos, locationId }) {
    return call(() => {
      const store = db();
      const object = store.objectsById.get(objectId);
      if (!object) throw new ApiError('Object not found.', { status: 404, code: 'not_found' });

      const { location, observer } = resolveObserver(locationId);
      const config = configFor(location);
      const forecast = cloudForecastFor(location.id);
      const satrec = satrecFor(object.elementSet.line1, object.elementSet.line2);
      if (!satrec) throw new ApiError('Element set could not be parsed.', { status: 422, code: 'bad_elements' });

      // Search a window around the requested acquisition time and take the
      // closest match, so a link stays valid as the clock moves on.
      const target = new Date(aos);
      const start = new Date(target.getTime() - 3 * 3600000);
      const found = findPasses({
        satrec,
        object,
        observer,
        start: start > new Date() ? start : new Date(),
        hours: 12,
        cloudCoverAt: (date) => forecast.at(date),
        config,
      });

      const pass =
        found.sort(
          (a, b) =>
            Math.abs(new Date(a.aos) - target) - Math.abs(new Date(b.aos) - target),
        )[0] ?? null;

      if (!pass) throw new ApiError('That pass is no longer in the prediction window.', { status: 404, code: 'expired' });

      const track = passTrack(satrec, observer, pass.aos, pass.los, 72);

      return envelope(
        {
          pass: { ...pass, locationId: location.id, locationName: location.name },
          track,
          object,
          location,
        },
        {
          source: 'engine',
          sourceLabel: 'Computed by the propagation engine',
          kind: 'computed',
          thresholds: {
            minElevationDeg: config.minElevationDeg,
            twilightThresholdDeg: config.twilightThresholdDeg,
          },
        },
      );
    }, { scale: 1.2 });
  },

  /**
   * Build the ranked windows of a saved plan, with the conflict resolution of
   * SRS A.9 applied so overlapping windows are reported rather than hidden.
   */
  plan(planId) {
    return call(async () => {
      const store = db();
      const plan = store.plans.find((p) => p.id === planId);
      if (!plan) throw new ApiError('Plan not found.', { status: 404, code: 'not_found' });

      const objectIds = [...new Set(plan.objectIds)];

      const hours = Math.max(
        1,
        Math.round((new Date(plan.endsAt) - new Date(plan.startsAt)) / 3600000),
      );

      const { data, meta } = await passes.predict({
        objectIds,
        locationId: plan.locationId,
        hours,
        visibleOnly: plan.visibleOnly,
        minScore: plan.minScore,
      });

      const { kept, dropped } = resolveConflicts(data.passes, store.settings);

      return envelope(
        {
          plan,
          windows: kept,
          conflicts: dropped,
          refused: data.refused,
          counts: { ...data.counts, kept: kept.length, dropped: dropped.length },
          objectIds,
        },
        {
          ...meta,
          turnaroundMinutes: store.settings.turnaroundMinutes,
        },
      );
    }, { scale: 0.2 });
  },

  /** Cloud-cover forecast points for a location, for the planner chart. */
  cloudForecast(locationId) {
    return call(() => {
      const forecast = cloudForecastFor(locationId);
      const points = forecast.points
        .filter((_, i) => i % 3 === 0)
        .map((p) => ({ t: new Date(p.t).toISOString(), cover: p.available ? p.cover : null, available: p.available }));
      const horizon = forecast.points.findLast((p) => p.available);
      return envelope(
        { points, horizonAt: horizon ? new Date(horizon.t).toISOString() : null },
        {
          source: 'fixture-weather',
          sourceLabel: 'Cloud forecast provider (fixture)',
          degraded: true,
          degradedReason: 'The provider returns no forecast beyond seven days.',
        },
      );
    }, { scale: 0.5 });
  },
};
