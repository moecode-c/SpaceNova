/**
 * Pass detection and refinement, SRS Appendix A.4, assembled with A.5 to A.8
 * into the pass records the planner and the pass detail screen display.
 *
 * The scan is coarse (default 30 s) because a pass that clears 10 degrees lasts
 * minutes, and the edges are then refined by bisection to the 1 s tolerance the
 * SRS states. Closest approach is found by a golden-section search rather than
 * by stepping, so the refinement cost does not depend on the step size.
 */

import { DEFAULTS } from './defaults.js';
import { elevationAt, observerGd, stateAt, lookAnglesFromState, phaseAngleFor } from './propagate.js';
import { sunLookAngles } from './sun.js';
import { evaluateVisibility } from './visibility.js';
import { estimateMagnitude, visibilityClass } from './magnitude.js';
import { scorePass } from './score.js';
import { freshnessOf } from './freshness.js';

/** Refine a horizon crossing to within `tolerance` seconds by bisection. */
function refineCrossing(satrec, gd, tBelow, tAbove, threshold, toleranceMs) {
  let lo = tBelow;
  let hi = tAbove;
  let guard = 0;
  while (Math.abs(hi - lo) > toleranceMs && guard < 40) {
    const mid = (lo + hi) / 2;
    const el = elevationAt(satrec, new Date(mid), gd);
    if (el === null) break;
    if (el >= threshold) hi = mid;
    else lo = mid;
    guard += 1;
  }
  return (lo + hi) / 2;
}

/** Golden-section search for the time of maximum elevation. */
function findCulmination(satrec, gd, tStart, tEnd) {
  const phi = 0.6180339887;
  let a = tStart;
  let b = tEnd;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let guard = 0;
  while (Math.abs(b - a) > 1000 && guard < 60) {
    const ec = elevationAt(satrec, new Date(c), gd) ?? -90;
    const ed = elevationAt(satrec, new Date(d), gd) ?? -90;
    if (ec > ed) {
      b = d;
      d = c;
      c = b - phi * (b - a);
    } else {
      a = c;
      c = d;
      d = a + phi * (b - a);
    }
    guard += 1;
  }
  return (a + b) / 2;
}

/**
 * Find every pass of one object over one observer in a time window.
 *
 * @param {object} args
 * @param {object} args.satrec
 * @param {object} args.object Catalog record; supplies the standard magnitude and epoch.
 * @param {{latitude:number, longitude:number, altitudeM?:number, horizonMask?:number[]}} args.observer
 * @param {Date} args.start
 * @param {number} args.hours
 * @param {(date: Date) => number|null} [args.cloudCoverAt] Optional forecast lookup.
 * @param {typeof DEFAULTS} [args.config]
 * @returns {Array<object>} Pass records, earliest first.
 */
export function findPasses({
  satrec,
  object,
  observer,
  start,
  hours = 72,
  cloudCoverAt,
  config = DEFAULTS,
}) {
  if (!satrec) return [];

  const freshness = freshnessOf(object?.elementSet?.epoch ?? start, start, config);
  // A.7: refuse to propagate an expired element set.
  if (!freshness.usable) return [];

  const gd = observerGd(observer);
  const stepMs = config.coarseStepSeconds * 1000;
  const toleranceMs = config.refineToleranceSeconds * 1000;
  const threshold = config.minElevationDeg;

  const startMs = start.getTime();
  const endMs = startMs + hours * 3600000;

  const passes = [];
  let previousElevation = elevationAt(satrec, new Date(startMs), gd);
  let aosMs = previousElevation !== null && previousElevation >= threshold ? startMs : null;

  for (let t = startMs + stepMs; t <= endMs; t += stepMs) {
    const elevation = elevationAt(satrec, new Date(t), gd);
    if (elevation === null) continue;

    const wasAbove = previousElevation !== null && previousElevation >= threshold;
    const isAbove = elevation >= threshold;

    if (!wasAbove && isAbove) {
      aosMs = refineCrossing(satrec, gd, t - stepMs, t, threshold, toleranceMs);
    } else if (wasAbove && !isAbove && aosMs !== null) {
      const losMs = refineCrossing(satrec, gd, t, t - stepMs, threshold, toleranceMs);
      const record = buildPass({
        satrec,
        object,
        observer,
        aosMs,
        losMs,
        gd,
        cloudCoverAt,
        freshness,
        config,
      });
      if (record) passes.push(record);
      aosMs = null;
    }

    previousElevation = elevation;
  }

  return passes;
}

