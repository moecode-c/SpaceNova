/**
 * Estimated visual magnitude, SRS Appendix A.6.
 *
 * This is an ESTIMATE and the interface must always label it as one. It uses a
 * standard magnitude (brightness at 1000 km range, 50 per cent illumination)
 * together with the slant range and the phase angle. It does not model
 * attitude, specular panels or atmospheric extinction, so a tumbling body or a
 * flaring panel will depart from it by magnitudes.
 */

import { DEG } from './sun.js';

/** Stated uncertainty of the estimate, in magnitudes. */
export const MAGNITUDE_UNCERTAINTY = 1.2;

/**
 * Diffuse-sphere phase function. Returns 0..1.
 * @param {number} phaseDeg 0 means fully lit as seen from the observer.
 */
export function phaseFunction(phaseDeg) {
  const phase = Math.min(Math.PI, Math.max(0, phaseDeg * DEG));
  return (Math.sin(phase) + (Math.PI - phase) * Math.cos(phase)) / Math.PI;
}

/**
 * @param {number} standardMagnitude Brightness at 1000 km, half illuminated.
 * @param {number} rangeKm Slant range from the observer.
 * @param {number} phaseDeg Sun-satellite-observer angle.
 * @returns {number|null} Estimated visual magnitude, or null when not computable.
 */
export function estimateMagnitude(standardMagnitude, rangeKm, phaseDeg) {
  if (standardMagnitude === null || standardMagnitude === undefined) return null;
  if (!rangeKm || rangeKm <= 0) return null;

  const fraction = phaseFunction(phaseDeg);
  if (fraction <= 1e-4) return null; // Effectively unlit from the observer's side.

  return (
    standardMagnitude - 15.75 + 2.5 * Math.log10((rangeKm * rangeKm) / fraction)
  );
}

/** Naked-eye bands used for the badges on a pass. */
export function visibilityClass(magnitude) {
  if (magnitude === null || magnitude === undefined) return { key: 'unknown', label: 'Unknown' };
  if (magnitude <= 0) return { key: 'brilliant', label: 'Brilliant', tone: 'good' };
  if (magnitude <= 2.5) return { key: 'bright', label: 'Bright', tone: 'good' };
  if (magnitude <= 4.5) return { key: 'visible', label: 'Naked eye', tone: 'primary' };
  if (magnitude <= 6.5) return { key: 'marginal', label: 'Marginal', tone: 'warn' };
  return { key: 'optical', label: 'Optical aid', tone: 'bad' };
}
