/**
 * Deterministic pseudo-random helpers.
 *
 * The fixtures must look the same on every reload, otherwise charts jump and
 * screenshots never match. Everything seeds from a string so each generator is
 * reproducible and independent.
 */

/** xmur3 string hash -> 32-bit seed. */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * mulberry32 generator.
 * @param {string} seed
 * @returns {{ next: () => number, range: (a: number, b: number) => number,
 *   int: (a: number, b: number) => number, pick: <T>(arr: T[]) => T,
 *   bool: (p?: number) => boolean, gauss: (mean?: number, sd?: number) => number,
 *   shuffle: <T>(arr: T[]) => T[] }}
 */
export function rng(seed) {
  let a = hashSeed(String(seed))();
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (lo, hi) => lo + next() * (hi - lo);
  const int = (lo, hi) => Math.floor(range(lo, hi + 1));
  const pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))];
  const bool = (p = 0.5) => next() < p;
  const gauss = (mean = 0, sd = 1) => {
    // Box-Muller.
    const u = Math.max(next(), 1e-9);
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const shuffle = (arr) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, range, int, pick, bool, gauss, shuffle };
}

/** Clamp into a range. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Map a value from one range to 0..1, clamped. */
export const normalise = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);

/** Linear interpolation. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** A stable id from a label, for fixture rows. */
export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
