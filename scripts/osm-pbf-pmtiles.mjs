/**
 * Small-region OSM PBF -> PMTiles v3 vector basemap.
 * Fully offline; no network, external binaries or runtime dependencies.
 * This bounded builder deliberately rejects very large inputs and unsupported
 * compression. It is not a planet-scale OSM renderer or relation processor.
 */
import { readFile, stat } from 'node:fs/promises';
import { gzipSync, inflateSync } from 'node:zlib';

const MAX_PBF_BYTES = 32 * 1024 * 1024;
const MAX_DECOMPRESSED_BLOB = 64 * 1024 * 1024;
const MAX_NODES = 250_000;
const MAX_WAYS = 40_000;
const MAX_REFS_PER_WAY = 4096;
const MAX_TILE_ASSIGNMENTS = 250_000;
const MAX_TILES = 5_000;
const MAX_TILES_PER_FEATURE_ZOOM = 64;
const EXTENT = 4096;
const LAYERS = ['landuse', 'water', 'buildings', 'roads', 'waterways', 'rail', 'pois', 'places'];
const encoder = new TextEncoder();

export class OsmTileError extends Error {
  constructor(message, code) { super(message); this.name = 'OsmTileError'; this.code = code; }
}

function assertBudget(condition, code, message) { if (!condition) throw new OsmTileError(message, code); }
function safeNumber(n) {
  const v = Number(n);
  assertBudget(Number.isSafeInteger(v), 'PBF_INTEGER', 'OSM PBF integer out of range');
  return v;
}
function unpackVarint(buffer, start) {
  let value = 0n; let shift = 0n;
  for (let i = start; i < buffer.length && i < start + 10; i++) {
    const part = buffer[i];
    value |= BigInt(part & 0x7f) << shift;
    if (!(part & 0x80)) return [value, i + 1];
    shift += 7n;
  }
  throw new OsmTileError('truncated or oversized protobuf varint', 'INVALID_PBF');
}
function signed(n) { return n & 1n ? -(n >> 1n) - 1n : n >> 1n; }
function fields(buffer, visitor) {
  let i = 0;
  while (i < buffer.length) {
    const [key, next] = unpackVarint(buffer, i); i = next;
    const tag = Number(key >> 3n); const wire = Number(key & 7n);
    assertBudget(tag > 0, 'INVALID_PBF', 'invalid protobuf field');
    if (wire === 0) {
      const [v, n] = unpackVarint(buffer, i); i = n; visitor(tag, wire, v);
    } else if (wire === 2) {
      const [len, n] = unpackVarint(buffer, i); i = n;
      const length = safeNumber(len);
      assertBudget(i + length <= buffer.length, 'INVALID_PBF', 'truncated protobuf length-delimited field');
      visitor(tag, wire, buffer.subarray(i, i + length)); i += length;
    } else if (wire === 1 || wire === 5) {
      const n = wire === 1 ? 8 : 4;
      assertBudget(i + n <= buffer.length, 'INVALID_PBF', 'truncated protobuf fixed-width field');
      i += n;
    } else {
      throw new OsmTileError(`unsupported protobuf wire type ${wire}`, 'INVALID_PBF');
    }
  }
}
function packed(buffer, signedZigzag = false) {
  const result = []; let i = 0;
  while (i < buffer.length) {
    const [raw, n] = unpackVarint(buffer, i); i = n;
    result.push(safeNumber(signedZigzag ? signed(raw) : raw));
  }
  return result;
}
function decodeBlobHeader(bytes) {
  let type = '', dataSize = -1;
  fields(bytes, (tag, wire, v) => {
    if (tag === 1 && wire === 2) type = v.toString('utf8');
    if (tag === 3 && wire === 0) dataSize = safeNumber(v);
  });
  assertBudget(dataSize > 0 && dataSize <= MAX_PBF_BYTES, 'INVALID_PBF', 'invalid OSM blob header size');
  return { type, dataSize };
}
function decodeBlob(bytes) {
  let raw, zipped, rawSize;
  fields(bytes, (tag, wire, v) => {
    if (tag === 1 && wire === 2) raw = v;
    if (tag === 2 && wire === 0) rawSize = safeNumber(v);
    if (tag === 3 && wire === 2) zipped = v;
  });
  assertBudget(rawSize === undefined || rawSize <= MAX_DECOMPRESSED_BLOB, 'BUDGET_EXCEEDED', 'OSM blob expands beyond memory limit');
  if (raw && !zipped) {
    assertBudget(raw.byteLength <= MAX_DECOMPRESSED_BLOB, 'BUDGET_EXCEEDED', 'OSM raw blob too large');
    return raw;
  }
  assertBudget(Boolean(zipped) && rawSize !== undefined, 'UNSUPPORTED_COMPRESSION', 'only raw and zlib OSM PBF blobs are supported');
  let decoded;
  try { decoded = inflateSync(zipped, { maxOutputLength: MAX_DECOMPRESSED_BLOB }); }
  catch { throw new OsmTileError('could not decompress OSM blob within limits', 'INVALID_PBF'); }
  assertBudget(decoded.length === rawSize, 'INVALID_PBF', 'OSM blob uncompressed byte length differs');
  return decoded;
}
function tagsFrom(keys, vals, strings) {
  const result = {};
  assertBudget(keys.length === vals.length, 'INVALID_PBF', 'mismatched OSM tags');
  for (let i = 0; i < keys.length; i++) {
    const key = strings[keys[i]], val = strings[vals[i]];
    assertBudget(typeof key === 'string' && typeof val === 'string', 'INVALID_PBF', 'invalid OSM string table reference');
    result[key] = val;
  }
  return result;
}
function parsePrimitiveBlock(data, state) {
  let strings = [], groups = [], granularity = 100, latOffset = 0, lonOffset = 0;
  fields(data, (tag, wire, value) => {
    if (tag === 1 && wire === 2) fields(value, (t, w, v) => { if (t === 1 && w === 2) strings.push(v.toString('utf8')); });
    if (tag === 2 && wire === 2) groups.push(value);
    if (tag === 17 && wire === 0) granularity = safeNumber(value);
    if (tag === 19 && wire === 0) latOffset = safeNumber(BigInt.asIntN(64, value));
    if (tag === 20 && wire === 0) lonOffset = safeNumber(BigInt.asIntN(64, value));
  });
  assertBudget(granularity > 0 && granularity <= 1_000_000, 'INVALID_PBF', 'invalid granularity');
  const coords = (lat, lon) => [ (lonOffset + granularity * lon) / 1e9, (latOffset + granularity * lat) / 1e9 ];
  const appendNode = (id, lat, lon, tag) => {
    assertBudget(state.nodes.size < MAX_NODES, 'BUDGET_EXCEEDED', 'node limit reached');
    const point = coords(lat, lon);
    if (point[0] < -180 || point[0] > 180 || point[1] < -85.051129 || point[1] > 85.051129) return;
    state.nodes.set(id, point);
    // Address-bearing OSM nodes are searchable even when they have no POI name.
    if (tag.amenity || tag.tourism || tag.shop || tag.place || tag.natural === 'peak' ||
        (tag['addr:street'] && tag['addr:housenumber']))
      state.points.push({ id, point, tags: tag });
  };
  for (const group of groups) {
    fields(group, (tag, wire, value) => {
      if (tag === 1 && wire === 2) {
        let id = 0, lat = 0, lon = 0, keys = [], vals = [];
        fields(value, (t, w, v) => {
          if (t === 1 && w === 0) id = safeNumber(signed(v));
          if (t === 2 && w === 2) keys = packed(v);
          if (t === 3 && w === 2) vals = packed(v);
          if (t === 8 && w === 0) lat = safeNumber(signed(v));
          if (t === 9 && w === 0) lon = safeNumber(signed(v));
        });
        appendNode(id, lat, lon, tagsFrom(keys, vals, strings));
      } else if (tag === 2 && wire === 2) {
        let ids = [], lats = [], lons = [], kv = [];
        fields(value, (t, w, v) => {
          if (w !== 2) return;
          if (t === 1) ids = packed(v, true);
          if (t === 8) lats = packed(v, true);
          if (t === 9) lons = packed(v, true);
          if (t === 10) kv = packed(v);
        });
        assertBudget(ids.length === lats.length && ids.length === lons.length, 'INVALID_PBF', 'dense node arrays differ');
        let id = 0, lat = 0, lon = 0, at = 0;
        for (let i = 0; i < ids.length; i++) {
          id += ids[i]; lat += lats[i]; lon += lons[i];
          const nodeKeys = [], nodeVals = [];
          while (at < kv.length && kv[at] !== 0) {
            assertBudget(at + 1 < kv.length, 'INVALID_PBF', 'dense tags incomplete');
            nodeKeys.push(kv[at]); nodeVals.push(kv[at + 1]); at += 2;
          }
          if (kv.length) { assertBudget(at < kv.length, 'INVALID_PBF', 'dense tags not terminated'); at += 1; }
          appendNode(id, lat, lon, tagsFrom(nodeKeys, nodeVals, strings));
        }
      } else if (tag === 3 && wire === 2) {
        assertBudget(state.ways.length < MAX_WAYS, 'BUDGET_EXCEEDED', 'way limit reached');
        let id = 0, keys = [], vals = [], refDeltas = [];
        fields(value, (t, w, v) => {
          if (t === 1 && w === 0) id = safeNumber(BigInt.asIntN(64, v));
          if (t === 2 && w === 2) keys = packed(v);
          if (t === 3 && w === 2) vals = packed(v);
          if (t === 8 && w === 2) refDeltas = packed(v, true);
        });
        assertBudget(refDeltas.length <= MAX_REFS_PER_WAY, 'BUDGET_EXCEEDED',
          'OSM way has too many vertices for the bounded regional builder');
        let prev = 0;
        const refs = refDeltas.map((delta) => (prev += delta));
        const wayTags = tagsFrom(keys, vals, strings);
        if (wayTags.highway || wayTags.waterway || wayTags.building || wayTags.landuse ||
            wayTags.leisure || wayTags.railway || wayTags.natural === 'water')
          state.ways.push({ id, refs, tags: wayTags });
      }
    });
  }
}

