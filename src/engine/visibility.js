/**
 * The four-clause visibility test, SRS Appendix A.5.
 *
 * A pass is "above the horizon" whenever its elevation clears the minimum. It
 * is "visible" only when all four clauses hold. The clauses are evaluated and
 * reported separately so the interface can say exactly which one failed, which
 * is what section 6.3 asks of every rejection.
 */

import { skyCondition } from './sun.js';
import { DEFAULTS } from './defaults.js';

/** A 36-slot mask: obstruction elevation in degrees per 10 degrees of azimuth. */
export const OPEN_HORIZON = new Array(36).fill(0);

/** Obstruction elevation at a given azimuth, interpolated between mask slots. */
export function maskElevationAt(mask, azimuthDeg) {
  if (!mask || mask.length === 0) return 0;
  const slots = mask.length;
  const position = (((azimuthDeg % 360) + 360) % 360) / (360 / slots);
  const i = Math.floor(position) % slots;
  const j = (i + 1) % slots;
  const t = position - Math.floor(position);
  return mask[i] * (1 - t) + mask[j] * t;
}

/**
 * @param {object} input
 * @param {number} input.maxElevation Degrees.
 * @param {number} input.azimuthAtMax Degrees.
 * @param {string} input.eclipseState 'sunlit' | 'penumbra' | 'umbra'
 * @param {number} input.sunElevation Degrees, at the observer, at closest approach.
 * @param {number[]} [input.horizonMask]
 * @param {typeof DEFAULTS} [config]
 */
export function evaluateVisibility(input, config = DEFAULTS) {
  const {
    maxElevation,
    azimuthAtMax,
    eclipseState: eclipse,
    sunElevation,
    horizonMask,
  } = input;

  const obstruction = config.applyHorizonMask
    ? maskElevationAt(horizonMask, azimuthAtMax)
    : 0;

  const clauses = [
    {
      key: 'elevation',
      label: 'Reaches the minimum elevation',
      detail: `${maxElevation.toFixed(1)}° against a ${config.minElevationDeg}° threshold`,
      pass: maxElevation >= config.minElevationDeg,
    },
    {
      key: 'illumination',
      label: 'Satellite is sunlit',
      detail:
        eclipse === 'sunlit'
          ? 'Outside the Earth shadow cone'
          : eclipse === 'penumbra'
            ? 'Inside the penumbra'
            : 'Inside the umbra',
      pass: !config.requireIllumination || eclipse === 'sunlit',
    },
    {
      key: 'darkness',
      label: 'Observer sky is dark enough',
      detail: `Sun at ${sunElevation.toFixed(1)}° against a ${config.twilightThresholdDeg}° threshold (${
        skyCondition(sunElevation).label
      })`,
      pass: sunElevation <= config.twilightThresholdDeg,
    },
    {
      key: 'horizon',
      label: 'Clear of the horizon mask',
      detail:
        obstruction > 0
          ? `Mask is ${obstruction.toFixed(1)}° at azimuth ${azimuthAtMax.toFixed(0)}°`
          : 'No obstruction recorded on this bearing',
      pass: maxElevation >= obstruction,
    },
  ];

  const failed = clauses.filter((c) => !c.pass);

  return {
    clauses,
    visible: failed.length === 0,
    abovehorizon: clauses[0].pass && clauses[3].pass,
    failedClauses: failed.map((c) => c.key),
    // A one-line reason for the interface, naming only the first failure.
    reason: failed.length === 0 ? null : failed[0].label,
    obstructionDeg: obstruction,
  };
}
