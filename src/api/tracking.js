/**
 * Live tracking (SRS module 4).
 *
 * These calls return element sets and metadata, not positions. Positions are
 * COMPUTED IN THE BROWSER from the element set, which is the requirement in
 * module 4: the tracker must not poll the server at display frame rate. The
 * useTracking hook propagates locally and the server is only asked for a fresh
 * element set when the cache time to live expires.
 */

import { db } from '../mock/db.js';
import { freshnessOf } from '../engine/freshness.js';
import { call, envelope, ApiError } from './client.js';

export const tracking = {
  /**
   * Element sets for the objects to be tracked, plus everything the client
   * needs to label the computed values.
   * @param {string[]} objectIds
   */
  elementSets(objectIds) {
    return call(() => {
      const store = db();
      const now = new Date();
      const rows = (objectIds ?? [])
        .map((id) => store.objectsById.get(id))
        .filter(Boolean)
        .map((o) => ({
          objectId: o.id,
          name: o.name,
          noradId: o.noradId,
          category: o.category,
          categoryLabel: o.categoryLabel,
          orbitClass: o.orbitClass,
          standardMagnitude: o.standardMagnitude,
          downlinkHz: o.downlinkHz,
          periodMinutes: o.periodMinutes,
          inclination: o.inclination,
          apogeeKm: o.apogeeKm,
          perigeeKm: o.perigeeKm,
          elementSet: o.elementSet,
          freshness: freshnessOf(o.elementSet.epoch, now),
        }));

      return envelope(rows, {
        source: 'fixture-catalogue',
        sourceLabel: 'Bundled fixture element sets',
        retrievedAt: store.builtAt.toISOString(),
        kind: 'fixture',
        note: 'Positions are computed in the browser from these element sets.',
      });
    }, { scale: 0.6 });
  },

  /** The objects shown on the tracker by default: bright, low and recognisable. */
  defaultSelection() {
    return call(() => {
      const preferred = ['station', 'science', 'earth-observation'];
      const rows = db()
        .objects.filter((o) => o.orbitClass === 'LEO' && preferred.includes(o.category))
        .slice(0, 8)
        .map((o) => o.id);
      return envelope(rows, { source: 'fixture-catalogue' });
    }, { scale: 0.3 });
  },

  /** Observer locations available for the look-up view. */
  locations() {
    return call(() => {
      const store = db();
      return envelope(store.locations, {
        source: 'fixture-user-data',
        sourceLabel: 'Saved observer locations',
        retrievedAt: store.builtAt.toISOString(),
      });
    }, { scale: 0.4 });
  },

  location(locationId) {
    return call(() => {
      const location = db().locations.find((l) => l.id === locationId);
      if (!location) throw new ApiError('Location not found.', { status: 404, code: 'not_found' });
      return envelope(location, { source: 'fixture-user-data' });
    }, { scale: 0.3 });
  },
};
