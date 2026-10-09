import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { makePmtilesFromOsm, defaultOfflineStyle, OsmTileError } from './osm-pbf-pmtiles.mjs';

function v(n) {
  let x = BigInt(n); const bytes = [];
  while (x >= 128n) { bytes.push(Number(x & 127n) | 128); x >>= 7n; }
  bytes.push(Number(x)); return Buffer.from(bytes);
}
function zi(n) { const x = BigInt(n); return x < 0n ? -2n * x - 1n : 2n * x; }
const field = (n, value) => Buffer.concat([v(n * 8), v(value)]);
const bytes = (n, data) => { const raw = Buffer.isBuffer(data) ? data : Buffer.from(data); return Buffer.concat([v(n * 8 + 2), v(raw.length), raw]); };
const parts = (...p) => Buffer.concat(p);
function osmFixture() {
  const strings = ['', 'highway', 'residential', 'name', 'Rua de Teste', 'leisure', 'park', 'amenity', 'cafe', 'Café'];
  const table = parts(...strings.map((x) => bytes(1, x)));
  const nodes = [
    [10, -23.5000, -46.6000],
    [11, -23.5001, -46.5998],
    [12, -23.5003, -46.6000],
    [13, -23.4997, -46.5999],
  ];
  const deltas = (at) => {
    let prev = 0;
    return parts(...nodes.map((node) => { const val = Math.round(node[at] * 1e7); const delta = val - prev; prev = val; return v(zi(delta)); }));
  };
  const dense = parts(
    bytes(1, parts(v(zi(10)), v(zi(1)), v(zi(1)), v(zi(1)))),
    bytes(8, deltas(1)), bytes(9, deltas(2)),
    bytes(10, parts(v(0), v(0), v(0), v(7), v(8), v(3), v(9), v(0))),
  );
  const road = parts(field(1, 100), bytes(2, parts(v(1), v(3))), bytes(3, parts(v(2), v(4))),
    bytes(8, parts(v(zi(10)), v(zi(3)))));
  const park = parts(field(1, 101), bytes(2, v(5)), bytes(3, v(6)),
    bytes(8, parts(v(zi(10)), v(zi(1)), v(zi(1)), v(zi(-2)))));
  const group = parts(bytes(2, dense), bytes(3, road), bytes(3, park));
  const primitive = parts(bytes(1, table), bytes(2, group));
  const wrap = (type, payload) => {
    const blob = bytes(1, payload);
    const header = parts(bytes(1, type), field(3, blob.length));
    const len = Buffer.alloc(4); len.writeUInt32BE(header.length);
    return parts(len, header, blob);
  };
  return parts(wrap('OSMHeader', Buffer.alloc(0)), wrap('OSMData', primitive));
}
function readVar(bytes, at) {
  let val = 0, shift = 0, offset = at;
  while (offset < bytes.length) { const c = bytes[offset++]; val += (c & 127) * 2 ** shift; if (!(c & 128)) return [val, offset]; shift += 7; }
  throw Error('truncated varint');
}
function namesFromMvt(buffer) {
  const names = []; let at = 0;
  while (at < buffer.length) {
    const [field, n] = readVar(buffer, at); at = n;
    assert.equal(field & 7, 2);
    const [len, k] = readVar(buffer, at); at = k;
    const layer = buffer.subarray(at, at + len); at += len;
    let j = 0;
    while (j < layer.length) {
      const [key, q] = readVar(layer, j); j = q;
      const wire = key & 7, tag = Math.floor(key / 8);
      if (wire === 0) { j = readVar(layer, j)[1]; }
      else if (wire === 2) {
        const [nbytes, m] = readVar(layer, j); j = m;
        if (tag === 1) names.push(layer.subarray(j, j + nbytes).toString('utf8'));
        j += nbytes;
      } else throw new Error('unsupported MVT wire type');
    }
  }
  return names;
}

