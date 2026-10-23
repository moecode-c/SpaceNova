/**
 * Observer locations, observation plans and the observation log.
 * Phase 1 fixtures for SRS modules 5 and 14.
 */

import { rng, slug } from '../lib/random.js';

const LOCATION_SEED = [
  ['Cairo rooftop', 'Cairo, Egypt', 'Africa/Cairo', 30.0444, 31.2357, 23, 7.2, 'Primary site. Building to the north-east blocks up to fourteen degrees.'],
  ['Fayoum desert site', 'Fayoum, Egypt', 'Africa/Cairo', 29.3084, 30.8428, 29, 4.1, 'Dark site, roughly two hours from the city. Open horizon in every direction.'],
  ['Alexandria seafront', 'Alexandria, Egypt', 'Africa/Cairo', 31.2001, 29.9187, 12, 7.8, 'Sea horizon to the north, heavy light dome to the south.'],
  ['Saint Catherine highland', 'South Sinai, Egypt', 'Africa/Cairo', 28.5591, 33.9757, 1586, 2.6, 'High altitude, excellent transparency, ridge to the west.'],
  ['University observatory', 'Cairo, Egypt', 'Africa/Cairo', 30.0131, 31.2089, 41, 8.1, 'Campus dome. Fixed instrument, limited to above twenty degrees.'],
];

export function buildLocations(now = new Date()) {
  return LOCATION_SEED.map(([name, place, timezone, latitude, longitude, altitudeM, bortle, notes], i) => {
    const random = rng(`location-${name}`);
    return {
      id: slug(name),
      name,
      place,
      timezone,
      latitude,
      longitude,
      altitudeM,
      bortleClass: bortle,
      notes,
      isDefault: i === 0,
      minElevationDeg: i === 4 ? 20 : 10,
      horizonMask: Array.from({ length: 36 }, (_, slot) => {
        const azimuth = slot * 10;
        if (i === 0) {
          // City rooftop: a tall building to the north-east.
          return azimuth >= 30 && azimuth <= 80 ? Math.round(random.range(9, 14) * 10) / 10 : Math.round(random.range(0, 3) * 10) / 10;
        }
        if (i === 2) {
          // Seafront: clear to the north, buildings inland.
          return azimuth > 110 && azimuth < 250 ? Math.round(random.range(5, 11) * 10) / 10 : 0;
        }
        if (i === 3) {
          // Highland: a ridge to the west.
          return azimuth > 240 && azimuth < 300 ? Math.round(random.range(10, 19) * 10) / 10 : Math.round(random.range(0, 2) * 10) / 10;
        }
        if (i === 4) {
          return 20;
        }
        return Math.round(random.range(0, 1.5) * 10) / 10;
      }),
      createdAt: new Date(now.getTime() - random.range(10, 400) * 86400000).toISOString(),
      lastUsedAt: new Date(now.getTime() - random.range(0.2, 60) * 86400000).toISOString(),
    };
  });
}

/**
 * Observation plans.
 *
 * A plan names the objects it covers directly. There is no watchlist entity in
 * between any more, so the categories below are only a convenient way to seed
 * a believable selection.
 */
