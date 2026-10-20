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

function normalizePostalCode(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !/^[0-9][0-9 .-]*$/.test(trimmed)) return null;
  const digits = trimmed.replace(/[\- .]/g, '');
  return /^\d{8}$/.test(digits) ? digits : null;
}

function postalCodes(tags) {
  const values = [tags['addr:postcode'], tags.postcode, tags.postal_code, tags.postalcode, tags.cep];
  return [...new Set(values.map(normalizePostalCode).filter(Boolean))].slice(0, 16);
}

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
  // Exclude incomplete/conditional legal access rather than guess the local rule.
  if (tags.area === 'yes' || tags.indoor === 'yes' || tags.construction ||
      tags.proposed || tags.disused === 'yes' || tags.abandoned === 'yes' ||
      tags['oneway:conditional'] || tags['access:forward'] || tags['access:backward'] ||
      tags['foot:conditional'] || tags['bicycle:conditional'] ||
      tags['vehicle:conditional'] || tags['access:conditional']) return false;
  // Driveways/parking aisles and restricted access are not through-route shortcuts.
  if (highway === 'service' && ['driveway', 'parking_aisle', 'private'].includes(tags.service)) return false;
  if (['destination', 'delivery', 'customers', 'agricultural', 'forestry'].includes(tags.access)) return false;
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
    let bicycle = access(tags, 'bicycle', highway) && !['no'].includes(tags['bicycle:forward']) &&
      !['no'].includes(tags['bicycle:backward']);
    if (!foot && !bicycle) continue;
    // Direction modifiers that our graph cannot model must not generate unsafe bicycle edges.
    const bikeDirection = tags['oneway:bicycle'];
    if (bicycle && !['yes', 'no', '-1', '1', undefined].includes(bikeDirection)) bicycle = false;
    if (!foot && !bicycle) continue;
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
      const additionalNodes = Number(!nodes.has(fromId)) + Number(!nodes.has(toId));
      if (edges.length >= MAX_GRAPH_EDGES || nodes.size + additionalNodes > MAX_GRAPH_NODES) return null;
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
  const namedWays = state.ways.some((way) => {
    const tags = way.tags;
    return typeof tags.name === 'string' && tags.name.trim() &&
      (tags.highway || tags.waterway || tags.railway || tags.building || tags.landuse);
  });
  // Reserve some slots for named roads/paths so dense POI areas do not starve
  // street search. The unused slots return to POIs after processing ways.
  const firstPointBudget = namedWays ? MAX_AUTO_PLACES - 5_000 : MAX_AUTO_PLACES;
  let pointCursor = 0;

  function appendPoint(point) {
    const tags = point.tags;
    const placeName = typeof tags.name === 'string' ? tags.name.trim() : '';
    const street = typeof tags['addr:street'] === 'string' ? tags['addr:street'].trim() : '';
    const number = typeof tags['addr:housenumber'] === 'string' ? tags['addr:housenumber'].trim() : '';
    // An address label is derived only from actual OSM street + house-number tags.
    const address = street && street.length <= 160 && number && number.length <= 24
      ? `${street}, ${number}` : '';
    const name = placeName || address;
    if (!name || name.length > 200 || !inside(point.point, bounds) ||
        !Number.isSafeInteger(point.id) || point.id < 0) return;
    const type = placeName
      ? tags.amenity ? 'amenity' : tags.tourism ? 'tourism' : tags.shop ? 'shop' :
        tags.natural === 'peak' ? 'peak' : 'place'
      : 'address';
    const category = placeName
      ? (tags.amenity || tags.tourism || tags.shop || tags.place || tags.natural || 'other')
      : 'address';
    if (typeof category !== 'string' || category.length > 60) return;
    const codes = postalCodes(tags);
    places.push({ id: `osm-node-${point.id}`, name, type, category,
      lon: point.point[0], lat: point.point[1], ...(codes.length ? { postalCodes: codes } : {}) });
    if (placeName && address && address !== placeName && address.length <= 200 &&
        places.length < MAX_AUTO_PLACES) {
      places.push({ id: `osm-address-node-${point.id}`, name: address,
        type: 'address', category: 'address', lon: point.point[0], lat: point.point[1], ...(codes.length ? { postalCodes: codes } : {}) });
    }
  }

  while (pointCursor < state.points.length && places.length < firstPointBudget) {
    appendPoint(state.points[pointCursor++]);
  }

  for (const way of state.ways) {
    if (places.length >= MAX_AUTO_PLACES) break;
    const { tags, refs, id } = way;
    const name = typeof tags.name === 'string' ? tags.name.trim() : '';
    if (!name || name.length > 200 || !Number.isSafeInteger(id) || id < 0) continue;
    const type = tags.highway ? 'street' : tags.waterway ? 'waterway' :
      tags.railway ? 'railway' : tags.building ? 'building' : tags.landuse ? 'landuse' : '';
    const category = tags.highway || tags.waterway || tags.railway || tags.building || tags.landuse;
    if (!type || typeof category !== 'string' || category.length > 60) continue;

    // Use an actual way vertex closest to its midpoint; never synthesize an address
    // or claim a precise centroid for a possibly curved/fragmented geometry.
    const middle = (refs.length - 1) / 2;
    let best = null;
    let bestDelta = Infinity;
    for (let i = 0; i < refs.length; i++) {
      const point = state.nodes.get(refs[i]);
      if (inside(point, bounds) && Math.abs(i - middle) < bestDelta) {
        best = point;
        bestDelta = Math.abs(i - middle);
      }
    }
    if (!best) continue;
    const codes = postalCodes(tags);
    places.push({ id: `osm-way-${id}`, name, type, category,
      lon: best[0], lat: best[1], ...(codes.length ? { postalCodes: codes } : {}) });
  }

  while (pointCursor < state.points.length && places.length < MAX_AUTO_PLACES) {
    appendPoint(state.points[pointCursor++]);
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
