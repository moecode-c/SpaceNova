/**
 * Solar and lunar geometry.
 *
 * Implements SRS Appendix A.1 (time and frames) and the parts of A.5 that need
 * the Sun: the observer-darkness test and the Earth-shadow test.
 *
 * The solar position is the low-precision series (accurate to roughly 0.01
 * degrees over the years around J2000), which is well inside what a visibility
 * decision needs. The lunar model is an approximation and is labelled as such
 * wherever it reaches the interface.
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const EARTH_RADIUS_KM = 6378.137; // WGS-84 equatorial radius.
export const AU_KM = 149597870.7;
export const MU_EARTH = 398600.4418; // km^3/s^2

/** Julian date from a JS Date. */
export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Days since the J2000.0 epoch. */
export function daysSinceJ2000(date) {
  return julianDate(date) - 2451545.0;
}

/**
 * Geocentric equatorial position of the Sun.
 * @param {Date} date
 * @returns {{ x: number, y: number, z: number, ra: number, dec: number, distanceKm: number }}
 *   Cartesian components in km, right ascension and declination in radians.
 */
export function sunPosition(date) {
  const n = daysSinceJ2000(date);

  const meanLon = (280.46 + 0.9856474 * n) * DEG;
  const meanAnom = (357.528 + 0.9856003 * n) * DEG;

  const eclipticLon =
    meanLon + 1.915 * DEG * Math.sin(meanAnom) + 0.02 * DEG * Math.sin(2 * meanAnom);
  const obliquity = (23.439 - 0.0000004 * n) * DEG;

  const distanceAu =
    1.00014 - 0.01671 * Math.cos(meanAnom) - 0.00014 * Math.cos(2 * meanAnom);
  const distanceKm = distanceAu * AU_KM;

  const cosEps = Math.cos(obliquity);
  const sinEps = Math.sin(obliquity);
  const cosLon = Math.cos(eclipticLon);
  const sinLon = Math.sin(eclipticLon);

  return {
    x: distanceKm * cosLon,
    y: distanceKm * cosEps * sinLon,
    z: distanceKm * sinEps * sinLon,
    ra: Math.atan2(cosEps * sinLon, cosLon),
    dec: Math.asin(sinEps * sinLon),
    distanceKm,
  };
}

/** Unit vector from the Earth's centre towards the Sun. */
export function sunUnitVector(date) {
  const s = sunPosition(date);
  const r = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
  return { x: s.x / r, y: s.y / r, z: s.z / r };
}

/**
 * Sun elevation and azimuth for an observer.
 * @param {Date} date
 * @param {{ latitude: number, longitude: number }} observer Degrees.
 * @param {number} gmst Greenwich mean sidereal time in radians.
 * @returns {{ elevation: number, azimuth: number }} Degrees.
 */
export function sunLookAngles(date, observer, gmst) {
  const { ra, dec } = sunPosition(date);
  const lat = observer.latitude * DEG;
  const localSidereal = gmst + observer.longitude * DEG;
  const hourAngle = localSidereal - ra;

  const sinEl =
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.min(1, Math.max(-1, sinEl)));

  const azimuth = Math.atan2(
    -Math.cos(dec) * Math.sin(hourAngle),
    Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(hourAngle),
  );

  return {
    elevation: elevation * RAD,
    azimuth: ((azimuth * RAD) % 360 + 360) % 360,
  };
}

/** Twilight thresholds in degrees of solar elevation (SRS A.5 default: nautical). */
export const TWILIGHT = {
  civil: -6,
  nautical: -12,
  astronomical: -18,
};

/**
 * Name the lighting condition at an observer from the Sun's elevation.
 * @param {number} sunElevationDeg
 */
export function skyCondition(sunElevationDeg) {
  if (sunElevationDeg > 0) return { key: 'day', label: 'Daylight', dark: false };
  if (sunElevationDeg > TWILIGHT.civil) return { key: 'civil', label: 'Civil twilight', dark: false };
  if (sunElevationDeg > TWILIGHT.nautical)
    return { key: 'nautical', label: 'Nautical twilight', dark: false };
  if (sunElevationDeg > TWILIGHT.astronomical)
    return { key: 'astronomical', label: 'Astronomical twilight', dark: true };
  return { key: 'night', label: 'Night', dark: true };
}

// Conical shadow half-angles (Vallado), in radians.
const ALPHA_UMBRA = 0.264121687 * DEG;
const ALPHA_PENUMBRA = 0.269007205 * DEG;

/**
 * Earth-shadow test for a satellite, SRS A.5 clause 2.
 *
 * Uses the conical umbra/penumbra model rather than the cylindrical
 * approximation, so a satellite skimming the terminator is reported as being in
 * penumbra instead of being flipped abruptly between lit and dark.
 *
 * @param {{x:number,y:number,z:number}} satEci Satellite position in km.
 * @param {{x:number,y:number,z:number}} sunUnit Unit vector towards the Sun.
 * @returns {{ state: 'sunlit'|'penumbra'|'umbra', illuminated: boolean }}
 */
