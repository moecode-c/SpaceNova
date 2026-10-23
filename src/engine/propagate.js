/**
 * SGP4/SDP4 propagation and the derived geometry the interface displays.
 *
 * Implements SRS Appendix A.1 to A.3. Everything here is a pure function of
 * (element set, time, observer) so it can be unit-tested against reference
 * values, which is the maintainability requirement in section 6.7.
 */

import * as satellite from 'satellite.js';
import { DEG, RAD, EARTH_RADIUS_KM, sunUnitVector, eclipseState, phaseAngle } from './sun.js';

const satrecCache = new Map();

/**
 * Parse a TLE pair into an SGP4 record, memoised by line content.
 * @returns {object|null} null when the element set cannot be parsed.
 */
export function satrecFor(line1, line2) {
  const key = `${line1}|${line2}`;
  if (satrecCache.has(key)) return satrecCache.get(key);
  let rec = null;
  try {
    const parsed = satellite.twoline2satrec(line1, line2);
    rec = parsed && !parsed.error ? parsed : null;
  } catch {
    rec = null;
  }
  satrecCache.set(key, rec);
  return rec;
}

/** Greenwich mean sidereal time in radians. */
export const gmstFor = (date) => satellite.gstime(date);

/**
 * Full propagated state for one object at one instant.
 *
 * @param {object} satrec
 * @param {Date} date
 * @returns {null|{
 *   eci: {x:number,y:number,z:number},
 *   velocity: {x:number,y:number,z:number},
 *   ecf: {x:number,y:number,z:number},
 *   latitude: number, longitude: number, altitudeKm: number,
 *   speedKms: number, footprintRadiusKm: number,
 *   eclipse: {state: string, illuminated: boolean},
 *   gmst: number,
 * }}
 */
export function stateAt(satrec, date) {
  if (!satrec) return null;
  let pv;
  try {
    pv = satellite.propagate(satrec, date);
  } catch {
    return null;
  }
  if (!pv || !pv.position || Number.isNaN(pv.position.x)) return null;

  const gmst = gmstFor(date);
  const geodetic = satellite.eciToGeodetic(pv.position, gmst);
  const ecf = satellite.eciToEcf(pv.position, gmst);
  const speed = Math.sqrt(
    pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2,
  );

  return {
    eci: pv.position,
    velocity: pv.velocity,
    ecf,
    latitude: satellite.degreesLat(geodetic.latitude),
    longitude: satellite.degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
    speedKms: speed,
    footprintRadiusKm: footprintRadius(geodetic.height),
    eclipse: eclipseState(pv.position, sunUnitVector(date)),
    gmst,
  };
}

/**
 * Ground radius of the circle inside which the object is above `minElevation`.
 * @param {number} altitudeKm
 * @param {number} minElevationDeg
 */
export function footprintRadius(altitudeKm, minElevationDeg = 0) {
  const ratio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + Math.max(1, altitudeKm));
  const eps = minElevationDeg * DEG;
  const central = Math.acos(Math.min(1, ratio * Math.cos(eps))) - eps;
  return Math.max(0, EARTH_RADIUS_KM * central);
}

/** The same radius expressed as a central angle in degrees, for map drawing. */
export function footprintAngle(altitudeKm, minElevationDeg = 0) {
  return (footprintRadius(altitudeKm, minElevationDeg) / EARTH_RADIUS_KM) * RAD;
}

/**
 * Observer record in the form satellite.js expects (radians, km).
 * @param {{latitude:number, longitude:number, altitudeM?:number}} observer
 */
export function observerGd(observer) {
  return {
    latitude: observer.latitude * DEG,
    longitude: observer.longitude * DEG,
    height: (observer.altitudeM ?? 0) / 1000,
  };
}

/**
 * Azimuth, elevation, slant range and range rate, SRS A.3.
 * @returns {{azimuth:number, elevation:number, rangeKm:number, rangeRateKms:number}}
 */
export function lookAngles(satrec, date, observer) {
  const state = stateAt(satrec, date);
  if (!state) return null;
  return lookAnglesFromState(state, date, observer);
}

export function lookAnglesFromState(state, date, observer) {
  const gd = observerGd(observer);
  const look = satellite.ecfToLookAngles(gd, state.ecf);
  const velocityEcf = satellite.eciToEcf(state.velocity, state.gmst);
  const observerEcf = satellite.geodeticToEcf(gd);

  // Range rate from the component of relative velocity along the line of sight.
  const dx = state.ecf.x - observerEcf.x;
  const dy = state.ecf.y - observerEcf.y;
  const dz = state.ecf.z - observerEcf.z;
  const range = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const rangeRate =
    (dx * velocityEcf.x + dy * velocityEcf.y + dz * velocityEcf.z) / range;

  return {
    azimuth: look.azimuth * RAD,
    elevation: look.elevation * RAD,
    rangeKm: look.rangeSat,
    rangeRateKms: rangeRate,
  };
}

/** Elevation only. Hot path for the pass scan, so it skips the extra work. */
export function elevationAt(satrec, date, gd) {
  let pv;
  try {
    pv = satellite.propagate(satrec, date);
  } catch {
    return null;
  }
  if (!pv || !pv.position || Number.isNaN(pv.position.x)) return null;
  const ecf = satellite.eciToEcf(pv.position, gmstFor(date));
  return satellite.ecfToLookAngles(gd, ecf).elevation * RAD;
}

/** Doppler shift in Hz for a downlink frequency, from the range rate. */
export function dopplerShiftHz(frequencyHz, rangeRateKms) {
  const c = 299792.458; // km/s
  return -frequencyHz * (rangeRateKms / c);
}

/**
 * Ground track as a list of points, split into segments wherever it crosses the
 * antimeridian so a polyline renderer does not draw a line across the map.
 *
 * @param {object} satrec
 * @param {Date} centre
 * @param {{ beforeMinutes?: number, afterMinutes?: number, stepSeconds?: number }} opts
 * @returns {Array<Array<{latitude:number, longitude:number, time:Date}>>}
 */
export function groundTrack(satrec, centre, opts = {}) {
  const { beforeMinutes = 45, afterMinutes = 90, stepSeconds = 30 } = opts;
  const points = [];
  const start = centre.getTime() - beforeMinutes * 60000;
  const end = centre.getTime() + afterMinutes * 60000;

  for (let t = start; t <= end; t += stepSeconds * 1000) {
    const date = new Date(t);
    let pv;
    try {
      pv = satellite.propagate(satrec, date);
    } catch {
      continue;
    }
    if (!pv || !pv.position || Number.isNaN(pv.position.x)) continue;
    const gd = satellite.eciToGeodetic(pv.position, gmstFor(date));
    points.push({
      latitude: satellite.degreesLat(gd.latitude),
      longitude: satellite.degreesLong(gd.longitude),
      time: date,
    });
  }

  const segments = [];
  let current = [];
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0 && Math.abs(points[i].longitude - points[i - 1].longitude) > 180) {
      if (current.length > 1) segments.push(current);
      current = [];
    }
    current.push(points[i]);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Phase angle at the observer, for the magnitude estimate. */
export function phaseAngleFor(state, date, observer) {
  const gd = observerGd(observer);
  const observerEcf = satellite.geodeticToEcf(gd);
  const observerEci = satellite.ecfToEci(observerEcf, state.gmst);
  return phaseAngle(state.eci, observerEci, sunUnitVector(date));
}

export { satellite };