export function buildPlans(locations, objects, now = new Date()) {
  const random = rng('plans-v1');
  const seed = [
    ['Tonight from the rooftop', 0, ['station', 'science'], 0, 1],
    ['Fayoum weekend', 1, ['station', 'earth-observation', 'weather'], 2, 3],
    ['Amateur radio session', 0, ['amateur'], 1, 1],
    ['Decay study, week 6', 1, ['rocket-body', 'debris'], 0, 7],
  ];

  return seed.map(([name, locationIndex, categories, startOffsetDays, spanDays], i) => {
    const location = locations[locationIndex];
    const start = new Date(now.getTime() + startOffsetDays * 86400000);
    const pick = rng(`plan-objects-${name}`);
    const matching = objects.filter((o) => categories.includes(o.category));
    const chosen = pick.shuffle(matching).slice(0, Math.min(matching.length, pick.int(4, 9)));
    return {
      id: slug(name),
      name,
      locationId: location.id,
      locationName: location.name,
      objectIds: chosen.map((o) => o.id),
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + spanDays * 86400000).toISOString(),
      spanDays,
      minScore: [0.3, 0.5, 0.2, 0.0][i],
      visibleOnly: i !== 3,
      createdAt: new Date(now.getTime() - random.range(0.5, 20) * 86400000).toISOString(),
      status: i === 0 ? 'active' : 'draft',
      notes: [
        'Clear forecast. Set up by nine, start with the brightest window.',
        'Two nights at the dark site. Prioritise anything above fifty degrees.',
        'Rotator is calibrated. Record the Doppler curve for every pass over thirty degrees.',
        'Collect everything above the horizon, visible or not; the study needs the full set.',
      ][i],
    };
  });
}

const OUTCOMES = [
  ['observed', 'Observed', 'good'],
  ['observed', 'Observed', 'good'],
  ['observed', 'Observed', 'good'],
  ['clouded-out', 'Clouded out', 'warn'],
  ['missed', 'Missed', 'bad'],
  ['partial', 'Partially observed', 'warn'],
];

const LOG_NOTES = [
  'Picked it up two seconds later than predicted, bright and steady the whole way through.',
  'Faint and much harder than the magnitude estimate suggested. Possibly tumbling.',
  'Cloud came in from the west about four minutes before acquisition.',
  'Caught it through a gap in the building line. Only the last third of the pass was usable.',
  'Clean pass directly overhead. Visible to the naked eye at culmination.',
  'Entered eclipse earlier than expected, about halfway up.',
  'Slept through the alarm.',
  'Strong beacon on the first frame. Doppler curve recorded end to end.',
  'Rotator stalled at the elevation limit and lost the last minute.',
  'Brightened sharply near closest approach, then faded. Flat panel glint most likely.',
];

export function buildObservationLog(objects, locations, now = new Date()) {
  const random = rng('observations-v1');
  const candidates = objects.filter((o) => o.orbitClass === 'LEO' && o.type !== 'debris');

  return Array.from({ length: 26 }, (_, i) => {
    const object = candidates[(i * 5) % candidates.length];
    const location = locations[i % locations.length];
    const [outcome, outcomeLabel, tone] = random.pick(OUTCOMES);
    const at = new Date(now.getTime() - random.range(0.4, 120) * 86400000);
    const predictedMax = random.range(12, 82);

    return {
      id: `obs-${26 - i}`,
      objectId: object.id,
      objectName: object.name,
      noradId: object.noradId,
      locationId: location.id,
      locationName: location.name,
      observedAt: at.toISOString(),
      outcome,
      outcomeLabel,
      outcomeTone: tone,
      predictedMaxElevation: predictedMax,
      observedMaxElevation:
        outcome === 'observed' || outcome === 'partial'
          ? predictedMax + random.gauss(0, 1.4)
          : null,
      // The quantity the accuracy study is actually about.
      acquisitionErrorSeconds:
        outcome === 'observed' ? Math.round(random.gauss(0, 3.4) * 10) / 10 : null,
      estimatedMagnitude: random.range(-2.8, 5.6),
      reportedMagnitude:
        outcome === 'observed' ? Math.round((random.range(-2.4, 6.1)) * 10) / 10 : null,
      cloudCover: random.range(0, 1),
      seeing: random.pick(['excellent', 'good', 'fair', 'poor']),
      equipment: random.pick([
        'Naked eye', '10x50 binoculars', '8-inch Dobsonian',
        'UHF Yagi and SDR receiver', '80 mm refractor', 'DSLR on a tripod',
      ]),
      notes: random.pick(LOG_NOTES),
      elementSetAgeHours: random.range(1, 260),
      hasImage: random.bool(0.3),
    };
  }).sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt));
}
