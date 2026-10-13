import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makePmtilesFromOsm, defaultOfflineStyle } from './osm-pbf-pmtiles.mjs';
import { osmFixture } from './test/osm-fixture.mjs';
import { runPipeline } from './region-pipeline.mjs';

const bounds = [-46.61, -23.51, -46.59, -23.49];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZ0AAAAASUVORK5CYII=', 'base64');

async function prepare(input, basemap) {
  await mkdir(input);
  await writeFile(join(input, 'basemap.pmtiles'), basemap);
  await writeFile(join(input, 'region.json'), JSON.stringify({
    id: 'prebuilt-qa', label: 'Prebuilt QA', bounds, minZoom: 9, maxZoom: 10,
    osmDataDate: '2026-10-08T00:00:00.000Z',
  }));
  await writeFile(join(input, 'style.json'), JSON.stringify(defaultOfflineStyle()));
  await mkdir(join(input, 'sprites'));
  await writeFile(join(input, 'sprites/sprite.json'), '{}');
  await writeFile(join(input, 'sprites/sprite.png'), png);
}

const generate = () => makePmtilesFromOsm(osmFixture(), { bounds, minZoom: 9, maxZoom: 10 }).bytes;

test('A3: valid prebuilt MVT is published with local sprites and matching SHA', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mm-prebuilt-qa-'));
  const input = join(root, 'input'), output = join(root, 'output');
  try {
    const original = generate();
    await prepare(input, original);
    const result = await runPipeline({ input, output });
    const packed = await readFile(join(output, 'package.pmtiles'));
    assert.deepEqual(packed, original);
    assert.equal(result.manifest.archive.sha256, createHash('sha256').update(original).digest('hex'));
    assert.equal(result.manifest.sprites.length, 2);
    assert.equal(result.manifest.totalBytes,
      result.artifacts.filter((a) => a.path !== 'manifest.json').reduce((n, a) => n + a.bytes, 0));
    assert.ok(result.manifest.capabilities.includes('basemap'));
    assert.equal(JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')).id, 'prebuilt-qa');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('A3: raster header is rejected without a partially published package', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mm-raster-qa-'));
  const input = join(root, 'input'), output = join(root, 'output');
  try {
    const raster = Buffer.from(generate());
    raster[99] = 2; // PNG tile type, not MVT
    await prepare(input, raster);
    await assert.rejects(runPipeline({ input, output }), (error) => error.code === 'INVALID_PMTILES');
    assert.deepEqual(await readdir(root), ['input']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('A3: oversized sparse PMTiles is rejected before reading it into RAM', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mm-sparse-qa-'));
  const input = join(root, 'input'), output = join(root, 'output');
  try {
    await prepare(input, generate());
    const handle = await open(join(input, 'basemap.pmtiles'), 'r+');
    try { await handle.truncate(251 * 1024 * 1024); }
    finally { await handle.close(); }
    await assert.rejects(runPipeline({ input, output }), (error) => error.code === 'INVALID_PMTILES_SIZE');
    assert.deepEqual(await readdir(root), ['input']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
