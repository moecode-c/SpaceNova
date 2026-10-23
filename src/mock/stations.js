/**
 * Ground stations and their booked passes, Phase 1 fixtures.
 * Engineer-owned records per SRS section 2.5 and module 10.
 */

import { rng, slug } from '../lib/random.js';

const STATION_SEED = [
  ['Cairo Rooftop UHF', 'Cairo, Egypt', 30.0444, 31.2357, 23, ['UHF', 'VHF'], 'Yaesu G-5500 azimuth/elevation rotator with crossed Yagi pair', 8],
  ['Alexandria Coastal S-band', 'Alexandria, Egypt', 31.2001, 29.9187, 12, ['S'], '3.0 m parabolic dish, X/Y mount', 5],
  ['Delft Lab Dish', 'Delft, Netherlands', 52.0116, 4.3571, -2, ['S', 'X'], '4.5 m Cassegrain, cryogenic front end', 5],
  ['Tromso Polar Node', 'Tromsø, Norway', 69.6492, 18.9553, 102, ['S', 'X', 'Ka'], '7.3 m dish on a polar mount, radome enclosed', 3],
  ['Hartebeesthoek Relay', 'Gauteng, South Africa', -25.8897, 27.6854, 1416, ['S', 'X'], '12 m dish, shared aperture', 5],
  ['Kyoto Campus VHF', 'Kyoto, Japan', 35.0116, 135.7681, 56, ['VHF', 'UHF'], 'Cross-Yagi array with low-noise preamplifier', 10],
];

export function buildStations(users, now = new Date()) {
  const engineers = users.filter((u) => u.role === 'engineer' || u.role === 'admin');

  return STATION_SEED.map((row, i) => {
    const [name, location, latitude, longitude, altitudeM, bands, antenna, minElevation] = row;
    const random = rng(`station-${name}`);
    const owner = engineers[i % engineers.length];
    const health = i === 3 ? 'degraded' : i === 5 ? 'offline' : 'nominal';

    return {
      id: slug(name),
      name,
      location,
      latitude,
      longitude,
      altitudeM,
      bands,
      antenna,
      minElevationDeg: minElevation,
      ownerId: owner.id,
      ownerName: owner.name,
      health,
      healthNote:
        health === 'degraded'
          ? 'Elevation encoder drift of 0.4 degrees reported since the last calibration.'
          : health === 'offline'
            ? 'Rotator controller unreachable. Bookings are held rather than cancelled.'
            : 'All subsystems reporting nominal.',
      // A 36-slot horizon obstruction mask, one entry per 10 degrees of azimuth.
      horizonMask: Array.from({ length: 36 }, (_, slot) => {
        const azimuth = slot * 10;
        // A building to the north-east and a ridge to the south-west.
        const building = azimuth > 30 && azimuth < 80 ? random.range(6, 14) : 0;
        const ridge = azimuth > 200 && azimuth < 250 ? random.range(4, 9) : 0;
        return Math.round(Math.max(building, ridge, random.range(0, 2)) * 10) / 10;
      }),
      gainDbi: random.int(14, 58),
      noiseFigureDb: random.range(0.6, 2.4),
      slewRateDegPerSec: random.range(2.5, 9),
      turnaroundMinutes: random.int(1, 4),
      lastCalibratedAt: new Date(now.getTime() - random.range(2, 160) * 86400000).toISOString(),
      utilisation: random.range(0.18, 0.84),
      source: 'fixture-stations',
    };
  });
}

/**
 * Station bookings. Deliberately includes an overlapping pair so the
 * conflict-resolution rule in SRS A.9 has something to resolve on screen.
 */
export function buildBookings(stations, objects, now = new Date()) {
  const random = rng('bookings-v1');
  const bookings = [];
  const trackable = objects.filter((o) => o.orbitClass === 'LEO' && o.type === 'payload');

  stations.forEach((station, si) => {
    const count = random.int(4, 8);
    let cursorHours = random.range(1, 5);
    for (let i = 0; i < count; i += 1) {
      const object = trackable[(si * 7 + i * 3) % trackable.length];
      const durationMinutes = random.int(5, 12);
      const start = new Date(now.getTime() + cursorHours * 3600000);
      const end = new Date(start.getTime() + durationMinutes * 60000);

      const status = i === 0 && si === 0 ? 'conflict' : random.pick(['booked', 'booked', 'booked', 'tentative']);

      bookings.push({
        id: `bk-${station.id}-${i}`,
        stationId: station.id,
        stationName: station.name,
        objectId: object.id,
        objectName: object.name,
        noradId: object.noradId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        durationMinutes,
        maxElevationDeg: random.range(station.minElevationDeg + 4, 84),
        band: random.pick(station.bands),
        purpose: random.pick([
          'Telemetry downlink', 'Beacon capture', 'Doppler curve recording',
          'Antenna pointing check', 'Student exercise', 'Signal strength survey',
        ]),
        status,
        requestedBy: station.ownerName,
        createdAt: new Date(now.getTime() - random.range(1, 72) * 3600000).toISOString(),
      });

      // The first booking of the first station gets a deliberate overlap.
      if (i === 0 && si === 0) {
        const overlapStart = new Date(start.getTime() + 3 * 60000);
        bookings.push({
          id: `bk-${station.id}-overlap`,
          stationId: station.id,
          stationName: station.name,
          objectId: trackable[4].id,
          objectName: trackable[4].name,
          noradId: trackable[4].noradId,
          startsAt: overlapStart.toISOString(),
          endsAt: new Date(overlapStart.getTime() + 8 * 60000).toISOString(),
          durationMinutes: 8,
          maxElevationDeg: random.range(station.minElevationDeg + 2, 40),
          band: station.bands[0],
          purpose: 'Beacon capture',
          status: 'conflict',
          requestedBy: station.ownerName,
          createdAt: new Date(now.getTime() - 4 * 3600000).toISOString(),
        });
      }

      cursorHours += durationMinutes / 60 + random.range(1.5, 9);
    }
  });

  bookings.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  return bookings;
}

/**
 * Telemetry channel definitions.
 *
 * Every channel here is COMPUTED from propagation or read from a public feed.
 * The product never fabricates a subsystem reading, and the `provenance` field
 * is what the interface prints under each panel (SRS module 9 and 6.9).
 */
