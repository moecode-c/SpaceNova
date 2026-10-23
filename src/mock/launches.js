/**
 * Launch schedule and mission records, Phase 1 fixtures.
 * Phase 2 reads these from the Launch Library provider described in SRS B.3.
 */

import { rng, slug } from '../lib/random.js';

const PROVIDERS = [
  ['SpaceX', 'United States', ['Falcon 9 Block 5', 'Falcon Heavy', 'Starship']],
  ['Rocket Lab', 'United States', ['Electron', 'Neutron']],
  ['Arianespace', 'Europe', ['Ariane 6', 'Vega C']],
  ['United Launch Alliance', 'United States', ['Atlas V 541', 'Vulcan Centaur']],
  ['Roscosmos', 'Russia', ['Soyuz-2.1a', 'Soyuz-2.1b', 'Angara A5']],
  ['CASC', 'China', ['Long March 2D', 'Long March 5B', 'Long March 7A']],
  ['ISRO', 'India', ['PSLV-XL', 'GSLV Mk III', 'SSLV']],
  ['JAXA', 'Japan', ['H3-22', 'Epsilon S']],
  ['Blue Origin', 'United States', ['New Glenn']],
];

const PADS = [
  ['SLC-40', 'Cape Canaveral SFS, Florida', 28.5618, -80.5772],
  ['LC-39A', 'Kennedy Space Center, Florida', 28.6084, -80.6043],
  ['SLC-4E', 'Vandenberg SFB, California', 34.632, -120.611],
  ['LC-1B', 'Mahia Peninsula, New Zealand', -39.2614, 177.8649],
  ['ELA-4', 'Kourou, French Guiana', 5.2567, -52.7644],
  ['Site 31/6', 'Baikonur Cosmodrome, Kazakhstan', 45.996, 63.564],
  ['LC-101', 'Wenchang, Hainan', 19.6144, 110.9512],
  ['SLP', 'Satish Dhawan SHAR, India', 13.7199, 80.2304],
  ['LA-Y2', 'Tanegashima, Japan', 30.374, 130.9699],
];

const PAYLOADS = [
  ['Starlink Group 11-24', 'communications', 'LEO', 'Twenty-four broadband satellites for the operator constellation.'],
  ['Transporter-14', 'rideshare', 'SSO', 'Dedicated smallsat rideshare carrying 68 payloads for 21 customers.'],
  ['Sentinel-4A', 'earth-observation', 'GEO', 'Geostationary atmospheric chemistry sounder for Copernicus.'],
  ['CRS-34', 'logistics', 'LEO', 'Commercial resupply flight to the International Space Station.'],
  ['GPS III SV09', 'navigation', 'MEO', 'Next-generation navigation satellite for the operational constellation.'],
  ['Shenzhou-22', 'crewed', 'LEO', 'Crew rotation flight to the national space station.'],
  ['Hera Follow-on', 'science', 'Heliocentric', 'Planetary defence follow-up mission to a binary asteroid system.'],
  ['NISAR-B', 'earth-observation', 'SSO', 'Dual-band synthetic aperture radar for surface deformation mapping.'],
  ['Kuiper Group 7', 'communications', 'LEO', 'Broadband constellation batch of thirty satellites.'],
  ['IMAP', 'science', 'L1', 'Heliophysics observatory for the interstellar boundary.'],
  ['Lunar Pathfinder-2', 'communications', 'Lunar', 'Lunar relay spacecraft supporting south-pole surface missions.'],
  ['EarthCARE-B', 'earth-observation', 'SSO', 'Cloud, aerosol and radiation explorer successor.'],
  ['Progress MS-32', 'logistics', 'LEO', 'Uncrewed cargo flight to the International Space Station.'],
  ['SWOT-2', 'earth-observation', 'LEO', 'Surface water and ocean topography continuity mission.'],
  ['Galileo G2-3', 'navigation', 'MEO', 'Second-generation navigation satellite pair.'],
  ['XRISM-B', 'science', 'LEO', 'X-ray imaging and spectroscopy follow-on observatory.'],
  ['Haven-1', 'commercial-station', 'LEO', 'Free-flying commercial habitat demonstrator.'],
  ['Chandrayaan-4', 'science', 'Lunar', 'Lunar sample return demonstration.'],
  ['MTG-S1', 'weather', 'GEO', 'Meteosat third generation sounder.'],
  ['Starlink Group 9-18', 'communications', 'LEO', 'Twenty-two broadband satellites, polar shell.'],
  ['Cygnus NG-24', 'logistics', 'LEO', 'Pressurised cargo flight to the International Space Station.'],
  ['Biomass-2', 'earth-observation', 'SSO', 'P-band radar for forest biomass measurement.'],
];

const STATUSES = [
  ['go', 'Go for launch', 'good'],
  ['tbd', 'Date to be confirmed', 'warn'],
  ['hold', 'On hold', 'warn'],
  ['success', 'Launch successful', 'good'],
  ['partial', 'Partial failure', 'warn'],
  ['failure', 'Launch failure', 'bad'],
];

/**
 * @param {Date} now
 * @returns {Array<object>} Launches sorted by net launch time.
 */
export function buildLaunches(now = new Date()) {
  const random = rng('launches-v1');
  const launches = [];

  // Fourteen upcoming, eighteen past.
  for (let i = 0; i < 32; i += 1) {
    const upcoming = i < 14;
    const [provider, providerCountry, vehicles] = random.pick(PROVIDERS);
    const vehicle = random.pick(vehicles);
    const [padName, padLocation, padLat, padLon] = random.pick(PADS);
    const [payloadName, payloadKind, destination, description] = PAYLOADS[i % PAYLOADS.length];

    const offsetHours = upcoming
      ? random.range(4, 92 * 24)
      : -random.range(6, 150 * 24);
    const net = new Date(now.getTime() + offsetHours * 3600000);

    const status = upcoming
      ? random.pick([STATUSES[0], STATUSES[0], STATUSES[1], STATUSES[2]])
      : random.pick([STATUSES[3], STATUSES[3], STATUSES[3], STATUSES[3], STATUSES[4], STATUSES[5]]);

    const windowMinutes = status[0] === 'tbd' ? null : random.pick([0, 0, 15, 30, 60, 120]);

    launches.push({
      id: slug(`${payloadName}-${i}`),
      name: `${vehicle} | ${payloadName}`,
      payloadName,
      payloadKind,
      description,
      provider,
      providerCountry,
      vehicle,
      padName,
      padLocation,
      padLatitude: padLat,
      padLongitude: padLon,
      net: net.toISOString(),
      windowMinutes,
      windowOpen: net.toISOString(),
      windowClose: windowMinutes
        ? new Date(net.getTime() + windowMinutes * 60000).toISOString()
        : null,
      destination,
      statusKey: status[0],
      statusLabel: status[1],
      statusTone: status[2],
      upcoming,
      probability: upcoming ? random.int(55, 95) : null,
      payloadMassKg: random.int(140, 17400),
      reused: random.bool(0.6),
      webcast: upcoming && random.bool(0.7),
      orbitTargetKm: random.int(320, 35786),
      updatedAt: new Date(now.getTime() - random.range(0.2, 18) * 3600000).toISOString(),
      source: 'fixture-launch-library',
    });
  }

  launches.sort((a, b) => new Date(a.net) - new Date(b.net));

  return launches;
}
