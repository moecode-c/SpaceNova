/**
 * Observer locations, observation plans and the observation log.
 *
 * Watchlists were removed: a plan now holds its object ids directly, which is
 * one entity fewer between choosing what to watch and getting a prediction.
 * The export-history screen went with them; the log and the profile each
 * download their own data where it is shown.
 */

import { db } from '../mock/db.js';
import { call, envelope, ApiError, paginate, comparator, matchesQuery } from './client.js';
import { slug } from '../lib/random.js';

export const locations = {
  list() {
    return call(() => envelope(db().locations, {
      source: 'fixture-user-data',
      sourceLabel: 'Saved observer locations',
    }), { scale: 0.4 });
  },

  create(payload) {
    return call(() => {
      const fields = {};
      if (!payload.name || payload.name.trim().length < 2) fields.name = 'Give the location a name.';
      const lat = Number(payload.latitude);
      const lon = Number(payload.longitude);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) fields.latitude = 'Latitude is between -90 and 90.';
      if (Number.isNaN(lon) || lon < -180 || lon > 180) fields.longitude = 'Longitude is between -180 and 180.';
      if (Object.keys(fields).length) {
        throw new ApiError('Check the details below.', { status: 422, code: 'validation', fields });
      }

      const store = db();
      const location = {
        id: slug(`${payload.name}-${Date.now()}`),
        name: payload.name.trim(),
        place: payload.place?.trim() ?? '',
        timezone: payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        latitude: lat,
        longitude: lon,
        altitudeM: Number(payload.altitudeM) || 0,
        bortleClass: Number(payload.bortleClass) || 5,
        notes: payload.notes?.trim() ?? '',
        isDefault: store.locations.length === 0,
        minElevationDeg: Number(payload.minElevationDeg) || store.settings.minElevationDeg,
        horizonMask: payload.horizonMask ?? new Array(36).fill(0),
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      };
      store.locations.push(location);
      store.cloudForecasts.set(location.id, store.cloudForecasts.get(store.locations[0].id));
      return envelope(location, { source: 'fixture-user-data' });
    });
  },

  update(locationId, patch) {
    return call(() => {
      const store = db();
      const location = store.locations.find((l) => l.id === locationId);
      if (!location) throw new ApiError('Location not found.', { status: 404, code: 'not_found' });
      if (patch.isDefault) store.locations.forEach((l) => { l.isDefault = false; });
      Object.assign(location, patch);
      return envelope(location, { source: 'fixture-user-data' });
    });
  },

  remove(locationId) {
    return call(() => {
      const store = db();
      const index = store.locations.findIndex((l) => l.id === locationId);
      if (index < 0) throw new ApiError('Location not found.', { status: 404, code: 'not_found' });
      if (store.locations.length === 1) {
        throw new ApiError('Keep at least one observer location.', { status: 409, code: 'conflict' });
      }
      const [removed] = store.locations.splice(index, 1);
      if (removed.isDefault && store.locations[0]) store.locations[0].isDefault = true;
      return envelope({ removed: true }, { source: 'fixture-user-data' });
    });
  },
};

export const plans = {
  list() {
    return call(() => envelope(db().plans, { source: 'fixture-user-data', sourceLabel: 'Saved observation plans' }), { scale: 0.4 });
  },

  get(planId) {
    return call(() => {
      const plan = db().plans.find((p) => p.id === planId);
      if (!plan) throw new ApiError('Plan not found.', { status: 404, code: 'not_found' });
      return envelope(plan, { source: 'fixture-user-data' });
    }, { scale: 0.3 });
  },

  create(payload) {
    return call(() => {
      const fields = {};
      if (!payload.name || payload.name.trim().length < 2) fields.name = 'Give the plan a name.';
      if (!payload.locationId) fields.locationId = 'Choose an observer location.';
      if (!payload.objectIds || payload.objectIds.length === 0) {
        fields.objectIds = 'Choose at least one object to watch.';
      }
      if (Object.keys(fields).length) {
        throw new ApiError('Check the details below.', { status: 422, code: 'validation', fields });
      }

      const store = db();
      const location = store.locations.find((l) => l.id === payload.locationId);
      const starts = payload.startsAt ? new Date(payload.startsAt) : new Date();
      const span = Number(payload.spanDays) || 1;
      const plan = {
        id: slug(`${payload.name}-${Date.now()}`),
        name: payload.name.trim(),
        locationId: location.id,
        locationName: location.name,
        objectIds: payload.objectIds,
        startsAt: starts.toISOString(),
        endsAt: new Date(starts.getTime() + span * 86400000).toISOString(),
        spanDays: span,
        minScore: Number(payload.minScore) || 0,
        visibleOnly: payload.visibleOnly ?? true,
        createdAt: new Date().toISOString(),
        status: 'draft',
        notes: payload.notes?.trim() ?? '',
      };
      store.plans.unshift(plan);
      return envelope(plan, { source: 'fixture-user-data' });
    });
  },

  update(planId, patch) {
    return call(() => {
      const plan = db().plans.find((p) => p.id === planId);
      if (!plan) throw new ApiError('Plan not found.', { status: 404, code: 'not_found' });
      Object.assign(plan, patch);
      return envelope(plan, { source: 'fixture-user-data' });
    });
  },

  remove(planId) {
    return call(() => {
      const store = db();
      const index = store.plans.findIndex((p) => p.id === planId);
      if (index < 0) throw new ApiError('Plan not found.', { status: 404, code: 'not_found' });
      store.plans.splice(index, 1);
      return envelope({ removed: true }, { source: 'fixture-user-data' });
    });
  },
};

