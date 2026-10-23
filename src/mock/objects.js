/**
 * Builds the catalog records the application consumes from the seed tuples.
 *
 * Element sets are generated here. The right ascension of the ascending node is
 * drawn relative to the Sun's current right ascension, clustered around the two
 * terminator planes, because that is the geometry in which a satellite is lit
 * while the observer is in darkness. Real catalogues contain many dawn/dusk
 * orbits for the same reason, and it means the planner has genuinely visible
 * passes to rank rather than a list of rejections.
 */

import { OBJECT_SEED, CATEGORY_LABELS } from './seed-objects.js';
import { buildTle, meanMotionFromAltitude, apsides, periodMinutes, semiMajorAxis } from '../engine/tle.js';
import { sunPosition, RAD } from '../engine/sun.js';
import { rng, clamp, slug } from '../lib/random.js';

/** LEO / MEO / GEO / HEO from the orbit geometry. */
function orbitClass(apogeeKm, perigeeKm, inclination) {
  if (apogeeKm / Math.max(perigeeKm, 1) > 1.3 && apogeeKm > 25000) return 'HEO';
  if (apogeeKm > 34000 && Math.abs(inclination) < 5) return 'GEO';
  if (apogeeKm > 34000) return 'HEO';
  if (apogeeKm > 2000) return 'MEO';
  return 'LEO';
}

/** Drag term scaled off perigee altitude; negligible above roughly 900 km. */
function bstarFor(perigeeKm, random) {
  if (perigeeKm > 1100) return random.range(1e-6, 8e-6);
  const base = Math.exp((420 - perigeeKm) / 90) * 1.1e-4;
  return clamp(base * random.range(0.5, 1.8), 2e-6, 4e-3);
}

/**
 * Build one element set for an object at a given epoch.
 * @param {object} spec
 * @param {Date} epoch
 * @param {number} sunRaDeg
 * @param {ReturnType<typeof rng>} random
 * @param {number} setNumber
 */
function makeElementSet(spec, epoch, sunRaDeg, random, setNumber) {
  // Cluster the node around the dawn and dusk terminator planes.
  const towardsDusk = random.bool(0.55);
  const nodeOffset = (towardsDusk ? 90 : 270) + random.gauss(0, 34);
  const raan = ((sunRaDeg + nodeOffset) % 360 + 360) % 360;

  const meanMotion = meanMotionFromAltitude(spec.altitudeKm);
  const { apogeeKm, perigeeKm } = apsides(meanMotion, spec.eccentricity);

  const elements = {
    noradId: spec.noradId,
    intlDes: spec.intlDes.replace('-', '').slice(0, 8),
    epoch,
    inclination: spec.inclinationDeg,
    raan,
    eccentricity: spec.eccentricity,
    argPerigee: random.range(0, 360),
    meanAnomaly: random.range(0, 360),
    meanMotion,
    bstar: bstarFor(perigeeKm, random),
    ndot: bstarFor(perigeeKm, random) * 0.2,
    revNumber: random.int(1000, 48000),
    elsetNumber: setNumber,
  };

  const { line1, line2 } = buildTle(elements);

  return {
    id: `es-${spec.noradId}-${setNumber}`,
    noradId: spec.noradId,
    epoch: epoch.toISOString(),
    line1,
    line2,
    elsetNumber: setNumber,
    source: 'fixture',
    sourceLabel: 'Bundled fixture',
    inclination: elements.inclination,
    raan: elements.raan,
    eccentricity: elements.eccentricity,
    argPerigee: elements.argPerigee,
    meanAnomaly: elements.meanAnomaly,
    meanMotion: elements.meanMotion,
    bstar: elements.bstar,
    revNumber: elements.revNumber,
    apogeeKm,
    perigeeKm,
    semiMajorAxisKm: semiMajorAxis(meanMotion),
    periodMinutes: periodMinutes(meanMotion),
  };
}

/**
 * Build the whole catalogue.
 * @param {Date} now
 * @returns {Array<object>}
 */
export function buildObjects(now = new Date()) {
  const sunRaDeg = ((sunPosition(now).ra * RAD) % 360 + 360) % 360;

  return OBJECT_SEED.map((row, index) => {
    const [
      name, noradId, intlDes, category, type, operator, country,
      launched, altitudeKm, inclinationDeg, eccentricity,
      standardMagnitude, massKg, rcsM2, bands,
    ] = row;

    const random = rng(`object-${noradId}`);
    const spec = { noradId, intlDes, altitudeKm, inclinationDeg, eccentricity };

    // Freshest set first, then a history going back a fortnight. One object in
    // eight is deliberately left stale so the freshness banding is visible in
    // the interface rather than being a rule nobody ever sees fire.
    const stale = index % 8 === 3;
    const latestAgeHours = stale ? random.range(190, 260) : random.range(1.5, 20);

    const historyAges = [latestAgeHours, 34, 58, 86, 124, 168, 232, 310];
    const sets = historyAges.map((hours, i) =>
      makeElementSet(
        spec,
        new Date(now.getTime() - hours * 3600000),
        sunRaDeg,
        rng(`${noradId}-set-${i}`),
        9900 - i,
      ),
    );
    const elementSet = sets[0];

    const { apogeeKm, perigeeKm } = apsides(elementSet.meanMotion, eccentricity);

    return {
      id: slug(`${noradId}-${name}`),
      noradId,
      intlDes,
      name,
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category,
      type,
      operator,
      country,
      launchDate: launched,
      status: type === 'debris' ? 'inactive' : 'active',
      orbitClass: orbitClass(apogeeKm, perigeeKm, inclinationDeg),
      standardMagnitude,
      massKg,
      rcsM2,
      bands,
      // Rough downlink frequency per band, used by the Doppler readout.
      downlinkHz: bands.includes('UHF')
        ? 435_500_000
        : bands.includes('VHF')
          ? 145_900_000
          : bands.includes('S')
            ? 2_245_000_000
            : bands.includes('X')
              ? 8_212_000_000
              : bands.includes('Ku')
                ? 11_700_000_000
                : null,
      elementSet,
      elementSetHistory: sets,
      apogeeKm,
      perigeeKm,
      periodMinutes: elementSet.periodMinutes,
      inclination: inclinationDeg,
      eccentricity,
      dataSource: 'fixture-catalogue',
      trackable: true,
    };
  });
}

/** Group counts for the catalogue facets. */
export function facetCounts(objects) {
  const count = (key) =>
    objects.reduce((acc, o) => {
      acc[o[key]] = (acc[o[key]] ?? 0) + 1;
      return acc;
    }, {});
  return {
    category: count('category'),
    orbitClass: count('orbitClass'),
    country: count('country'),
    type: count('type'),
    status: count('status'),
  };
}
