/**
 * Space object catalog and search (SRS module 3), and the element-set history
 * the Engineer screens read (module 10).
 */

import { db } from '../mock/db.js';
import { freshnessOf } from '../engine/freshness.js';
import { call, envelope, ApiError, paginate, comparator, matchesQuery } from './client.js';

const SEARCH_FIELDS = ['name', 'intlDes', 'operator', 'country', 'categoryLabel'];

function decorate(object, now) {
  return {
    ...object,
    freshness: freshnessOf(object.elementSet.epoch, now),
  };
}

export const catalog = {
  /**
   * @param {object} query
   * @param {string} [query.q]
   * @param {string[]} [query.category]
   * @param {string[]} [query.orbitClass]
   * @param {string[]} [query.country]
   * @param {string[]} [query.type]
   * @param {string[]} [query.status]
   * @param {number} [query.perigeeMaxKm]
   * @param {number} [query.inclinationMin]
   * @param {string} [query.sort]
   * @param {'asc'|'desc'} [query.direction]
   */
  list(query = {}) {
    return call(() => {
      const store = db();
      const now = new Date();
      const {
        q, category, orbitClass, country, type, status,
        perigeeMaxKm, inclinationMin, objectIds,
        sort = 'name', direction = 'asc', page = 1, pageSize = 25,
      } = query;

      const inList = (list, value) => !list || list.length === 0 || list.includes(value);

      let rows = store.objects.filter(
        (o) =>
          matchesQuery({ ...o, noradId: String(o.noradId) }, q, [...SEARCH_FIELDS, 'noradId']) &&
          inList(category, o.category) &&
          inList(orbitClass, o.orbitClass) &&
          inList(country, o.country) &&
          inList(type, o.type) &&
          inList(status, o.status) &&
          (perigeeMaxKm === undefined || o.perigeeKm <= perigeeMaxKm) &&
          (inclinationMin === undefined || o.inclination >= inclinationMin) &&
          (!objectIds || objectIds.includes(o.id)),
      );

      rows = rows.map((o) => decorate(o, now)).sort(comparator(sort, direction));

      const result = paginate(rows, { page, pageSize });
      return envelope(result, {
        source: 'fixture-catalogue',
        sourceLabel: 'Bundled fixture catalogue',
        retrievedAt: store.builtAt.toISOString(),
        facets: store.facets,
        fixtureNotice:
          'Names and catalogue numbers are used for recognisability. All orbital elements are generated locally and are not observations.',
      });
    });
  },

  get(objectId) {
    return call(() => {
      const store = db();
      const object = store.objectsById.get(objectId);
      if (!object) throw new ApiError('Object not found in the catalogue.', { status: 404, code: 'not_found' });

      const now = new Date();
      const plans = store.plans.filter((plan) => plan.objectIds.includes(objectId));
      const observations = store.observations.filter((o) => o.objectId === objectId);

      return envelope(
        {
          ...decorate(object, now),
          plans: plans.map((plan) => ({ id: plan.id, name: plan.name, status: plan.status })),
          observationCount: observations.length,
          recentObservations: observations.slice(0, 5),
        },
        {
          source: 'fixture-catalogue',
          sourceLabel: 'Bundled fixture catalogue',
          retrievedAt: store.builtAt.toISOString(),
        },
      );
    });
  },

  /** Lightweight lookup for pickers. */
  suggest(q, limit = 12) {
    return call(() => {
      const rows = db()
        .objects.filter((o) => matchesQuery({ ...o, noradId: String(o.noradId) }, q, [...SEARCH_FIELDS, 'noradId']))
        .slice(0, limit)
        .map((o) => ({
          id: o.id,
          name: o.name,
          noradId: o.noradId,
          categoryLabel: o.categoryLabel,
          orbitClass: o.orbitClass,
        }));
      return envelope(rows, { source: 'fixture-catalogue' });
    }, { scale: 0.4 });
  },

  /**
   * Resolve a set of ids to the short records a selection chip needs.
   *
   * Used where a screen holds object ids and has to label them: the planner's
   * selection, a plan's object list. Unknown ids are dropped rather than
   * throwing, because a stored selection can outlive a catalogue entry.
   */
  byIds(objectIds = []) {
    return call(() => {
      const store = db();
      const rows = objectIds
        .map((id) => store.objectsById.get(id))
        .filter(Boolean)
        .map((o) => ({
          id: o.id,
          name: o.name,
          noradId: o.noradId,
          categoryLabel: o.categoryLabel,
          orbitClass: o.orbitClass,
        }));
      return envelope(rows, { source: 'fixture-catalogue' });
    }, { scale: 0.3 });
  },

  facets() {
    return call(() => envelope(db().facets, { source: 'fixture-catalogue' }), { scale: 0.3 });
  },

  /** Element-set history with freshness and the change against the previous set. */
  elementSets(objectId) {
    return call(() => {
      const store = db();
      const object = store.objectsById.get(objectId);
      if (!object) throw new ApiError('Object not found.', { status: 404, code: 'not_found' });
      const now = new Date();

      const rows = object.elementSetHistory.map((set, i) => {
        const previous = object.elementSetHistory[i + 1];
        return {
          ...set,
          freshness: freshnessOf(set.epoch, now),
          delta: previous
            ? {
                meanMotion: set.meanMotion - previous.meanMotion,
                inclination: set.inclination - previous.inclination,
                raan: set.raan - previous.raan,
                eccentricity: set.eccentricity - previous.eccentricity,
                bstar: set.bstar - previous.bstar,
                perigeeKm: set.perigeeKm - previous.perigeeKm,
                apogeeKm: set.apogeeKm - previous.apogeeKm,
              }
            : null,
        };
      });

      return envelope(
        { object: { id: object.id, name: object.name, noradId: object.noradId }, sets: rows },
        { source: 'fixture-catalogue', retrievedAt: store.builtAt.toISOString() },
      );
    });
  },
};