export function decodeOsmPbf(buffer) {
  assertBudget(buffer?.length > 4 && buffer.length <= MAX_PBF_BYTES, 'BUDGET_EXCEEDED', 'OSM PBF input is empty or too large');
  const state = { nodes: new Map(), ways: [], points: [] };
  let offset = 0; let headerSeen = false; let dataSeen = false;
  while (offset < buffer.length) {
    assertBudget(offset + 4 <= buffer.length, 'INVALID_PBF', 'truncated OSM PBF block header');
    const headerSize = buffer.readUInt32BE(offset); offset += 4;
    assertBudget(headerSize > 0 && headerSize <= 64 * 1024 && offset + headerSize <= buffer.length, 'INVALID_PBF', 'bad PBF block header');
    const { type, dataSize } = decodeBlobHeader(buffer.subarray(offset, offset + headerSize)); offset += headerSize;
    assertBudget(offset + dataSize <= buffer.length, 'INVALID_PBF', 'truncated OSM blob');
    const payload = decodeBlob(buffer.subarray(offset, offset + dataSize)); offset += dataSize;
    if (type === 'OSMHeader') headerSeen = true;
    else if (type === 'OSMData') {
      assertBudget(headerSeen, 'INVALID_PBF', 'OSM PBF data preceded its header');
      parsePrimitiveBlock(payload, state); dataSeen = true;
    } else throw new OsmTileError(`unsupported PBF block ${type}`, 'INVALID_PBF');
  }
  assertBudget(headerSeen && dataSeen && state.nodes.size > 0, 'INVALID_PBF', 'OSM header/nodes missing');
  return state;
}

