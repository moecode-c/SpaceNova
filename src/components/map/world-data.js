/**
 * World geometry for the tracker.
 *
 * Bundled rather than fetched from a tile server: the map has to work offline,
 * it has to be drawn in the product's own palette rather than a basemap's, and
 * a vector outline is what a tracking display actually wants. The 110m
 * resolution is the right trade for a whole-world view.
 */

import { feature, mesh } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';
import { geoGraticule10 } from 'd3-geo';

export const LAND = feature(countries110m, countries110m.objects.countries);

/** Internal borders only, so coastlines are not drawn twice. */
export const BORDERS = mesh(
  countries110m,
  countries110m.objects.countries,
  (a, b) => a !== b,
);

export const GRATICULE = geoGraticule10();

export const SPHERE = { type: 'Sphere' };
