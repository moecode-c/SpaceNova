/**
 * Two-line element set construction and parsing helpers.
 *
 * IMPORTANT, and stated wherever these reach the interface: the element sets
 * built here are SYNTHETIC FIXTURES. They are format-valid and physically
 * plausible, with an epoch close to the current date so that propagation and
 * pass prediction behave exactly as they will in production, but the values are
 * generated locally and are not observations. Phase 2 replaces this module's
 * output with general-perturbation data fetched from Celestrak or Space-Track
 * (SRS B.3, B.5).
 */

import { EARTH_RADIUS_KM, MU_EARTH } from './sun.js';

/** Mod-10 checksum over a 68-character TLE line. Minus signs count as 1. */
export function tleChecksum(line) {
  let sum = 0;
  for (const ch of line.slice(0, 68)) {
    if (ch >= '0' && ch <= '9') sum += Number(ch);
    else if (ch === '-') sum += 1;
  }
  return sum % 10;
}

/** Right-align a fixed-point number into a fixed-width field. */
function field(value, width, decimals) {
  return value.toFixed(decimals).padStart(width, ' ');
}

/** TLE epoch field: two-digit year plus fractional day of year (14 chars). */
export function tleEpoch(date) {
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const dayOfYear = (date.getTime() - startOfYear) / 86400000 + 1;
  const yy = String(year % 100).padStart(2, '0');
  const ddd = dayOfYear.toFixed(8).padStart(12, '0');
  return `${yy}${ddd}`;
}

/** First derivative of mean motion field, e.g. " .00002182" (10 chars). */
function derivativeField(value) {
  const sign = value < 0 ? '-' : ' ';
  const digits = String(Math.round(Math.abs(value) * 1e8)).padStart(8, '0').slice(0, 8);
  return `${sign}.${digits}`;
}

/** Exponential field used by the second derivative and B*, e.g. " 12345-3" (8 chars). */
function exponentField(value) {
  if (!value) return ' 00000-0';
  const sign = value < 0 ? '-' : ' ';
  const abs = Math.abs(value);
  const exponent = Math.floor(Math.log10(abs)) + 1;
  const mantissa = Math.round((abs / 10 ** exponent) * 1e5);
  const expSign = exponent < 0 ? '-' : '+';
  return `${sign}${String(mantissa).padStart(5, '0').slice(0, 5)}${expSign}${Math.min(
    9,
    Math.abs(exponent),
  )}`;
}

/**
 * Build a format-valid TLE pair from Keplerian elements.
 * @param {object} e
 * @returns {{ line1: string, line2: string }}
 */
export function buildTle(e) {
  const n5 = String(e.noradId).padStart(5, '0').slice(0, 5);
  const intl = String(e.intlDes).padEnd(8, ' ').slice(0, 8);

  const l1Body =
    `1 ${n5}U ${intl} ${tleEpoch(e.epoch)} ` +
    `${derivativeField(e.ndot ?? 0)} ${exponentField(e.nddot ?? 0)} ` +
    `${exponentField(e.bstar ?? 0)} 0 ${String(e.elsetNumber ?? 999).padStart(4, ' ')}`;

  const l2Body =
    `2 ${n5} ${field(e.inclination, 8, 4)} ${field(e.raan, 8, 4)} ` +
    `${String(Math.round(e.eccentricity * 1e7)).padStart(7, '0').slice(0, 7)} ` +
    `${field(e.argPerigee, 8, 4)} ${field(e.meanAnomaly, 8, 4)} ` +
    `${field(e.meanMotion, 11, 8)}${String(e.revNumber ?? 1).padStart(5, ' ')}`;

  return {
    line1: `${l1Body}${tleChecksum(l1Body)}`,
    line2: `${l2Body}${tleChecksum(l2Body)}`,
  };
}

/** Mean motion in revolutions per day for a circular-ish orbit at a given altitude. */
export function meanMotionFromAltitude(altitudeKm) {
  const a = EARTH_RADIUS_KM + altitudeKm;
  const periodSeconds = 2 * Math.PI * Math.sqrt(a ** 3 / MU_EARTH);
  return 86400 / periodSeconds;
}

/** Semi-major axis in km from mean motion in revolutions per day. */
export function semiMajorAxis(meanMotion) {
  const periodSeconds = 86400 / meanMotion;
  return (MU_EARTH * (periodSeconds / (2 * Math.PI)) ** 2) ** (1 / 3);
}

/** Orbital period in minutes from mean motion in revolutions per day. */
export function periodMinutes(meanMotion) {
  return 1440 / meanMotion;
}

/** Apogee and perigee altitude in km from mean motion and eccentricity. */
export function apsides(meanMotion, eccentricity) {
  const a = semiMajorAxis(meanMotion);
  return {
    apogeeKm: a * (1 + eccentricity) - EARTH_RADIUS_KM,
    perigeeKm: a * (1 - eccentricity) - EARTH_RADIUS_KM,
  };
}

/** Read the epoch back out of a TLE line 1. */
export function epochFromLine1(line1) {
  const yy = Number(line1.slice(18, 20));
  const day = Number(line1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * 86400000);
}