function encodeVarint(number) {
  let value = BigInt(number);
  assertBudget(value >= 0n, 'ENCODING', 'varint must be unsigned');
  const bytes = [];
  while (value > 127n) { bytes.push(Number(value & 127n) | 128); value >>= 7n; }
  bytes.push(Number(value));
  return Buffer.from(bytes);
}
function fVar(field, n) { return Buffer.concat([encodeVarint(field << 3), encodeVarint(n)]); }
function fBytes(field, data) {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data;
  return Buffer.concat([encodeVarint(field * 8 + 2), encodeVarint(bytes.length), bytes]);
}
function zig(n) { return n >= 0 ? 2 * n : -2 * n - 1; }
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function xy(lon, lat, z) {
  const s = 2 ** z;
  const x = (lon + 180) / 360 * s;
  const rad = clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * s;
  return [clamp(x, 0, s - Number.EPSILON), clamp(y, 0, s - Number.EPSILON)];
}
function hilbert(z, x, y) {
  let dist = 0, size = 2 ** z;
  for (let s = size / 2; s >= 1; s /= 2) {
    const rx = (x & s) ? 1 : 0, ry = (y & s) ? 1 : 0;
    dist += s * s * ((3 * rx) ^ ry);
    if (!ry) { if (rx) { x = size - 1 - x; y = size - 1 - y; } [x, y] = [y, x]; }
  }
  return (4 ** z - 1) / 3 + dist;
}
function geometry(points, kind, z, x, y) {
  const projected = points.map(([lon, lat]) => {
    const [px, py] = xy(lon, lat, z);
    return [Math.round((px - x) * EXTENT), Math.round((py - y) * EXTENT)];
  });
  const unique = projected.filter((p, i) => i === 0 || p[0] !== projected[i - 1][0] || p[1] !== projected[i - 1][1]);
  if (kind === 3 && unique.length > 1 && unique[0][0] === unique[unique.length - 1][0] && unique[0][1] === unique[unique.length - 1][1]) unique.pop();
  if (unique.length < (kind === 1 ? 1 : kind === 2 ? 2 : 3)) return null;
  if (kind === 3) {
    let signedArea = 0;
    for (let i = 0; i < unique.length; i++) {
      const a = unique[i], b = unique[(i + 1) % unique.length];
      signedArea += a[0] * b[1] - b[0] * a[1];
    }
    if (signedArea === 0) return null;
    if (signedArea < 0) unique.reverse(); // clockwise in screen coordinates
  }
  const commands = [];
  let lastX = 0, lastY = 0;
  commands.push(9);
  commands.push(zig(unique[0][0] - lastX), zig(unique[0][1] - lastY));
  lastX = unique[0][0]; lastY = unique[0][1];
  if (unique.length > 1) {
    commands.push((unique.length - 1) * 8 + 2);
    for (let i = 1; i < unique.length; i++) {
      const p = unique[i];
      commands.push(zig(p[0] - lastX), zig(p[1] - lastY));
      lastX = p[0]; lastY = p[1];
    }
  }
  if (kind === 3) commands.push(15);
  return Buffer.concat(commands.map(encodeVarint));
}
function featureMessage(item, z, x, y, keys, values) {
  const encoded = geometry(item.coordinates, item.type, z, x, y);
  if (!encoded) return null;
  const tagIndices = [];
  for (const [key, val] of Object.entries(item.props)) {
    if (!keys.has(key)) keys.set(key, keys.size);
    if (!values.has(val)) values.set(val, values.size);
    tagIndices.push(keys.get(key), values.get(val));
  }
  return Buffer.concat([
    fVar(1, item.id),
    fBytes(2, Buffer.concat(tagIndices.map(encodeVarint))),
    fVar(3, item.type), fBytes(4, encoded),
  ]);
}
function vectorTile(layersByName, z, x, y) {
  const buffers = [];
  for (const layerName of LAYERS) {
    const records = layersByName.get(layerName);
    if (!records?.length) continue;
    const keys = new Map(), values = new Map(); const features = [];
    for (const r of records) {
      const message = featureMessage(r, z, x, y, keys, values);
      if (message) features.push(fBytes(2, message));
    }
    if (!features.length) continue;
    const keyBufs = [...keys].map(([k]) => fBytes(3, k));
    const valueBufs = [...values].map(([v]) => fBytes(4, fBytes(1, v)));
    const layer = Buffer.concat([fBytes(1, layerName), ...features, ...keyBufs, ...valueBufs, fVar(5, EXTENT), fVar(15, 2)]);
    buffers.push(fBytes(3, layer));
  }
  return Buffer.concat(buffers);
}
function classify(tags, isPolygon) {
  if (tags.highway) return 'roads';
  if (tags.waterway) return 'waterways';
  if (tags.railway) return 'rail';
  if (tags.natural === 'water') return 'water';
  if (tags.building && isPolygon) return 'buildings';
  if (isPolygon && (tags.landuse || tags.leisure)) return 'landuse';
  if (tags.place) return 'places';
  if (tags.amenity || tags.shop || tags.tourism || tags.natural === 'peak') return 'pois';
  return null;
}
function classifyItem(id, tags, points) {
  const isPolygon = points.length >= 4 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
  const layer = classify(tags, isPolygon);
  if (!layer) return null;
  const kind = points.length === 1 ? 1 : isPolygon && ['landuse', 'water', 'buildings'].includes(layer) ? 3 : 2;
  const props = { class: tags.highway || tags.waterway || tags.railway || tags.landuse || tags.leisure || tags.amenity || tags.natural || tags.place || tags.building || tags.shop || tags.tourism || 'unknown' };
  if (tags.name) props.name = tags.name.slice(0, 200);
  if (tags.ref) props.ref = tags.ref.slice(0, 80);
  return { layer, id, coordinates: points, props, type: kind };
}
function intersectsBounds(points, bounds) {
  if (!points.length) return false;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [lon, lat] of points) {
    west = Math.min(west, lon); east = Math.max(east, lon);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return west <= bounds[2] && east >= bounds[0] && south <= bounds[3] && north >= bounds[1];
}

