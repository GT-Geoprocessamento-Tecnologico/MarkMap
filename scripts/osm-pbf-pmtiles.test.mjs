import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { makePmtilesFromOsm, defaultOfflineStyle, OsmTileError } from './osm-pbf-pmtiles.mjs';
import { osmFixture } from './test/osm-fixture.mjs';

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
      result.artifacts.filter((a) => a.path !== 'manifest.json')
        .reduce((sum, a) => sum + a.bytes, 0));
    assert.equal(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')).id, 'fixture-region');
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('A4: never overwrites previously published content', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, readdir, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { runPipeline } = await import('./region-pipeline.mjs');
  const root = await mkdtemp(join(tmpdir(), 'mm-publish-preserve-'));
  const input = join(root, 'in'), output = join(root, 'out');
  try {
    await mkdir(input); await mkdir(output);
    await writeFile(join(input, 'osm.pbf'), osmFixture());
    await writeFile(join(input, 'region.json'), JSON.stringify({
      id:'fixture-region', label:'Fixture Region', bounds:[-46.61,-23.51,-46.59,-23.49],
      minZoom:9, maxZoom:10, osmDataDate:'2026-10-08T00:00:00.000Z',
    }));
    await writeFile(join(output, 'previous-manifest.json'), 'keep this');
    await assert.rejects(runPipeline({input,output}), (error) => error.code === 'OUTPUT_NOT_EMPTY');
    assert.deepEqual(await readdir(output), ['previous-manifest.json']);
    assert.equal(await readFile(join(output, 'previous-manifest.json'),'utf8'), 'keep this');
    assert.deepEqual((await readdir(root)).filter((name)=>name.includes('.staging-')), []);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('A4: late validation failure leaves no partial published package', async () => {
  const { mkdtemp, mkdir, writeFile, readdir, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { runPipeline } = await import('./region-pipeline.mjs');
  const root = await mkdtemp(join(tmpdir(), 'mm-publish-fail-'));
  const input = join(root,'in'), output = join(root,'out');
  try {
    await mkdir(input); await mkdir(output);
    await writeFile(join(input,'osm.pbf'),osmFixture());
    await writeFile(join(input,'region.json'),JSON.stringify({
      id:'fixture-region',label:'Fixture Region',bounds:[-46.61,-23.51,-46.59,-23.49],
      minZoom:9,maxZoom:10,osmDataDate:'2026-10-08T00:00:00.000Z',
    }));
    // This validation runs after PMTiles, sprites and search artifacts are generated.
    await writeFile(join(input,'wikipedia.json'),JSON.stringify({regionId:'fixture-region',version:'1.0.0',
      generatedAt:'2026-10-08T00:00:00.000Z',license:'',attribution:'test',articles:[]}));
    await assert.rejects(runPipeline({input,output}), /licen[aç]/i);
    assert.deepEqual(await readdir(output), []);
    assert.deepEqual((await readdir(root)).filter((name)=>name.includes('.staging-')), []);
  } finally { await rm(root,{recursive:true,force:true}); }
});