test('converts actual OSM PBF primitives into a readable PMTiles v3 MVT directory', () => {
  const input = osmFixture();
  const options = { bounds: [-46.61, -23.51, -46.59, -23.49], minZoom: 9, maxZoom: 10 };
  const out = makePmtilesFromOsm(input, options);
  assert.ok(out.featureCount >= 2);
  assert.ok(out.tileCount >= 1);
  const pm = out.bytes;
  assert.equal(pm.subarray(0, 7).toString('ascii'), 'PMTiles');
  assert.equal(pm[7], 3);
  assert.equal(pm[97], 1); assert.equal(pm[98], 2); assert.equal(pm[99], 1);
  const rootOffset = Number(pm.readBigUInt64LE(8));
  const rootSize = Number(pm.readBigUInt64LE(16));
  const tileStart = Number(pm.readBigUInt64LE(56));
  assert.ok(rootOffset >= 127 && rootSize > 0 && tileStart + Number(pm.readBigUInt64LE(64)) <= pm.length);
  const root = pm.subarray(rootOffset, rootOffset + rootSize);
  const [count, offset] = readVar(root, 0);
  assert.ok(count >= 1);
  // Tile bytes are placed contiguously and gzip-compressed per header.
  const firstTile = pm.subarray(tileStart);
  const stream = gunzipSync(firstTile); // This fixture creates one tile per zoom: gunzip consumes first gzip stream.
  const layers = namesFromMvt(stream);
  assert.ok(layers.includes('roads'));
  assert.ok(layers.includes('landuse'));
  const repeat = makePmtilesFromOsm(input, options);
  assert.deepEqual(repeat.bytes, out.bytes);
  assert.ok(offset > 0);
});

test('produces local-only, MapLibre-ready style with vector source layers', () => {
  const style = defaultOfflineStyle();
  assert.equal(style.sources.basemap.url, 'pmtiles://package.pmtiles');
  assert.ok(style.layers.some((x) => x['source-layer'] === 'roads'));
  assert.ok(style.layers.some((x) => x['source-layer'] === 'water'));
  assert.doesNotMatch(JSON.stringify(style), /https?:\/\//);
});

test('rejects invalid/truncated and unsupported input instead of producing a placeholder map', () => {
  assert.throws(() => makePmtilesFromOsm(Buffer.from('not pbf'), { bounds: [-10, -10, 10, 10] }), OsmTileError);
  assert.throws(() => makePmtilesFromOsm(osmFixture().subarray(0, 30), { bounds: [-10, -10, 10, 10] }), OsmTileError);
  assert.throws(() => makePmtilesFromOsm(osmFixture(), { bounds: [-10, -10, 10, 10], maxZoom: 24 }), /zoom 0..14/);
});
export { osmFixture };

test('region pipeline creates an installable manifest with local sprite assets and real PMTiles', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { runPipeline } = await import('./region-pipeline.mjs');
  const root = await mkdtemp(join(tmpdir(), 'markmap-regional-'));
  const input = join(root, 'in'), output = join(root, 'out');
  try {
    await mkdir(input);
    await writeFile(join(input, 'osm.pbf'), osmFixture());
    await writeFile(join(input, 'region.json'), JSON.stringify({
      id: 'fixture-region', label: 'Fixture Region', bounds: [-46.61, -23.51, -46.59, -23.49],
      minZoom: 9, maxZoom: 10, osmDataDate: '2026-10-08T00:00:00.000Z',
    }));
    const result = await runPipeline({ input, output, now: new Date('2026-10-09T00:00:00.000Z') });
    assert.equal(result.manifest.capabilities[0], 'basemap');
    assert.equal(result.manifest.archive.sha256,
      (await import('node:crypto')).createHash('sha256').update(await readFile(join(output, 'package.pmtiles'))).digest('hex'));
    assert.equal(result.manifest.sprites.length, 4);
    for (const sprite of result.manifest.sprites) assert.equal((await readFile(join(output, sprite.path))).length, sprite.blob.bytes);
    assert.equal(result.manifest.totalBytes,
      result.manifest.archive.bytes + result.manifest.style.blob.bytes +
      result.manifest.sprites.reduce((sum, s) => sum + s.blob.bytes, 0));
    assert.equal(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')).id, 'fixture-region');
  } finally { await rm(root, { recursive: true, force: true }); }
});
