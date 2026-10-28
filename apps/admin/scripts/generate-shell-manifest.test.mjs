import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateShellManifest } from './generate-shell-manifest.mjs';

test('new shell version when index content changes without renamed files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'markmap-shell-'));
  const oldEpoch = process.env.SOURCE_DATE_EPOCH;
  process.env.SOURCE_DATE_EPOCH = '1791504000';
  try {
    await mkdir(join(dir, 'icons'));
    await writeFile(join(dir, 'index.html'), '<html>1</html>');
    await writeFile(join(dir, 'manifest.json'), '{}');
    await writeFile(join(dir, 'icons/icon-192x192.png'), 'image1');
    await writeFile(join(dir, 'icons/icon-512x512.png'), 'image2');
    await writeFile(join(dir, 'sw.js'), "const SHELL_VERSION = typeof __MARKMAP_SHELL_VERSION__ === 'undefined' ? 'v2' : __MARKMAP_SHELL_VERSION__;\n");
    const first = await generateShellManifest(dir);
    const version = JSON.parse(await readFile(join(dir, 'version.json'), 'utf8'));
    assert.equal(version.shellProtocolVersion, 1);
    assert.equal(version.localSchemaVersion, 1);
    assert.ok(first.assets.includes('/version.json'));
    const unchanged = await generateShellManifest(dir);
    assert.equal(unchanged.version, first.version);
    const oldWorker = await readFile(join(dir, 'sw.js'), 'utf8');
    assert.ok(oldWorker.includes(first.version));
    await writeFile(join(dir, 'index.html'), '<html>2</html>');
    // Production runs generation once per build (dist is overwritten).
    const second = await generateShellManifest(dir);
    assert.notEqual(first.version, second.version);
    assert.deepEqual(first.assets, second.assets);
    assert.equal(second.assets.includes('/index.html'), true);
  } finally {
    if (oldEpoch === undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH = oldEpoch;
    await rm(dir, {recursive:true,force:true});
  }
});

test('Cloudflare Pages records the Git commit in version.json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'markmap-pages-sha-'));
  const before = { CF_PAGES: process.env.CF_PAGES, CF_PAGES_COMMIT_SHA: process.env.CF_PAGES_COMMIT_SHA };
  try {
    await writeFile(join(dir, 'index.html'), '<html>preview</html>');
    await writeFile(join(dir, 'manifest.json'), '{}');
    process.env.CF_PAGES = '1';
    process.env.CF_PAGES_COMMIT_SHA = 'e'.repeat(40);
    await generateShellManifest(dir);
    const metadata = JSON.parse(await readFile(join(dir, 'version.json'), 'utf8'));
    assert.equal(metadata.buildSha, 'e'.repeat(40));
    assert.equal(metadata.appVersion, '0.5.16');
    delete process.env.CF_PAGES_COMMIT_SHA;
    await generateShellManifest(dir);
    const missing = JSON.parse(await readFile(join(dir, 'version.json'), 'utf8'));
    assert.equal(missing.buildSha, 'unavailable');
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(dir, {recursive:true,force:true});
  }
});
