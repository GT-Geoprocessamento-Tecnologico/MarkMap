import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateShellManifest } from './generate-shell-manifest.mjs';
const APP_VERSION = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'markmap-shell-'));
  await mkdir(join(dir, 'icons'));
  await mkdir(join(dir, 'assets'));
  await writeFile(join(dir, 'index.html'), '<html>MarkMap vA</html>');
  await writeFile(join(dir, 'manifest.json'), '{"id":"/","scope":"/"}');
  await writeFile(join(dir, 'icons/icon-192x192.png'), 'image1');
  await writeFile(join(dir, 'icons/icon-512x512.png'), 'image2');
  await writeFile(join(dir, 'assets/main-abcdef01.js'), 'appA');
  await writeFile(join(dir, 'sw.js'), `const ASSETS = __MARKMAP_SHELL_MANIFEST__;\nconst SHELL = __MARKMAP_SHELL_VERSION__;\nconst VERSION = __MARKMAP_APP_VERSION__;\nconst SHA = __MARKMAP_BUILD_SHA__;\n`);
  return dir;
}

test('build pre-caches the shell but never caches version.json for update discovery', async () => {
  const dir = await fixture();
  const oldEpoch = process.env.SOURCE_DATE_EPOCH;
  try {
    process.env.SOURCE_DATE_EPOCH = '1791504000';
    const first = await generateShellManifest(dir);
    assert.ok(first.assets.includes('/index.html'));
    assert.ok(first.assets.includes('/assets/main-abcdef01.js'));
    assert.ok(!first.assets.includes('/version.json'));
    assert.equal(first.assets.filter(x => x.includes('maps/')).length, 0);
    const metadata = JSON.parse(await readFile(join(dir,'version.json'),'utf8'));
    assert.equal(metadata.appVersion, APP_VERSION);
    assert.equal(metadata.shellProtocolVersion, 1);
    const worker = await readFile(join(dir,'sw.js'),'utf8');
    assert.ok(worker.includes(first.version));
    assert.ok(worker.includes(APP_VERSION));
    assert.ok(!worker.includes('__MARKMAP_APP_VERSION__'));
    const same = await generateShellManifest(dir);
    assert.equal(same.version, first.version);
    await writeFile(join(dir,'index.html'),'<html>MarkMap vB</html>');
    const next = await generateShellManifest(dir);
    assert.notEqual(next.version, first.version);
    assert.deepEqual(next.assets,first.assets);
  } finally {
    if (oldEpoch===undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH=oldEpoch;
    await rm(dir,{recursive:true,force:true});
  }
});

test('Cloudflare build SHA is recorded in network-only version.json, never in SW', async () => {
  const dir = await fixture();
  const prev = {CF_PAGES:process.env.CF_PAGES,CF_PAGES_COMMIT_SHA:process.env.CF_PAGES_COMMIT_SHA};
  try {
    process.env.CF_PAGES='1';
    process.env.CF_PAGES_COMMIT_SHA='e'.repeat(40);
    const result=await generateShellManifest(dir);
    const sw=await readFile(join(dir,'sw.js'),'utf8');
    const data=JSON.parse(await readFile(join(dir,'version.json'),'utf8'));
    assert.equal(data.buildSha,'e'.repeat(40));
    assert.ok(!sw.includes('e'.repeat(40)));
    assert.ok(result.assets.includes('/index.html'));
    assert.equal(result.assets.includes('/version.json'),false);
  } finally {
    for(const [key,val] of Object.entries(prev)){
      if(val===undefined)delete process.env[key];else process.env[key]=val;
    }
    await rm(dir,{recursive:true,force:true});
  }
});

test('documentation-only Cloudflare commits keep identical shell and worker bytes', async () => {
  const firstDir = await fixture();
  const secondDir = await fixture();
  const prev = { CF_PAGES: process.env.CF_PAGES, CF_PAGES_COMMIT_SHA: process.env.CF_PAGES_COMMIT_SHA };
  try {
    process.env.CF_PAGES = '1';
    process.env.CF_PAGES_COMMIT_SHA = '1'.repeat(40);
    const first = await generateShellManifest(firstDir);
    const workerA = await readFile(join(firstDir, 'sw.js'), 'utf8');
    const metadataA = JSON.parse(await readFile(join(firstDir, 'version.json'), 'utf8'));
    process.env.CF_PAGES_COMMIT_SHA = '2'.repeat(40);
    const second = await generateShellManifest(secondDir);
    const workerB = await readFile(join(secondDir, 'sw.js'), 'utf8');
    const metadataB = JSON.parse(await readFile(join(secondDir, 'version.json'), 'utf8'));
    assert.equal(first.version, second.version);
    assert.equal(workerA, workerB);
    assert.notEqual(metadataA.buildSha, metadataB.buildSha);
    assert.ok(!first.assets.includes('/version.json'));
    assert.ok(!second.assets.includes('/version.json'));
  } finally {
    for (const [key, val] of Object.entries(prev)) {
      if (val === undefined) delete process.env[key]; else process.env[key] = val;
    }
    await rm(firstDir, { recursive: true, force: true });
    await rm(secondDir, { recursive: true, force: true });
  }
});
test('new hashed GeoTIFF worker is part of approved offline shell', async () => {
  const dir = await fixture();
  try {
    await writeFile(join(dir, 'assets/geotiff-overlay.worker-a1b2c3d4.js'), 'worker-code');
    const manifest = await generateShellManifest(dir);
    assert.ok(manifest.assets.includes('/assets/geotiff-overlay.worker-a1b2c3d4.js'));
    const sw = await readFile(join(dir, 'sw.js'), 'utf8');
    assert.ok(sw.includes('/assets/geotiff-overlay.worker-a1b2c3d4.js'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
