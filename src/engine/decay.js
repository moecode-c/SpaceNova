/**
 * Orbital decay and re-entry window estimate, SRS Appendix A.10.
 *
 * This is a coarse engineering estimate, not an operational re-entry
 * prediction. It takes the perigee altitude, the drag term from the element
 * set, and the current solar and geomagnetic activity, and returns a WINDOW
 * rather than a date. The interface states both the window and this limitation
 * every time it shows the result.
 */

import { apsides, semiMajorAxis } from './tle.js';
import { clamp } from '../lib/random.js';

/**
 * Atmospheric density scale factor from solar and geomagnetic activity.
 * F10.7 near 70 is a quiet Sun, near 250 is an active one; Kp raises the
 * density at a given altitude during a storm.
 */
export function activityFactor(f107 = 110, kp = 2) {
  const solar = clamp((f107 - 70) / 120, 0, 1.6);
  const geomagnetic = clamp(kp / 9, 0, 1) * 0.35;
  return 0.65 + solar + geomagnetic;
}

/**
 * @param {object} args
 * @param {number} args.meanMotion Revolutions per day.
 * @param {number} args.eccentricity
 * @param {number} args.bstar Drag term from the element set.
 * @param {number} [args.f107]
 * @param {number} [args.kp]
 * @param {Date} [args.now]
 * @returns {{
 *   perigeeKm: number, apogeeKm: number, semiMajorAxisKm: number,
 *   status: 'stable'|'decaying'|'imminent',
 *   lifetimeDays: number|null, windowDays: [number, number]|null,
 *   windowStart: string|null, windowEnd: string|null,
 *   altitudeLossKmPerDay: number, confidence: 'low'|'very low',
 * }}
 */
export function estimateDecay({
  meanMotion,
  eccentricity,
  bstar,
  f107 = 110,
  kp = 2,
  now = new Date(),
}) {
  const { apogeeKm, perigeeKm } = apsides(meanMotion, eccentricity);
  const a = semiMajorAxis(meanMotion);
  const factor = activityFactor(f107, kp);

  // Above roughly 700 km drag is negligible on any horizon this product talks
  // about, so the estimate is reported as stable rather than as a large number.
  if (perigeeKm > 700 || bstar <= 0) {
    return {
      perigeeKm,
      apogeeKm,
      semiMajorAxisKm: a,
      status: 'stable',
      lifetimeDays: null,
      windowDays: null,
      windowStart: null,
      windowEnd: null,
      altitudeLossKmPerDay: 0,
      confidence: 'low',
    };
  }

  // Exponential atmosphere: scale height near 60 km over the band that matters.
  const referenceAltitude = 300;
  const scaleHeight = 60;
  const densityRatio = Math.exp((referenceAltitude - perigeeKm) / scaleHeight);

  // Calibrated so that a typical 400 km payload with a nominal drag term loses
  // of the order of 100 m per day under average solar activity.
  const lossKmPerDay = clamp(
    (bstar / 1e-4) * 0.09 * factor * densityRatio,
    0.0005,
    40,
  );

  const altitudeAboveReentry = Math.max(0, perigeeKm - 120);
  // Decay accelerates, so the mean rate over the remaining life is higher than
  // the current rate. A factor of 2.2 on the current rate is a usable first cut.
  const lifetimeDays = clamp(altitudeAboveReentry / (lossKmPerDay * 2.2), 0.2, 4000);

  const status = lifetimeDays < 30 ? 'imminent' : 'decaying';
  // The window widens with the horizon: plus or minus 35 per cent, floor 1 day.
  const spread = Math.max(1, lifetimeDays * 0.35);
  const windowDays = [
    Math.max(0, lifetimeDays - spread),
    lifetimeDays + spread,
  ];

  return {
    perigeeKm,
    apogeeKm,
    semiMajorAxisKm: a,
    status,
    lifetimeDays,
    windowDays,
    windowStart: new Date(now.getTime() + windowDays[0] * 86400000).toISOString(),
    windowEnd: new Date(now.getTime() + windowDays[1] * 86400000).toISOString(),
    altitudeLossKmPerDay: lossKmPerDay,
    confidence: lifetimeDays < 60 ? 'low' : 'very low',
  };
}

export const DECAY_DISCLAIMER =
  'Estimate only. Derived from the element set drag term and current solar and geomagnetic indices. ' +
  'Not suitable for operational re-entry planning, and no conjunction or collision assessment is performed.';