export const observations = {
  list(query = {}) {
    return call(() => {
      const store = db();
      const { q, outcome, objectId, locationId, sort = 'observedAt', direction = 'desc', page = 1, pageSize = 20 } = query;

      let rows = store.observations.filter(
        (o) =>
          matchesQuery(o, q, ['objectName', 'locationName', 'notes', 'equipment']) &&
          (!outcome || outcome.length === 0 || outcome.includes(o.outcome)) &&
          (!objectId || o.objectId === objectId) &&
          (!locationId || o.locationId === locationId),
      );
      rows = rows.sort(comparator(sort, direction));

      const observed = store.observations.filter((o) => o.outcome === 'observed');
      const errors = observed.map((o) => o.acquisitionErrorSeconds).filter((v) => v !== null);
      const meanError = errors.length
        ? errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length
        : null;

      return envelope(
        {
          ...paginate(rows, { page, pageSize }),
          stats: {
            total: store.observations.length,
            observed: observed.length,
            successRate: store.observations.length ? observed.length / store.observations.length : 0,
            meanAbsoluteAcquisitionErrorSeconds: meanError,
          },
        },
        { source: 'fixture-user-data', sourceLabel: 'Observation log' },
      );
    });
  },

  create(payload) {
    return call(() => {
      const store = db();
      const object = store.objectsById.get(payload.objectId);
      if (!object) {
        throw new ApiError('Choose an object from the catalogue.', {
          status: 422, code: 'validation', fields: { objectId: 'Choose an object.' },
        });
      }
      const location = store.locations.find((l) => l.id === payload.locationId) ?? store.locations[0];
      const entry = {
        id: `obs-${Date.now()}`,
        objectId: object.id,
        objectName: object.name,
        noradId: object.noradId,
        locationId: location.id,
        locationName: location.name,
        observedAt: payload.observedAt ?? new Date().toISOString(),
        outcome: payload.outcome ?? 'observed',
        outcomeLabel:
          { observed: 'Observed', 'clouded-out': 'Clouded out', missed: 'Missed', partial: 'Partially observed' }[
            payload.outcome ?? 'observed'
          ],
        outcomeTone:
          { observed: 'good', 'clouded-out': 'warn', missed: 'bad', partial: 'warn' }[payload.outcome ?? 'observed'],
        predictedMaxElevation: Number(payload.predictedMaxElevation) || null,
        observedMaxElevation: Number(payload.observedMaxElevation) || null,
        acquisitionErrorSeconds:
          payload.acquisitionErrorSeconds === '' || payload.acquisitionErrorSeconds === undefined
            ? null
            : Number(payload.acquisitionErrorSeconds),
        estimatedMagnitude: Number(payload.estimatedMagnitude) || null,
        reportedMagnitude:
          payload.reportedMagnitude === '' || payload.reportedMagnitude === undefined
            ? null
            : Number(payload.reportedMagnitude),
        cloudCover: Number(payload.cloudCover) || 0,
        seeing: payload.seeing ?? 'good',
        equipment: payload.equipment ?? 'Naked eye',
        notes: payload.notes?.trim() ?? '',
        elementSetAgeHours: null,
        hasImage: false,
      };
      store.observations.unshift(entry);
      return envelope(entry, { source: 'fixture-user-data' });
    });
  },

  remove(observationId) {
    return call(() => {
      const store = db();
      const index = store.observations.findIndex((o) => o.id === observationId);
      if (index < 0) throw new ApiError('Entry not found.', { status: 404, code: 'not_found' });
      store.observations.splice(index, 1);
      return envelope({ removed: true }, { source: 'fixture-user-data' });
    });
  },
};
