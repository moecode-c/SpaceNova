/**
 * Space weather series, Phase 1 fixtures.
 *
 * Shapes and ranges follow the products the application will read from the
 * provider in SRS B.3 (planetary K index, solar wind plasma and magnetic
 * field, GOES X-ray flux, F10.7 and the sunspot number). Values are generated
 * locally and every panel that shows them carries a fixture source tag.
 */

import { rng, clamp } from '../lib/random.js';

export const KP_BANDS = [
  { max: 3.99, key: 'quiet', label: 'Quiet', tone: 'good', scale: null },
  { max: 4.99, key: 'unsettled', label: 'Unsettled', tone: 'primary', scale: null },
  { max: 5.99, key: 'minor', label: 'Minor storm', tone: 'warn', scale: 'G1' },
  { max: 6.99, key: 'moderate', label: 'Moderate storm', tone: 'warn', scale: 'G2' },
  { max: 7.99, key: 'strong', label: 'Strong storm', tone: 'bad', scale: 'G3' },
  { max: 8.99, key: 'severe', label: 'Severe storm', tone: 'bad', scale: 'G4' },
  { max: 99, key: 'extreme', label: 'Extreme storm', tone: 'bad', scale: 'G5' },
];

export function kpBand(kp) {
  return KP_BANDS.find((b) => kp <= b.max) ?? KP_BANDS[0];
}

export const XRAY_CLASSES = [
  { min: 1e-4, letter: 'X', tone: 'bad' },
  { min: 1e-5, letter: 'M', tone: 'warn' },
  { min: 1e-6, letter: 'C', tone: 'primary' },
  { min: 1e-7, letter: 'B', tone: 'good' },
  { min: 0, letter: 'A', tone: 'good' },
];

/** Flux in W/m^2 to the conventional letter-and-number class. */
export function xrayClass(flux) {
  const band = XRAY_CLASSES.find((b) => flux >= b.min) ?? XRAY_CLASSES[XRAY_CLASSES.length - 1];
  const magnitude = band.min > 0 ? flux / band.min : flux / 1e-8;
  return { letter: band.letter, value: magnitude, tone: band.tone, label: `${band.letter}${magnitude.toFixed(1)}` };
}

/**
 * @param {Date} now
 */
