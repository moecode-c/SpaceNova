/**
 * The orbital engine, as specified in SRS Appendix A.
 *
 * Nothing in here touches React, the network or the fixtures: it is a set of
 * pure functions over (element set, time, observer, thresholds). That is what
 * makes the propagation, visibility and scoring rules unit-testable against
 * reference values, as section 6.7 requires, and it is what lets the same code
 * run in the browser now and on the Express server in Phase 2.
 */

export * from './defaults.js';
export * from './sun.js';
export * from './tle.js';
export * from './propagate.js';
export * from './freshness.js';
export * from './magnitude.js';
export * from './visibility.js';
export * from './score.js';
export * from './passes.js';
export * from './decay.js';
export * from './vehicle.js';