function makeTiles(features, minZoom, maxZoom) {
  const tiles = new Map(); let assignments = 0;
  for (const feature of features) {
    for (let z = minZoom; z <= maxZoom; z++) {
      const all = feature.coordinates.map((p) => xy(p[0], p[1], z));
      const minX = Math.floor(Math.min(...all.map((p) => p[0])));
      const maxX = Math.floor(Math.max(...all.map((p) => p[0])));
      const minY = Math.floor(Math.min(...all.map((p) => p[1])));
      const maxY = Math.floor(Math.max(...all.map((p) => p[1])));
      assertBudget((maxX - minX + 1) * (maxY - minY + 1) <= MAX_TILES_PER_FEATURE_ZOOM,
        'REGION_TOO_LARGE', 'feature covers too many tiles at requested zoom; partition region or use larger-area builder');
      for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
        assertBudget(++assignments <= MAX_TILE_ASSIGNMENTS, 'REGION_TOO_LARGE', 'tile assignment budget exceeded');
        const key = `${z}/${x}/${y}`;
        if (!tiles.has(key)) { assertBudget(tiles.size < MAX_TILES, 'REGION_TOO_LARGE', 'tile count budget exceeded'); tiles.set(key, new Map()); }
        const layer = tiles.get(key);
        if (!layer.has(feature.layer)) layer.set(feature.layer, []);
        layer.get(feature.layer).push(feature);
      }
    }
  }
  return tiles;
}
function pmtilesDirectory(entries) {
  const vars = [encodeVarint(entries.length)];
  let lastId = 0;
  for (const entry of entries) { vars.push(encodeVarint(entry.id - lastId)); lastId = entry.id; }
  for (const entry of entries) vars.push(encodeVarint(1));
  for (const entry of entries) vars.push(encodeVarint(entry.bytes.length));
  let lastOffset = 0, lastLength = 0;
  for (const entry of entries) {
    const offset = entry.offset;
    vars.push(encodeVarint(offset === lastOffset + lastLength ? 0 : offset + 1));
    lastOffset = offset; lastLength = entry.bytes.length;
  }
  return Buffer.concat(vars);
}
export function encodePmtiles(tiles, bounds, minZoom, maxZoom) {
  const entries = [];
  for (const [key, layers] of tiles) {
    const [z, x, y] = key.split('/').map(Number);
    const data = vectorTile(layers, z, x, y);
    if (data.length) entries.push({ id: hilbert(z, x, y), bytes: gzipSync(data, { mtime: 0 }) });
  }
  entries.sort((a, b) => a.id - b.id);
  let tileOffset = 0;
  for (const e of entries) { e.offset = tileOffset; tileOffset += e.bytes.length; }
  assertBudget(entries.length > 0, 'EMPTY_MAP', 'no OSM features were generated');
  const dir = pmtilesDirectory(entries);
  assertBudget(dir.length <= 16_384, 'REGION_TOO_LARGE', 'PMTiles directory exceeds single-root limit');
  const metadata = Buffer.from(JSON.stringify({
    name: 'MarkMap offline OSM', format: 'pbf', bounds,
    vector_layers: LAYERS.map((id) => ({ id, fields: { class: 'String', name: 'String', ref: 'String' } })),
  }));
  const header = Buffer.alloc(127);
  header.write('PMTiles', 0, 'ascii'); header[7] = 3;
  const root = 127, meta = root + dir.length, leaf = meta + metadata.length, data = leaf;
  const offsets = [[root, dir.length], [meta, metadata.length], [leaf, 0], [data, tileOffset]];
  offsets.forEach(([start, size], i) => { header.writeBigUInt64LE(BigInt(start), 8 + i * 16); header.writeBigUInt64LE(BigInt(size), 16 + i * 16); });
  for (let i = 0; i < 3; i++) header.writeBigUInt64LE(BigInt(entries.length), 72 + 8 * i);
  header[96] = 1; header[97] = 1; header[98] = 2; header[99] = 1;
  header[100] = minZoom; header[101] = maxZoom;
  const [west, south, east, north] = bounds;
  [west, south, east, north].forEach((n, i) => header.writeInt32LE(Math.round(n * 1e7), 102 + i * 4));
  header[118] = Math.min(14, maxZoom);
  header.writeInt32LE(Math.round((west + east) / 2 * 1e7), 119);
  header.writeInt32LE(Math.round((south + north) / 2 * 1e7), 123);
  return Buffer.concat([header, dir, metadata, ...entries.map((e) => e.bytes)]);
}
export function defaultOfflineStyle() {
  return {
    version: 8, name: 'MarkMap Offline OSM',
    glyphs: 'glyphs/{fontstack}/{range}.pbf', sprite: 'sprites/sprite',
    sources: { basemap: { type: 'vector', url: 'pmtiles://package.pmtiles' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f4f5f2' } },
      { id: 'landuse', type: 'fill', source: 'basemap', 'source-layer': 'landuse', paint: { 'fill-color': '#c8dfba', 'fill-opacity': 0.75 } },
      { id: 'water', type: 'fill', source: 'basemap', 'source-layer': 'water', paint: { 'fill-color': '#9ed3ed' } },
      { id: 'buildings', type: 'fill', source: 'basemap', 'source-layer': 'buildings', paint: { 'fill-color': '#d9cfc3', 'fill-outline-color': '#bcb1a7' } },
      { id: 'waterways', type: 'line', source: 'basemap', 'source-layer': 'waterways', paint: { 'line-color': '#82c5e8', 'line-width': 1.8 } },
      { id: 'rail', type: 'line', source: 'basemap', 'source-layer': 'rail', paint: { 'line-color': '#6e7479', 'line-width': 1.2 } },
      { id: 'roads', type: 'line', source: 'basemap', 'source-layer': 'roads', paint: { 'line-color': '#ece0b5', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 12, 4, 16, 8] } },
      { id: 'footpaths', type: 'line', source: 'basemap', 'source-layer': 'roads',
        filter: ['in', ['get', 'class'], ['literal', ['path', 'footway', 'pedestrian', 'steps', 'track']]],
        paint: { 'line-color': '#97785b', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 14, 2], 'line-dasharray': [2, 2] } },
      { id: 'cycleways', type: 'line', source: 'basemap', 'source-layer': 'roads',
        filter: ['==', ['get', 'class'], 'cycleway'],
        paint: { 'line-color': '#1f997d', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 14, 3] } },
      { id: 'pois', type: 'circle', source: 'basemap', 'source-layer': 'pois', paint: { 'circle-color': '#0075d6', 'circle-radius': 3 } },
      { id: 'places', type: 'circle', source: 'basemap', 'source-layer': 'places', paint: { 'circle-color': '#00a7a9', 'circle-radius': 4 } },
    ],
  };
}
export function makePmtilesFromOsm(buffer, options) {
  const minZoom = options?.minZoom ?? 0;
  const maxZoom = options?.maxZoom ?? 12;
  assertBudget(Number.isInteger(minZoom) && Number.isInteger(maxZoom) && minZoom >= 0 && minZoom <= maxZoom && maxZoom <= 14,
    'INVALID_ZOOM', 'OSM PBF builder supports zoom 0..14');
  const bounds = options?.bounds;
  assertBudget(Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite) &&
    bounds[0] >= -180 && bounds[2] <= 180 && bounds[1] >= -85 && bounds[3] <= 85 &&
    bounds[0] < bounds[2] && bounds[1] < bounds[3], 'INVALID_BOUNDS', 'invalid region bounds');
  const state = decodeOsmPbf(buffer);
  const features = [];
  for (const way of state.ways) {
    const points = way.refs.map((id) => state.nodes.get(id));
    if (points.some((x) => x === undefined)) continue; // incomplete extract
    const item = classifyItem(way.id, way.tags, points);
    if (item && intersectsBounds(points, bounds)) features.push(item);
  }
  for (const point of state.points) {
    const item = classifyItem(point.id, point.tags, [point.point]);
    if (item && intersectsBounds([point.point], bounds)) features.push(item);
  }
  assertBudget(features.length > 0, 'EMPTY_MAP', 'no supported geometry in the OSM PBF');
  const tiles = makeTiles(features, minZoom, maxZoom);
  const bytes = encodePmtiles(tiles, bounds, minZoom, maxZoom);
  assertBudget(bytes.byteLength <= 250 * 1024 * 1024, 'BUDGET_EXCEEDED', 'PMTiles exceeds current package contract');
  return { bytes, featureCount: features.length, tileCount: tiles.size, layers: LAYERS };
}
export async function buildPmtilesFromOsmFile(path, options) {
  // Avoid allocating a potentially planet-sized file before the decoder's budget runs.
  const details = await stat(path);
  assertBudget(details.isFile() && details.size > 4 && details.size <= MAX_PBF_BYTES,
    'BUDGET_EXCEEDED', 'integrated OSM PBF builder accepts files up to 32 MiB');
  const buffer = await readFile(path);
  return makePmtilesFromOsm(buffer, options);
}