export function buildSpaceWeather(now = new Date()) {
  const random = rng('weather-v1');

  // A storm is seeded a little way into the past so the series has a feature in
  // it rather than drifting around a mean.
  const stormCentreHours = -14;
  const stormWidth = 9;
  const stormPeak = random.range(5.3, 7.1);

  const kpAt = (hours) => {
    const base = 1.8 + 0.9 * Math.sin((hours / 26) * Math.PI) + random.gauss(0, 0.35);
    const storm = stormPeak * Math.exp(-((hours - stormCentreHours) ** 2) / (2 * stormWidth ** 2));
    return clamp(Math.round((base + storm) * 3) / 3, 0, 9);
  };

  // Planetary K index, three-hourly, 72 hours back and 24 hours forward.
  const kpSeries = [];
  for (let h = -72; h <= 24; h += 3) {
    const kp = kpAt(h);
    kpSeries.push({
      t: new Date(now.getTime() + h * 3600000).toISOString(),
      kp,
      forecast: h > 0,
      band: kpBand(kp).key,
    });
  }

  // Solar wind, 15-minute cadence over 24 hours.
  const solarWind = [];
  for (let h = -24; h <= 0; h += 0.25) {
    const shock = Math.exp(-((h - stormCentreHours) ** 2) / (2 * 6 ** 2));
    solarWind.push({
      t: new Date(now.getTime() + h * 3600000).toISOString(),
      speedKms: clamp(380 + shock * 340 + random.gauss(0, 18), 260, 900),
      densityCm3: clamp(4.5 + shock * 9 + random.gauss(0, 1.1), 0.3, 30),
      bzNt: clamp(random.gauss(0, 2.4) - shock * 11, -28, 14),
      btNt: clamp(5 + shock * 14 + random.gauss(0, 1.4), 1, 36),
      temperatureK: clamp(90000 + shock * 320000 + random.gauss(0, 24000), 20000, 900000),
    });
  }

  // GOES X-ray flux, 2-minute cadence over 12 hours, with a couple of flares.
  const flareTimes = [-8.4, -3.1, -0.6];
  const xray = [];
  for (let h = -12; h <= 0; h += 1 / 30) {
    let flux = 1.6e-7 * (1 + 0.25 * Math.sin(h * 1.7)) * random.range(0.9, 1.12);
    flareTimes.forEach((ft, i) => {
      const dt = (h - ft) * 60; // minutes from the flare onset
      if (dt > 0) {
        const amplitude = [4.2e-5, 9.8e-6, 2.4e-6][i];
        // Fast rise, slow exponential decay.
        flux += amplitude * Math.exp(-dt / 14) * (1 - Math.exp(-dt / 2.5));
      }
    });
    xray.push({
      t: new Date(now.getTime() + h * 3600000).toISOString(),
      longFlux: flux,
      shortFlux: flux * random.range(0.09, 0.18),
    });
  }

  // F10.7 and sunspot number, daily over 60 days plus a 27-day outlook.
  const radio = [];
  for (let d = -60; d <= 27; d += 1) {
    const cycle = 142 + 26 * Math.sin((d / 27) * 2 * Math.PI) + random.gauss(0, 5);
    radio.push({
      t: new Date(now.getTime() + d * 86400000).toISOString(),
      f107: clamp(cycle, 68, 260),
      sunspotNumber: clamp(Math.round(cycle * 0.78 + random.gauss(0, 11)), 0, 320),
      forecast: d > 0,
    });
  }

  const flares = flareTimes
    .map((ft, i) => {
      const peakFlux = [4.2e-5, 9.8e-6, 2.4e-6][i];
      const cls = xrayClass(peakFlux);
      return {
        id: `flare-${i}`,
        class: cls.label,
        tone: cls.tone,
        peakFlux,
        beganAt: new Date(now.getTime() + (ft - 0.3) * 3600000).toISOString(),
        peakedAt: new Date(now.getTime() + ft * 3600000).toISOString(),
        endedAt: new Date(now.getTime() + (ft + 0.6) * 3600000).toISOString(),
        region: `AR${random.int(3850, 3999)}`,
        radioBlackout: cls.letter === 'X' ? 'R3' : cls.letter === 'M' ? 'R1' : null,
      };
    })
    .reverse();

  const cmes = Array.from({ length: 3 }, (_, i) => {
    const launched = new Date(now.getTime() - random.range(6, 70) * 3600000);
    const speed = random.int(420, 1850);
    return {
      id: `cme-${i}`,
      launchedAt: launched.toISOString(),
      speedKms: speed,
      halfAngleDeg: random.int(18, 62),
      type: speed > 1200 ? 'Halo' : random.pick(['Partial halo', 'Narrow', 'Partial halo']),
      earthDirected: random.bool(0.45),
      estimatedArrival: new Date(launched.getTime() + (1.5e6 / speed) * 3600000).toISOString(),
      source: 'fixture-donki',
    };
  });

  const latestKp = kpSeries.filter((p) => !p.forecast).at(-1);
  const latestWind = solarWind.at(-1);
  const latestXray = xray.at(-1);
  const latestRadio = radio.find((r) => r.forecast) ?? radio.at(-1);

  return {
    updatedAt: new Date(now.getTime() - random.range(2, 14) * 60000).toISOString(),
    source: 'fixture-swpc',
    current: {
      kp: latestKp.kp,
      kpBand: kpBand(latestKp.kp),
      solarWindSpeedKms: latestWind.speedKms,
      solarWindDensityCm3: latestWind.densityCm3,
      bzNt: latestWind.bzNt,
      btNt: latestWind.btNt,
      xrayFlux: latestXray.longFlux,
      xrayClass: xrayClass(latestXray.longFlux),
      f107: latestRadio.f107,
      sunspotNumber: latestRadio.sunspotNumber,
      auroraProbability: clamp(latestKp.kp / 9 + random.range(-0.08, 0.08), 0, 1),
      radiationStorm: random.pick([null, null, null, 'S1']),
    },
    kpSeries,
    solarWind,
    xray,
    radio,
    flares,
    cmes,
    outlook: Array.from({ length: 3 }, (_, d) => ({
      date: new Date(now.getTime() + (d + 1) * 86400000).toISOString(),
      maxKp: clamp(Math.round(kpAt(12 + d * 24) * 3) / 3, 0, 9),
      radioBlackoutRisk: random.int(5, 45),
      radiationStormRisk: random.int(1, 20),
      geomagneticStormRisk: random.int(10, 70),
    })),
  };
}

/**
 * Cloud-cover forecast for an observer location, used by the pass quality
 * score. Returns a lookup rather than a series so the engine can stay pure.
 *
 * @param {string} locationId
 * @param {Date} now
 */
export function buildCloudForecast(locationId, now = new Date()) {
  const random = rng(`cloud-${locationId}`);
  const points = [];
  for (let h = 0; h <= 10 * 24; h += 1) {
    const slow = 0.42 + 0.34 * Math.sin((h / 38) * Math.PI + random.range(0, 3));
    points.push({
      t: now.getTime() + h * 3600000,
      cover: clamp(slow + random.gauss(0, 0.12), 0, 1),
      // Beyond the provider's horizon there is no forecast at all, which is the
      // degraded case the score has to cope with (SRS A.8).
      available: h <= 7 * 24,
    });
  }

  return {
    points,
    /** @param {Date|string} date */
    at(date) {
      const t = new Date(date).getTime();
      let closest = null;
      let best = Infinity;
      for (const p of points) {
        const d = Math.abs(p.t - t);
        if (d < best) {
          best = d;
          closest = p;
        }
      }
      if (!closest || !closest.available) return null;
      return closest.cover;
    },
  };
}
