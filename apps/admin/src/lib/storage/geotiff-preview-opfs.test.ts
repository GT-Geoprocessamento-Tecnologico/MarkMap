// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { geoTiffPreviewCacheKey, readGeoTiffPreviewCache, writeGeoTiffPreviewCache } from './geotiff-preview-opfs';

afterEach(() => vi.unstubAllGlobals());

function fakeStorage(freeBytes = 1_000_000_000) {
  const files = new Map<string, Blob>();
  const directory = {
    async getFileHandle(name: string, options: { create?: boolean } = {}) {
      if (!options.create && !files.has(name)) throw new Error('missing');
      return {
        async getFile() { return files.get(name) ?? new Blob([]); },
        async createWritable() {
          let payload: Blob = new Blob([]);
          return {
            async write(value: Blob | string) { payload = value instanceof Blob ? value : new Blob([value]); },
            async close() { files.set(name, payload); },
          };
        },
      };
    },
    async *keys() { yield* files.keys(); },
  };
  vi.stubGlobal('navigator', { storage: {
    estimate: async () => ({ quota: 1_000_000_000, usage: 1_000_000_000 - freeBytes }),
    getDirectory: async () => ({ getDirectoryHandle: async () => directory }),
  } });
  return files;
}

const coordinates: [[number, number], [number, number], [number, number], [number, number]] =
  [[-48, 0], [-47, 0], [-47, -1], [-48, -1]];
function png(width: number, height: number): Blob {
  const bytes = new Uint8Array(40);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new Blob([bytes], { type: 'image/png' });
}

it('works without OPFS and never changes original inputs', async () => {
  vi.stubGlobal('navigator', {});
  const original = new Blob(['original-payload']);
  const key = await geoTiffPreviewCacheKey(original);
  expect(key).toMatch(/^[a-f0-9]{64}$/);
  expect(await readGeoTiffPreviewCache(key!)).toBeNull();
  expect(await original.text()).toBe('original-payload');
});

it('reads only valid derived PNG and respects memory-adaptive pixel limits', async () => {
  const files = fakeStorage();
  const key = 'a'.repeat(64);
  await writeGeoTiffPreviewCache(key, png(400, 200), { width: 400, height: 200, coordinates });
  expect(files.size).toBe(2);
  expect((await readGeoTiffPreviewCache(key, { maxPreviewPixels: 100_000 }))?.width).toBe(400);
  expect(await readGeoTiffPreviewCache(key, { maxPreviewDimension: 200 })).toBeNull();
  expect((await readGeoTiffPreviewCache(key, { maxPreviewDimension: 400 }))?.width).toBe(400);
  expect(await readGeoTiffPreviewCache(key, { maxPreviewPixels: 10_000 })).toBeNull();
  files.set(`${key}.png`, new Blob(['damaged']));
  expect(await readGeoTiffPreviewCache(key)).toBeNull();
});

it('does not allocate optional OPFS cache when storage reserve is low', async () => {
  const files = fakeStorage(1);
  await writeGeoTiffPreviewCache('b'.repeat(64), png(10, 10), { width: 10, height: 10, coordinates });
  expect(files.size).toBe(0);
});

it('rejects an intact-header PNG with corrupted body bytes', async () => {
  const files = fakeStorage();
  const key = 'e'.repeat(64);
  await writeGeoTiffPreviewCache(key, png(2, 2), { width: 2, height: 2, coordinates });
  expect(await readGeoTiffPreviewCache(key)).not.toBeNull();
  const corrupted = new Uint8Array(await files.get(`${key}.png`)!.arrayBuffer());
  corrupted[30] ^= 0xff;
  files.set(`${key}.png`, new Blob([corrupted], { type: 'image/png' }));
  expect(await readGeoTiffPreviewCache(key)).toBeNull();
});

it('rejects incomplete metadata without integrity digest', async () => {
  const files = fakeStorage();
  const key = 'f'.repeat(64);
  await writeGeoTiffPreviewCache(key, png(2, 2), { width: 2, height: 2, coordinates });
  const metadata = JSON.parse(await files.get(`${key}.json`)!.text());
  delete metadata.sha256;
  files.set(`${key}.json`, new Blob([JSON.stringify(metadata)]));
  expect(await readGeoTiffPreviewCache(key)).toBeNull();
});

it('rejects otherwise-valid geographical coordinates changed independently from the original preview', async () => {
  const files = fakeStorage();
  const key = '9'.repeat(64);
  const original = new Blob(['immutable-original-geotiff']);
  await writeGeoTiffPreviewCache(key, png(2, 2), { width: 2, height: 2, coordinates });
  expect((await readGeoTiffPreviewCache(key))?.coordinates).toEqual(coordinates);
  const metadata = JSON.parse(await files.get(`${key}.json`)!.text());
  expect(metadata.version).toBe(3);
  expect(metadata.metadataSha256).toMatch(/^[a-f0-9]{64}$/);
  metadata.coordinates = [[-49, 0], [-47, 0], [-47, -1], [-49, -1]];
  files.set(`${key}.json`, new Blob([JSON.stringify(metadata)]));
  expect(await readGeoTiffPreviewCache(key)).toBeNull();
  expect(await original.text()).toBe('immutable-original-geotiff');
});

it('ignores legacy derived metadata without deleting cached files or touching domain data', async () => {
  const files = fakeStorage();
  const key = '8'.repeat(64);
  await writeGeoTiffPreviewCache(key, png(2, 2), { width: 2, height: 2, coordinates });
  const metadata = JSON.parse(await files.get(`${key}.json`)!.text());
  metadata.version = 2;
  files.set(`${key}.json`, new Blob([JSON.stringify(metadata)]));
  expect(await readGeoTiffPreviewCache(key)).toBeNull();
  expect([...files.keys()].sort()).toEqual([`${key}.json`, `${key}.png`]);
});

it('binds metadata integrity to the original cache key and timestamp', async () => {
  const files = fakeStorage();
  const key = '7'.repeat(64);
  const anotherKey = '6'.repeat(64);
  await writeGeoTiffPreviewCache(key, png(2, 2), { width: 2, height: 2, coordinates });
  files.set(`${anotherKey}.png`, files.get(`${key}.png`)!);
  files.set(`${anotherKey}.json`, files.get(`${key}.json`)!);
  expect(await readGeoTiffPreviewCache(anotherKey)).toBeNull();
  const metadata = JSON.parse(await files.get(`${key}.json`)!.text());
  metadata.storedAt += 1;
  files.set(`${key}.json`, new Blob([JSON.stringify(metadata)]));
  expect(await readGeoTiffPreviewCache(key)).toBeNull();
});

it('rejects oversized derived-cache metadata before loading the text into memory', async () => {
  const files = fakeStorage();
  const key = '5'.repeat(64);
  await writeGeoTiffPreviewCache(key, png(2, 2), { width: 2, height: 2, coordinates });
  const originalMetadata = files.get(`${key}.json`)!;
  const oversized = new Blob([new Uint8Array(8192)]);
  const read = vi.fn(() => originalMetadata.text());
  Object.defineProperty(oversized, 'text', { value: read });
  files.set(`${key}.json`, oversized);
  expect(await readGeoTiffPreviewCache(key)).toBeNull();
  expect(read).not.toHaveBeenCalled();
});
