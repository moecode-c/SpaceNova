/**
 * Pass quality score, SRS Appendix A.8.
 *
 * Every term is normalised to 0..1 and the weights are renormalised over the
 * terms that are actually available, so a missing cloud-cover forecast lowers
 * the confidence rather than silently dragging the score down.
 */

import { DEFAULTS, qualityBand } from './defaults.js';
import { normalise, clamp } from '../lib/random.js';
import { stalenessPenalty } from './freshness.js';

/**
 * @param {object} pass
 * @param {number} pass.maxElevation Degrees.
 * @param {number} pass.durationSeconds
 * @param {string} pass.eclipseState
 * @param {number} pass.sunElevation Degrees at the observer.
 * @param {number|null} pass.magnitude
 * @param {number|null} pass.cloudCover 0..1, or null when unavailable.
 * @param {object} pass.freshness Result of freshnessOf().
 * @param {typeof DEFAULTS} [config]
 */
export function scorePass(pass, config = DEFAULTS) {
  const w = config.scoreWeights;
  const terms = [];

  // Elevation: a 10 degree pass is barely worth going outside for, 80 is overhead.
  terms.push({
    key: 'elevation',
    label: 'Maximum elevation',
    weight: w.elevation,
    value: normalise(pass.maxElevation, config.minElevationDeg, 80),
    detail: `${pass.maxElevation.toFixed(1)}°`,
  });

  // Duration: 2 minutes is short, 11 minutes is about as long as LEO gives you.
  terms.push({
    key: 'duration',
    label: 'Duration above threshold',
    weight: w.duration,
    value: normalise(pass.durationSeconds, 120, 660),
    detail: `${Math.round(pass.durationSeconds / 60)} min`,
  });

  // Illumination: sunlit and bright scores highest.
  const lit = pass.eclipseState === 'sunlit' ? 1 : pass.eclipseState === 'penumbra' ? 0.35 : 0;
  const brightness =
    pass.magnitude === null || pass.magnitude === undefined
      ? 0.5
      : 1 - normalise(pass.magnitude, -1, 7);
  terms.push({
    key: 'illumination',
    label: 'Illumination and brightness',
    weight: w.illumination,
    value: clamp(lit * (0.55 + 0.45 * brightness), 0, 1),
    detail: pass.eclipseState,
  });

  // Sky darkness and cloud. Cloud cover is omitted when the forecast is missing.
  const darkness = normalise(-pass.sunElevation, 6, 18);
  if (pass.cloudCover === null || pass.cloudCover === undefined) {
    terms.push({
      key: 'sky',
      label: 'Sky darkness',
      weight: w.sky,
      value: darkness,
      detail: 'Cloud forecast unavailable, darkness only',
      degraded: true,
    });
  } else {
    terms.push({
      key: 'sky',
      label: 'Sky darkness and cloud',
      weight: w.sky,
      value: clamp(darkness * (1 - pass.cloudCover), 0, 1),
      detail: `${Math.round(pass.cloudCover * 100)}% cloud`,
    });
  }

  // Freshness enters as a penalty on the whole prediction.
  const penalty = stalenessPenalty(pass.freshness ?? { key: 'fresh' });
  terms.push({
    key: 'freshness',
    label: 'Element-set confidence',
    weight: w.freshness,
    value: 1 - penalty,
    detail: pass.freshness?.label ?? 'Fresh',
  });

  const totalWeight = terms.reduce((sum, t) => sum + t.weight, 0) || 1;
  const score = clamp(
    terms.reduce((sum, t) => sum + (t.weight / totalWeight) * t.value, 0),
    0,
    1,
  );

  return {
    score,
    band: qualityBand(score),
    terms: terms.map((t) => ({ ...t, contribution: (t.weight / totalWeight) * t.value })),
    degraded: terms.some((t) => t.degraded),
  };
}

/**
 * Scheduling conflict resolution, SRS Appendix A.9.
 *
 * Windows are sorted by score; a window that overlaps an already-kept window,
 * or falls inside its turnaround gap, is dropped and told why.
 *
 * @param {Array<{aos: Date|string, los: Date|string, score: number}>} windows
 * @param {typeof DEFAULTS} [config]
 */
export function resolveConflicts(windows, config = DEFAULTS) {
  const gapMs = config.turnaroundMinutes * 60000;
  const ranked = [...windows].sort((a, b) => b.score - a.score);
  const kept = [];
  const dropped = [];

  for (const w of ranked) {
    const aos = new Date(w.aos).getTime();
    const los = new Date(w.los).getTime();
    const clash = kept.find((k) => {
      const kAos = new Date(k.aos).getTime();
      const kLos = new Date(k.los).getTime();
      return aos < kLos + gapMs && los + gapMs > kAos;
    });
    if (clash) {
      dropped.push({
        ...w,
        droppedFor: clash,
        reason: `Overlaps a higher-scoring window, or falls inside the ${config.turnaroundMinutes} minute turnaround gap`,
      });
    } else {
      kept.push(w);
    }
  }

  kept.sort((a, b) => new Date(a.aos) - new Date(b.aos));
  dropped.sort((a, b) => new Date(a.aos) - new Date(b.aos));
  return { kept, dropped };
}