/** Assemble one pass record from its refined AOS and LOS. */
function buildPass({
  satrec,
  object,
  observer,
  aosMs,
  losMs,
  gd,
  cloudCoverAt,
  freshness,
  config,
}) {
  const tcaMs = findCulmination(satrec, gd, aosMs, losMs);
  const aos = new Date(aosMs);
  const tca = new Date(tcaMs);
  const los = new Date(losMs);

  const stateTca = stateAt(satrec, tca);
  if (!stateTca) return null;

  const lookAos = lookAnglesAt(satrec, aos, observer);
  const lookTca = lookAnglesFromState(stateTca, tca, observer);
  const lookLos = lookAnglesAt(satrec, los, observer);
  if (!lookAos || !lookTca || !lookLos) return null;

  const sun = sunLookAngles(tca, observer, stateTca.gmst);
  const phase = phaseAngleFor(stateTca, tca, observer);
  const magnitude =
    stateTca.eclipse.state === 'sunlit'
      ? estimateMagnitude(object?.standardMagnitude ?? null, lookTca.rangeKm, phase)
      : null;

  const cloudCover = cloudCoverAt ? cloudCoverAt(tca) : null;
  const durationSeconds = (losMs - aosMs) / 1000;

  const visibility = evaluateVisibility(
    {
      maxElevation: lookTca.elevation,
      azimuthAtMax: lookTca.azimuth,
      eclipseState: stateTca.eclipse.state,
      sunElevation: sun.elevation,
      horizonMask: observer.horizonMask,
    },
    config,
  );

  const quality = scorePass(
    {
      maxElevation: lookTca.elevation,
      durationSeconds,
      eclipseState: stateTca.eclipse.state,
      sunElevation: sun.elevation,
      magnitude,
      cloudCover,
      freshness,
    },
    config,
  );

  return {
    id: `${object?.id ?? 'obj'}-${Math.round(aosMs / 1000)}`,
    objectId: object?.id ?? null,
    objectName: object?.name ?? 'Unknown object',
    noradId: object?.noradId ?? null,
    aos: aos.toISOString(),
    tca: tca.toISOString(),
    los: los.toISOString(),
    durationSeconds,
    maxElevation: lookTca.elevation,
    azimuthAos: lookAos.azimuth,
    azimuthTca: lookTca.azimuth,
    azimuthLos: lookLos.azimuth,
    rangeAtTcaKm: lookTca.rangeKm,
    rangeRateAtTcaKms: lookTca.rangeRateKms,
    altitudeAtTcaKm: stateTca.altitudeKm,
    eclipseState: stateTca.eclipse.state,
    sunElevation: sun.elevation,
    phaseAngle: phase,
    magnitude,
    magnitudeClass: visibilityClass(magnitude),
    cloudCover,
    freshness,
    visibility,
    score: quality.score,
    scoreBand: quality.band,
    scoreTerms: quality.terms,
    scoreDegraded: quality.degraded,
    status: 'predicted',
  };
}

function lookAnglesAt(satrec, date, observer) {
  const state = stateAt(satrec, date);
  if (!state) return null;
  return lookAnglesFromState(state, date, observer);
}

/**
 * Elevation/azimuth samples across a pass, for the polar track drawing.
 * @returns {Array<{t: string, azimuth: number, elevation: number}>}
 */
export function passTrack(satrec, observer, aos, los, samples = 60) {
  const startMs = new Date(aos).getTime();
  const endMs = new Date(los).getTime();
  const step = (endMs - startMs) / samples;
  const out = [];
  for (let i = 0; i <= samples; i += 1) {
    const date = new Date(startMs + i * step);
    const state = stateAt(satrec, date);
    if (!state) continue;
    const look = lookAnglesFromState(state, date, observer);
    out.push({
      t: date.toISOString(),
      azimuth: look.azimuth,
      elevation: look.elevation,
      illuminated: state.eclipse.illuminated,
    });
  }
  return out;
}
