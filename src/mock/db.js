/**
 * The in-memory fixture store.
 *
 * Built once per page load from the seed modules, then mutated in place by the
 * api/* modules so that saving a vehicle design or logging an observation
 * behaves the way it will against a real server. Nothing is persisted: a reload returns
 * to the seeded state, which is deliberate for Phase 1.
 */

import { buildObjects, facetCounts } from './objects.js';
import { buildLaunches } from './launches.js';
import { buildSpaceWeather, buildCloudForecast } from './weather.js';
import { buildUsers } from './people.js';
import { buildStations, buildBookings } from './stations.js';
import { buildWorkspaces } from './research.js';
import { buildVehicleDesigns } from './vehicles.js';
import { buildDataSources, buildAuditLog } from './ops.js';
import { buildLocations, buildPlans, buildObservationLog } from './user-data.js';
import { DEFAULTS } from '../engine/defaults.js';

function build() {
  const now = new Date();

  const objects = buildObjects(now);
  const launches = buildLaunches(now);
  const spaceWeather = buildSpaceWeather(now);
  const users = buildUsers(now);
  const stations = buildStations(users, now);
  const bookings = buildBookings(stations, objects, now);
  const workspaces = buildWorkspaces(users, objects, now);
  const dataSources = buildDataSources(now);
  const locations = buildLocations(now);
  const plans = buildPlans(locations, objects, now);
  const observations = buildObservationLog(objects, locations, now);
  const auditLog = buildAuditLog(users, now);

  const vehicleDesigns = buildVehicleDesigns(now);

  const cloudForecasts = new Map(
    locations.map((l) => [l.id, buildCloudForecast(l.id, now)]),
  );

  return {
    builtAt: now,
    objects,
    objectsById: new Map(objects.map((o) => [o.id, o])),
    objectsByNorad: new Map(objects.map((o) => [o.noradId, o])),
    facets: facetCounts(objects),
    launches,
    spaceWeather,
    users,
    stations,
    bookings,
    workspaces,
    dataSources,
    locations,
    plans,
    observations,
    auditLog,
    vehicleDesigns,
    cloudForecasts,
    // Editable copy of the engine thresholds, so the admin screen can change
    // them and every later computation picks the change up.
    settings: structuredClone(DEFAULTS),
  };
}

let instance = null;

/** The singleton store. */
export function db() {
  if (!instance) instance = build();
  return instance;
}

/** Rebuild from the seeds. Used by the "reset fixtures" action. */
export function resetDb() {
  instance = build();
  return instance;
}

/** Cloud-cover lookup for a location, or a null lookup when there is none. */
export function cloudForecastFor(locationId) {
  return db().cloudForecasts.get(locationId) ?? { at: () => null, points: [] };
}