export function eclipseState(satEci, sunUnit) {
  const dot = satEci.x * sunUnit.x + satEci.y * sunUnit.y + satEci.z * sunUnit.z;
  if (dot > 0) return { state: 'sunlit', illuminated: true };

  const rMag = Math.sqrt(satEci.x ** 2 + satEci.y ** 2 + satEci.z ** 2);
  // Angle between the anti-Sun direction and the satellite position vector.
  const cosAngle = Math.min(1, Math.max(-1, -dot / rMag));
  const angle = Math.acos(cosAngle);

  const horizontal = rMag * Math.cos(angle);
  const vertical = rMag * Math.sin(angle);

  const penumbraLimit = EARTH_RADIUS_KM + Math.tan(ALPHA_PENUMBRA) * horizontal;
  const umbraLimit = EARTH_RADIUS_KM - Math.tan(ALPHA_UMBRA) * horizontal;

  if (vertical <= umbraLimit) return { state: 'umbra', illuminated: false };
  if (vertical <= penumbraLimit) return { state: 'penumbra', illuminated: false };
  return { state: 'sunlit', illuminated: true };
}

/**
 * Phase angle at the satellite: the Sun-satellite-observer angle, needed by the
 * magnitude estimate in A.6.
 * @returns {number} Degrees. 0 means fully lit as seen from the observer.
 */
export function phaseAngle(satEci, observerEci, sunUnit) {
  const toSun = sunUnit;
  const toObs = {
    x: observerEci.x - satEci.x,
    y: observerEci.y - satEci.y,
    z: observerEci.z - satEci.z,
  };
  const obsMag = Math.sqrt(toObs.x ** 2 + toObs.y ** 2 + toObs.z ** 2) || 1;
  const dot =
    (toSun.x * toObs.x + toSun.y * toObs.y + toSun.z * toObs.z) / obsMag;
  return Math.acos(Math.min(1, Math.max(-1, dot))) * RAD;
}

/**
 * Low-precision lunar position (the truncated series from the Astronomical
 * Almanac). Good to a few tenths of a degree, which is ample for "is the Moon
 * up, and roughly where". Labelled as approximate wherever it is displayed.
 */
export function moonPosition(date) {
  const n = daysSinceJ2000(date);

  const meanLon = (218.316 + 13.176396 * n) * DEG;
  const meanAnom = (134.963 + 13.064993 * n) * DEG;
  const argLat = (93.272 + 13.22935 * n) * DEG;

  const eclipticLon = meanLon + 6.289 * DEG * Math.sin(meanAnom);
  const eclipticLat = 5.128 * DEG * Math.sin(argLat);
  const distanceKm = 385001 - 20905 * Math.cos(meanAnom);

  const obliquity = (23.439 - 0.0000004 * n) * DEG;
  const sinDec =
    Math.sin(eclipticLat) * Math.cos(obliquity) +
    Math.cos(eclipticLat) * Math.sin(obliquity) * Math.sin(eclipticLon);
  const dec = Math.asin(Math.min(1, Math.max(-1, sinDec)));
  const ra = Math.atan2(
    Math.sin(eclipticLon) * Math.cos(obliquity) -
      Math.tan(eclipticLat) * Math.sin(obliquity),
    Math.cos(eclipticLon),
  );

  return { ra, dec, distanceKm };
}

/** Moon elevation and azimuth for an observer, in degrees. */
export function moonLookAngles(date, observer, gmst) {
  const { ra, dec } = moonPosition(date);
  const lat = observer.latitude * DEG;
  const hourAngle = gmst + observer.longitude * DEG - ra;

  const sinEl =
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.min(1, Math.max(-1, sinEl)));
  const azimuth = Math.atan2(
    -Math.cos(dec) * Math.sin(hourAngle),
    Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(hourAngle),
  );

  return {
    elevation: elevation * RAD,
    azimuth: ((azimuth * RAD) % 360 + 360) % 360,
  };
}

const SYNODIC_MONTH = 29.530588853;
// A reference new moon: 2000-01-06 18:14 UTC.
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86400000 + 2440587.5;

/**
 * Approximate lunar phase and illuminated fraction.
 * Presented in the interface as an approximation, never as an ephemeris value.
 * @param {Date} date
 */
export function moonPhase(date) {
  const elapsed = julianDate(date) - REFERENCE_NEW_MOON;
  const cycles = elapsed / SYNODIC_MONTH;
  const fraction = cycles - Math.floor(cycles);
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;

  let name = 'New moon';
  if (fraction < 0.02 || fraction > 0.98) name = 'New moon';
  else if (fraction < 0.23) name = 'Waxing crescent';
  else if (fraction < 0.27) name = 'First quarter';
  else if (fraction < 0.48) name = 'Waxing gibbous';
  else if (fraction < 0.52) name = 'Full moon';
  else if (fraction < 0.73) name = 'Waning gibbous';
  else if (fraction < 0.77) name = 'Last quarter';
  else name = 'Waning crescent';

  return { fraction, illumination, name, ageDays: fraction * SYNODIC_MONTH };
}
