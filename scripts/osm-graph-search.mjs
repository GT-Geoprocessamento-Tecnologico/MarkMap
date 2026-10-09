/**
 * A bounded fallback for SMALL regional OSM extracts.
 * It does not parse relations or legal/conditional access restrictions and
 * NEVER advertises car routing. Generated routing must be field-validated.
 */
import { readFile, stat } from 'node:fs/promises';
import { decodeOsmPbf } from './osm-pbf-pmtiles.mjs';
import { MAX_GRAPH_BYTES, MAX_GRAPH_NODES, MAX_GRAPH_EDGES, validateRegionalGraph } from '../packages/maps/src/routing/graph-format.mjs';

const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_AUTO_PLACES = 25_000;
const RADIANS = Math.PI / 180;
const BASIC_HIGHWAYS = new Set([
  'residential', 'living_street', 'service', 'unclassified', 'track', 'path',
  'footway', 'cycleway', 'pedestrian', 'steps', 'tertiary', 'tertiary_link',
  'secondary', 'secondary_link', 'primary', 'primary_link',
]);
const BICYCLE_DEFAULT = new Set([
  'residential', 'living_street', 'service', 'unclassified', 'track', 'path',
  'cycleway', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link',
  'primary', 'primary_link',
]);

function distanceM(a, b) {
  const dLat = (b[1] - a[1]) * RADIANS;
  const dLon = (b[0] - a[0]) * RADIANS;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RADIANS) * Math.cos(b[1] * RADIANS) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function inside(point, bounds) {
  return point && point[0] >= bounds[0] && point[0] <= bounds[2] &&
    point[1] >= bounds[1] && point[1] <= bounds[3];
}
function access(tags, profile, highway) {
  const key = profile === 'walk' ? 'foot' : 'bicycle';
  const rule = tags[key];
  if (rule === 'no' || rule === 'private') return false;
  if (rule === 'yes' || rule === 'designated' || rule === 'permissive') return true;
  if (tags.access === 'no' || tags.access === 'private') return false;
  // Conditional, motorized-only and jurisdiction-specific cases are not inferred.
  if (tags[`${key}:conditional`] || tags['access:conditional']) return false;
  if (!BASIC_HIGHWAYS.has(highway)) return false;
  return profile === 'walk' ? true : BICYCLE_DEFAULT.has(highway);
}

export function makeSmallOsmGraph(state, { bounds, osmDataDate }) {
  const nodes = new Map();
  const edges = [];
  let walking = false;
  let cycling = false;
  for (const way of state.ways) {
    const tags = way.tags;
    const highway = tags.highway;
    if (!BASIC_HIGHWAYS.has(highway)) continue;
    const foot = access(tags, 'walk', highway) && !['no'].includes(tags['foot:forward']) &&
      !['no'].includes(tags['foot:backward']);
    const bicycle = access(tags, 'bicycle', highway) && !['no'].includes(tags['bicycle:forward']) &&
      !['no'].includes(tags['bicycle:backward']);
    if (!foot && !bicycle) continue;
    // Direction modifiers that our graph cannot model must not generate unsafe bicycle edges.
    const bikeDirection = tags['oneway:bicycle'];
    if (bicycle && !['yes', 'no', '-1', '1', undefined].includes(bikeDirection)) continue;
    const cycleOneway = bicycle && bikeDirection !== 'no' &&
      (bikeDirection === 'yes' || bikeDirection === '1' || bikeDirection === '-1' ||
       tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === '-1');
    const reverse = bikeDirection === '-1' ||
      (bikeDirection === undefined && tags.oneway === '-1');
    if (['yes', '1', '-1'].includes(tags['oneway:foot'])) continue;
    if (![undefined, 'yes', 'no', '1', '0', '-1'].includes(tags.oneway)) continue;
    for (let i = 1; i < way.refs.length; i++) {
      const fromId = way.refs[i - 1];
      const toId = way.refs[i];
      if (fromId === toId) continue;
      const a = state.nodes.get(fromId), b = state.nodes.get(toId);
      if (!inside(a, bounds) || !inside(b, bounds)) continue;
      const length = distanceM(a, b);
      if (!(length > 0) || length > 1_000_000) continue;
      if (edges.length >= MAX_GRAPH_EDGES || nodes.size + 2 > MAX_GRAPH_NODES) return null;
      nodes.set(fromId, a);
      nodes.set(toId, b);
      const forward = !reverse || !cycleOneway;
      edges.push({
        id: edges.length,
        from: forward ? fromId : toId,
        to: forward ? toId : fromId,
        distance: length, speedKph: 15, highwayType: highway,
        oneway: cycleOneway,
        access: { access: true, foot, bicycle, motor_vehicle: false },
        ...(typeof tags.name === 'string' && tags.name.length <= 160 ? { name: tags.name } : {}),
        ...(typeof tags.surface === 'string' && tags.surface.length <= 64 ? { surface: tags.surface } : {}),
        bridges: tags.bridge === 'yes', tunnels: tags.tunnel === 'yes',
      });
      walking ||= foot;
      cycling ||= bicycle;
    }
  }
  if (nodes.size < 2 || !edges.length || (!walking && !cycling)) return null;
  const profiles = [...(walking ? ['walk'] : []), ...(cycling ? ['bicycle'] : [])];
  const graph = {
    version: 'osm-walk-bike-v1', bounds, osmDataDate, profiles,
    nodes: [...nodes.entries()].map(([id, p]) => ({ id, lon: p[0], lat: p[1] })),
    edges, turnRestrictions: [],
  };
  const bytes = Buffer.byteLength(JSON.stringify(graph));
  if (bytes > MAX_GRAPH_BYTES) return null;
  validateRegionalGraph(graph, { bounds, osmDataDate });
  return graph;
}

export function makeSmallOsmPlaces(state, bounds) {
  const places = [];
  for (const point of state.points) {
    const { name, amenity, tourism, shop, place, natural } = point.tags;
    if (typeof name !== 'string' || !name.trim() || name.length > 200 || !inside(point.point, bounds)) continue;
    if (places.length >= MAX_AUTO_PLACES) break;
    const type = amenity ? 'amenity' : tourism ? 'tourism' : shop ? 'shop' : natural === 'peak' ? 'peak' : 'place';
    const category = amenity || tourism || shop || place || natural || 'other';
    if (String(category).length > 60 || !Number.isSafeInteger(point.id) || point.id < 0) continue;
    places.push({ id: `osm-node-${point.id}`, name, type, category,
      lon: point.point[0], lat: point.point[1] });
  }
  return places;
}

export async function buildSmallOsmAddons(path, metadata) {
  if ((await stat(path)).size > MAX_INPUT_BYTES) return null;
  const state = decodeOsmPbf(await readFile(path));
  return {
    graph: makeSmallOsmGraph(state, metadata),
    places: makeSmallOsmPlaces(state, metadata.bounds),
  };
}
