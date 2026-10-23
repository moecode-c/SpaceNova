/**
 * Engineering analysis, ground stations and vehicle design (SRS module 10).
 *
 * The residual figures compare a prediction made from an older element set
 * against the position given by the newest one. That is the honest version of
 * "how wrong does a stale element set make us", and it is the quantity the
 * freshness penalty in Appendix A.7 is calibrated against.
 */

import { db } from '../mock/db.js';
import { satrecFor, stateAt } from '../engine/propagate.js';
import { freshnessOf } from '../engine/freshness.js';
import { estimateDecay, DECAY_DISCLAIMER } from '../engine/decay.js';
import { analyseVehicle, DELTA_V_TARGETS } from '../engine/vehicle.js';
import { COMPONENTS, COMPONENT_KINDS, resolveStack } from '../mock/vehicles.js';
import { slug } from '../lib/random.js';
import { call, envelope, ApiError, comparator, matchesQuery, paginate } from './client.js';

/** Great-circle distance between two geodetic points, in km. */
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const engineering = {
  /** Element-set history with staleness diagnostics for one object. */
  diagnostics(objectId) {
    return call(() => {
      const store = db();
      const object = store.objectsById.get(objectId);
      if (!object) throw new ApiError('Object not found.', { status: 404, code: 'not_found' });

      const now = new Date();
      const reference = object.elementSetHistory[0];
      const referenceSatrec = satrecFor(reference.line1, reference.line2);
      const referenceState = stateAt(referenceSatrec, now);

      // Each older set is propagated to the same instant and compared with the
      // newest one, giving a position difference that grows with epoch age.
      const residuals = object.elementSetHistory.slice(1).map((set) => {
        const satrec = satrecFor(set.line1, set.line2);
        const state = stateAt(satrec, now);
        const freshness = freshnessOf(set.epoch, now);
        if (!state || !referenceState) {
          return { elementSetId: set.id, epoch: set.epoch, freshness, positionErrorKm: null };
        }
        const dx = state.eci.x - referenceState.eci.x;
        const dy = state.eci.y - referenceState.eci.y;
        const dz = state.eci.z - referenceState.eci.z;
        return {
          elementSetId: set.id,
          epoch: set.epoch,
          epochAgeHours: freshness.ageHours,
          freshness,
          positionErrorKm: Math.sqrt(dx * dx + dy * dy + dz * dz),
          groundErrorKm: haversine(
            state.latitude, state.longitude,
            referenceState.latitude, referenceState.longitude,
          ),
          altitudeErrorKm: state.altitudeKm - referenceState.altitudeKm,
          predictedBandKm: freshness.estimatedErrorKm,
        };
      });

      return envelope(
        {
          object: {
            id: object.id, name: object.name, noradId: object.noradId,
            intlDes: object.intlDes, orbitClass: object.orbitClass,
          },
          sets: object.elementSetHistory.map((set) => ({ ...set, freshness: freshnessOf(set.epoch, now) })),
          residuals,
          referenceSetId: reference.id,
          note:
            'Residuals compare each older element set against the newest one propagated to the same instant. ' +
            'They are an internal consistency measure, not a comparison against an independent ephemeris.',
        },
        { source: 'engine', sourceLabel: 'Computed by the propagation engine', kind: 'computed' },
      );
    }, { scale: 1.2 });
  },

  /** Decay and re-entry window estimates for the low-perigee part of the catalogue. */
  decay(query = {}) {
    return call(() => {
      const store = db();
      const now = new Date();
      const { f107, kp } = store.spaceWeather.current;
      const { q, status, sort = 'perigeeKm', direction = 'asc', page = 1, pageSize = 20 } = query;

      let rows = store.objects
        .map((object) => {
          const estimate = estimateDecay({
            meanMotion: object.elementSet.meanMotion,
            eccentricity: object.eccentricity,
            bstar: object.elementSet.bstar,
            f107,
            kp,
            now,
          });
          return {
            objectId: object.id,
            name: object.name,
            noradId: object.noradId,
            orbitClass: object.orbitClass,
            categoryLabel: object.categoryLabel,
            type: object.type,
            bstar: object.elementSet.bstar,
            freshness: freshnessOf(object.elementSet.epoch, now),
            ...estimate,
          };
        })
        .filter((r) => r.orbitClass === 'LEO')
        .filter((r) => matchesQuery(r, q, ['name', 'categoryLabel']))
        .filter((r) => !status || status.length === 0 || status.includes(r.status));

      rows = rows.sort(comparator(sort, direction));

      return envelope(
        {
          ...paginate(rows, { page, pageSize }),
          activity: { f107, kp },
          disclaimer: DECAY_DISCLAIMER,
        },
        { source: 'engine', sourceLabel: 'Computed by the decay model', kind: 'computed' },
      );
    }, { scale: 1.1 });
  },

  stations: {
    list() {
      return call(() => {
        const store = db();
        const rows = store.stations.map((s) => ({
          ...s,
          bookingCount: store.bookings.filter((b) => b.stationId === s.id).length,
          conflictCount: store.bookings.filter((b) => b.stationId === s.id && b.status === 'conflict').length,
        }));
        return envelope(rows, { source: 'fixture-stations', sourceLabel: 'Ground station register' });
      }, { scale: 0.5 });
    },

    get(stationId) {
      return call(() => {
        const store = db();
        const station = store.stations.find((s) => s.id === stationId);
        if (!station) throw new ApiError('Station not found.', { status: 404, code: 'not_found' });
        const bookings = store.bookings.filter((b) => b.stationId === stationId);
        return envelope({ station, bookings }, { source: 'fixture-stations' });
      });
    },

    update(stationId, patch) {
      return call(() => {
        const station = db().stations.find((s) => s.id === stationId);
        if (!station) throw new ApiError('Station not found.', { status: 404, code: 'not_found' });
        Object.assign(station, patch);
        return envelope(station, { source: 'fixture-stations' });
      });
    },

    book(payload) {
      return call(() => {
        const store = db();
        const station = store.stations.find((s) => s.id === payload.stationId);
        const object = store.objectsById.get(payload.objectId);
        if (!station || !object) {
          throw new ApiError('Choose a station and an object.', { status: 422, code: 'validation' });
        }
        const starts = new Date(payload.startsAt);
        const duration = Number(payload.durationMinutes) || 8;
        const booking = {
          id: `bk-${Date.now()}`,
          stationId: station.id,
          stationName: station.name,
          objectId: object.id,
          objectName: object.name,
          noradId: object.noradId,
          startsAt: starts.toISOString(),
          endsAt: new Date(starts.getTime() + duration * 60000).toISOString(),
          durationMinutes: duration,
          maxElevationDeg: Number(payload.maxElevationDeg) || station.minElevationDeg + 10,
          band: payload.band ?? station.bands[0],
          purpose: payload.purpose ?? 'Telemetry downlink',
          status: 'tentative',
          requestedBy: payload.requestedBy ?? station.ownerName,
          createdAt: new Date().toISOString(),
        };
        store.bookings.push(booking);
        store.bookings.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
        return envelope(booking, { source: 'fixture-stations' });
      });
    },

    cancelBooking(bookingId) {
      return call(() => {
        const store = db();
        const index = store.bookings.findIndex((b) => b.id === bookingId);
        if (index < 0) throw new ApiError('Booking not found.', { status: 404, code: 'not_found' });
        store.bookings.splice(index, 1);
        return envelope({ cancelled: true }, { source: 'fixture-stations' });
      });
    },
  },

  /**
   * Launch vehicle designs.
   *
   * A design stores component ids and counts; the analysis is recomputed from
   * engine/vehicle.js every time it is read, so a correction to a part's
   * published mass flows through to every design that uses it rather than
   * leaving stale numbers behind.
   */
  vehicles: {
    components() {
      return call(() => envelope(
        { components: COMPONENTS, kinds: COMPONENT_KINDS, targets: DELTA_V_TARGETS },
        {
          source: 'fixture-vehicles',
          sourceLabel: 'Component library, published specifications',
          note: 'Each component carries the document its figures come from.',
        },
      ), { scale: 0.4 });
    },

    list() {
      return call(() => {
        const rows = db().vehicleDesigns.map((design) => {
          const analysis = analyseVehicle(resolveStack(design.stack));
          return {
            id: design.id,
            name: design.name,
            notes: design.notes,
            partCount: design.stack.length,
            stageCount: analysis.stages.length,
            totalDeltaVMs: analysis.totalDeltaVMs,
            grossMassKg: analysis.grossMassKg,
            payloadMassKg: analysis.payloadMassKg,
            liftoffTwr: analysis.liftoffTwr,
            best: analysis.best,
            flyable: analysis.flyable,
            hasErrors: analysis.findings.some((f) => f.level === 'error'),
            createdAt: design.createdAt,
            updatedAt: design.updatedAt,
          };
        });
        return envelope(rows, { source: 'fixture-vehicles', sourceLabel: 'Saved vehicle designs' });
      }, { scale: 0.4 });
    },

    get(designId) {
      return call(() => {
        const design = db().vehicleDesigns.find((d) => d.id === designId);
        if (!design) throw new ApiError('Design not found.', { status: 404, code: 'not_found' });
        const parts = resolveStack(design.stack);
        return envelope(
          { design, parts, analysis: analyseVehicle(parts) },
          {
            source: 'engine',
            sourceLabel: 'Computed by the staging analysis',
            kind: 'computed',
          },
        );
      }, { scale: 0.5 });
    },

    save({ id, name, notes, stack }) {
      return call(() => {
        const store = db();
        if (!name || name.trim().length < 3) {
          throw new ApiError('Give the design a name.', {
            status: 422, code: 'validation', fields: { name: 'Give the design a name.' },
          });
        }
        if (!stack || stack.length === 0) {
          throw new ApiError('A design needs at least one component.', {
            status: 422, code: 'validation',
          });
        }
        const clean = stack.map((entry, i) => ({
          slotId: entry.slotId ?? `slot-${Date.now()}-${i}`,
          componentId: entry.componentId,
          count: Math.max(1, Math.round(entry.count ?? 1)),
        }));
        const now = new Date().toISOString();

        const existing = id ? store.vehicleDesigns.find((d) => d.id === id) : null;
        if (existing) {
          Object.assign(existing, { name: name.trim(), notes: notes ?? '', stack: clean, updatedAt: now });
          return envelope(existing, { source: 'fixture-vehicles' });
        }

        const design = {
          id: slug(`${name}-${Date.now()}`),
          name: name.trim(),
          notes: notes ?? '',
          stack: clean,
          createdAt: now,
          updatedAt: now,
        };
        store.vehicleDesigns.unshift(design);
        return envelope(design, { source: 'fixture-vehicles' });
      });
    },

    remove(designId) {
      return call(() => {
        const store = db();
        const index = store.vehicleDesigns.findIndex((d) => d.id === designId);
        if (index < 0) throw new ApiError('Design not found.', { status: 404, code: 'not_found' });
        store.vehicleDesigns.splice(index, 1);
        return envelope({ removed: true }, { source: 'fixture-vehicles' });
      });
    },
  },
};
