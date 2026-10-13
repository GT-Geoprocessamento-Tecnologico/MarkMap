import test from 'node:test';
import assert from 'node:assert/strict';
import { getRegionInstallDraftUrl, rememberRegionInstallDraftUrl,
  clearRegionInstallDraftUrl, normalizePublicRegionManifestUrl } from '../apps/admin/src/lib/storage/region-install-draft.mjs';
import { fingerprintRegionManifest, matchesRegionUpdatePreview } from '../apps/admin/src/lib/storage/region-update-identity.mjs';

function memoryStorage() {
  const map = new Map();
  return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)),
    removeItem: k => map.delete(k), entries: () => [...map] };
}

test('A12: restoring a sanitized region URL across mounts without network', () => {
  const storage = memoryStorage();
  const url = 'https://maps.example.org/region/demo/manifest.json';
  assert.equal(getRegionInstallDraftUrl(storage), null);
  assert.equal(rememberRegionInstallDraftUrl(url, storage), true);
  assert.equal(getRegionInstallDraftUrl(storage), url);
  assert.deepEqual(storage.entries(), [['markmap:region-install-draft', url]]);
  clearRegionInstallDraftUrl(storage);
  assert.equal(getRegionInstallDraftUrl(storage), null);
});

test('A12: rejects URLs with credentials, query tokens or public HTTP', () => {
  const storage = memoryStorage();
  for (const url of [
    'https://user:pass@maps.example.org/region/manifest.json',
    'https://maps.example.org/region/manifest.json?key=secret',
    'https://maps.example.org/region/manifest.json#private',
    'http://maps.example.org/region/manifest.json',
    'https://maps.example.org/not-a-manifest.json',
    '/manifest.json',
    'x'.repeat(1100),
  ]) {
    assert.equal(normalizePublicRegionManifestUrl(url), null);
    assert.equal(rememberRegionInstallDraftUrl(url, storage), false);
    assert.equal(storage.entries().length, 0);
  }
  assert.equal(normalizePublicRegionManifestUrl('http://localhost:5173/a/manifest.json'),
    'http://localhost:5173/a/manifest.json');
});

test('A12: changing a valid URL to invalid clears the previous draft', () => {
  const storage = memoryStorage();
  assert.equal(rememberRegionInstallDraftUrl('https://maps.example.org/a/manifest.json', storage), true);
  rememberRegionInstallDraftUrl('https://maps.example.org/a/manifest.json?token=123', storage);
  assert.equal(getRegionInstallDraftUrl(storage), null);
});

test('A12: session storage denial is safe and does not throw', () => {
  const storage = { getItem() { throw Error('disabled'); }, setItem() { throw Error('disabled'); }, removeItem() { throw Error('disabled'); } };
  assert.equal(getRegionInstallDraftUrl(storage), null);
  assert.equal(rememberRegionInstallDraftUrl('https://maps.example.org/a/manifest.json', storage), false);
  assert.doesNotThrow(() => clearRegionInstallDraftUrl(storage));
});

test('A13: manifest identity is key-order independent but content sensitive', () => {
  const first = { id: 'demo', version: '2.0', packageVersion: '1.2.3',
    archive: {sha256:'aa', bytes: 2}, style:{blob:{sha256:'bb',bytes:1}}, glyphs:[{path:'a',blob:{sha256:'cc'}}]};
  const reordered = {glyphs:[{blob:{sha256:'cc'},path:'a'}],style:{blob:{bytes:1,sha256:'bb'}},archive:{bytes:2,sha256:'aa'},packageVersion:'1.2.3',version:'2.0',id:'demo'};
  assert.match(fingerprintRegionManifest(first),/^[a-f0-9]{64}$/);
  assert.equal(fingerprintRegionManifest(first),fingerprintRegionManifest(reordered));
  assert.notEqual(fingerprintRegionManifest(first),fingerprintRegionManifest({...first,archive:{...first.archive,sha256:'dd'}}));
  assert.notEqual(fingerprintRegionManifest(first),fingerprintRegionManifest({...first,glyphs:[{path:'a',blob:{sha256:'ff'}}]}));
  assert.throws(() => fingerprintRegionManifest(null),/Expected/);
  assert.throws(() => fingerprintRegionManifest({ huge: 'x'.repeat(140 * 1024) }),/128 KiB/);
});

test('A13: approval is bound to exact source, installed version and full manifest', () => {
  const manifest = {id:'region', packageVersion:'1.1.0', archive:{sha256:'ab',bytes:100}, style:{sha256:'cd'}};
  const expected = {sourceUrl:'https://maps.example.org/region/manifest.json',
    installedVersion:'1.0.0', manifestFingerprint:fingerprintRegionManifest(manifest)};
  assert.equal(matchesRegionUpdatePreview(manifest, expected.sourceUrl, '1.0.0', expected), true);
  assert.equal(matchesRegionUpdatePreview(manifest, expected.sourceUrl, '1.0.1', expected), false);
  assert.equal(matchesRegionUpdatePreview(manifest, 'https://other.example.org/region/manifest.json', '1.0.0', expected), false);
  assert.equal(matchesRegionUpdatePreview({...manifest,style:{sha256:'changed'}},expected.sourceUrl,'1.0.0',expected),false);
  assert.equal(matchesRegionUpdatePreview({...manifest,packageVersion:'1.2.0'},expected.sourceUrl,'1.0.0',expected),false);
  assert.equal(matchesRegionUpdatePreview(manifest,expected.sourceUrl,'1.0.0',undefined),false);
});
