/**
 * Element-set freshness, SRS Appendix A.7.
 *
 * Every prediction in the product carries the band of the element set it came
 * from, and the engine refuses to propagate an expired set. This module is the
 * single place those bands are decided.
 */

import { DEFAULTS } from './defaults.js';

export const FRESHNESS = {
  fresh: {
    key: 'fresh',
    label: 'Fresh',
    tone: 'good',
    description: 'Epoch less than 24 hours old.',
  },
  usable: {
    key: 'usable',
    label: 'Usable',
    tone: 'primary',
    description: 'Epoch less than 7 days old. Predictions carry a growing error band.',
  },
  stale: {
    key: 'stale',
    label: 'Stale',
    tone: 'warn',
    description: 'Epoch 7 days old or more. Predictions are shown with a warning.',
  },
  expired: {
    key: 'expired',
    label: 'Expired',
    tone: 'bad',
    description: 'Beyond the propagation horizon. Predictions are refused.',
  },
};

/**
 * Classify an element set by the age of its epoch.
 * @param {Date|string} epoch
 * @param {Date} now
 * @param {typeof DEFAULTS} config
 */
export function freshnessOf(epoch, now = new Date(), config = DEFAULTS) {
  const ageHours = (now.getTime() - new Date(epoch).getTime()) / 3600000;
  const horizonHours = config.propagationHorizonDays * 24;

  let band = FRESHNESS.fresh;
  if (ageHours >= horizonHours) band = FRESHNESS.expired;
  else if (ageHours >= config.freshness.usableHours) band = FRESHNESS.stale;
  else if (ageHours >= config.freshness.freshHours) band = FRESHNESS.usable;

  return {
    ...band,
    ageHours,
    ageDays: ageHours / 24,
    usable: band.key !== 'expired',
    // A.7: an order-of-magnitude uncertainty band, not a covariance.
    estimatedErrorKm:
      config.positionErrorKmBase +
      Math.max(0, ageHours / 24) * config.positionErrorKmPerDay,
  };
}

/** 0..1 penalty term fed into the pass quality score. */
export function stalenessPenalty(freshness) {
  switch (freshness.key) {
    case 'fresh':
      return 0;
    case 'usable':
      return 0.25;
    case 'stale':
      return 0.7;
    default:
      return 1;
  }
}
