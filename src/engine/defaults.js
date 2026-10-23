/**
 * Default threshold values.
 *
 * Per SRS section 2.5 these are DATA, not code: an administrator edits them
 * from the Thresholds screen and nothing is rebuilt. The values below are the
 * initial estimates the team tunes against the validation in Appendix A.11, and
 * every screen that applies one says which value it used.
 */

export const DEFAULTS = {
  // A.4 pass detection
  minElevationDeg: 10,
  coarseStepSeconds: 30,
  refineToleranceSeconds: 1,

  // A.2 propagation
  propagationHorizonDays: 10,

  // A.5 visibility
  twilightThresholdDeg: -12, // nautical twilight
  requireIllumination: true,
  applyHorizonMask: true,

  // A.7 element-set freshness bands, in hours
  freshness: {
    freshHours: 24,
    usableHours: 24 * 7,
  },
  // Typical along-track error growth, used only to show an uncertainty band.
  positionErrorKmPerDay: 1.5,
  positionErrorKmBase: 1.0,

  // A.8 pass quality score weights. They are normalised before use, so these
  // are relative rather than required to sum to one.
  scoreWeights: {
    elevation: 0.34,
    duration: 0.2,
    illumination: 0.22,
    sky: 0.14,
    freshness: 0.1,
  },
  cloudCoverThreshold: 0.6,

  // A.9 scheduling
  turnaroundMinutes: 2,

  // Retention, section 6.6 and 6.9
  telemetryRetentionDays: 30,
  cacheTtlMinutes: { elementSets: 360, spaceWeather: 15, launches: 60, events: 1440 },
  degradedModeLimitHours: 48,
};

export const QUALITY_BANDS = [
  { key: 'excellent', label: 'Excellent', min: 0.78, tone: 'good' },
  { key: 'good', label: 'Good', min: 0.58, tone: 'primary' },
  { key: 'fair', label: 'Fair', min: 0.35, tone: 'warn' },
  { key: 'poor', label: 'Poor', min: 0, tone: 'bad' },
];

export function qualityBand(score) {
  return QUALITY_BANDS.find((b) => score >= b.min) ?? QUALITY_BANDS[QUALITY_BANDS.length - 1];
}

export const ORBIT_CLASSES = {
  LEO: { label: 'Low Earth orbit', short: 'LEO' },
  MEO: { label: 'Medium Earth orbit', short: 'MEO' },
  GEO: { label: 'Geostationary orbit', short: 'GEO' },
  HEO: { label: 'Highly elliptical orbit', short: 'HEO' },
};

export const OBJECT_TYPES = {
  payload: 'Payload',
  'rocket-body': 'Rocket body',
  debris: 'Debris',
  station: 'Space station',
};

export const PASS_STATUS = {
  predicted: 'Predicted',
  planned: 'Planned',
  observed: 'Observed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};
