import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { downloadVerifiedAsset, DownloadIntegrityError } from '../apps/admin/src/lib/storage/verified-range-download.mjs';
import {
  isValidCheckpoint, REGION_DOWNLOAD_CHUNK_SIZE, unreferencedSessionHashes,
} from '../apps/admin/src/lib/storage/checkpoint-rules.mjs';

const source = Buffer.from('verified-blob-checkpoint-'.repeat(2307));
const digest = createHash('sha256').update(source).digest('hex');
const url = 'https://example.invalid/maps/package.pmtiles';
const chunkSize = 4096;

function blobStore() {
  const data = new Map();
  let blobGets = 0;
  return {
    data,
    get blobGets() { return blobGets; },
    async get() { throw Error('Uint8Array get() must not be used by Blob-aware store'); },
    async getBlob(sha, offset) { blobGets++; return data.get(`${sha}:${offset}`) ?? null; },
    async put(sha, offset, bytes) { data.set(`${sha}:${offset}`, new Blob([bytes])); },
    async deleteAsset(sha) { for (const k of data.keys()) if (k.startsWith(sha + ':')) data.delete(k); },
  };
}
function rangeFetcher(calls, { failOffset = -1, corrupt = false, ignoreRange = false } = {}) {
  return async (_url, init) => {
    const [start, end] = /^bytes=(\d+)-(\d+)$/.exec(init.headers.Range).slice(1).map(Number);
    calls.push(start);
    if (start === failOffset) throw Error('temporary network drop');
    if (ignoreRange) return new Response(source, { status: 200 });
    const payload = Buffer.from(source.subarray(start, end + 1));
    if (corrupt) payload[0] ^= 1;
    return new Response(payload, { status: 206,
      headers: { 'Content-Range': `bytes ${start}-${end}/${source.byteLength}` } });
  };
}

test('A8 stores immutable Blob parts and resumes without loading byte-array cache', async () => {
  const store = blobStore();
  const calls = [];
  await assert.rejects(() => downloadVerifiedAsset({ url, sha256: digest, size: source.length,
    store, chunkSize, fetcher: rangeFetcher(calls, { failOffset: chunkSize * 2 }) }), /network drop/);
  assert.ok(store.data.size === 2 && store.blobGets >= 2);
  const previousCalls = calls.length;
  const blob = await downloadVerifiedAsset({ url, sha256: digest, size: source.length,
    store, chunkSize, fetcher: rangeFetcher(calls) });
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), source);
  assert.ok(!calls.slice(previousCalls).includes(0));
  assert.ok(!calls.slice(previousCalls).includes(chunkSize));
  assert.ok([...store.data.values()].every((v) => v instanceof Blob));
});

test('A8 hashes the returned Blob checkpoint, not a separate response buffer', async () => {
  const store = blobStore();
  const originalPut = store.put;
  store.put = async (hash, offset, bytes) => {
    const altered = Uint8Array.from(bytes);
    altered[0] ^= 0xff;
    await originalPut(hash, offset, altered);
  };
  await assert.rejects(() => downloadVerifiedAsset({ url, sha256: digest, size: source.length,
    store, chunkSize, fetcher: rangeFetcher([]) }),
  (e) => e instanceof DownloadIntegrityError && e.code === 'checksum-mismatch');
  assert.equal(store.data.size, 0);
});

test('A8 rejects incorrectly sized persisted Blob and redownloads exact range', async () => {
  const store = blobStore();
  store.data.set(`${digest}:0`, new Blob([Buffer.alloc(chunkSize - 1)]));
  const calls = [];
  const blob = await downloadVerifiedAsset({ url, sha256: digest, size: source.length,
    store, chunkSize, fetcher: rangeFetcher(calls) });
  assert.ok(calls.includes(0));
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), source);
});

test('A8 verifies HTTP 200 streamed checkpoints using Blob readback', async () => {
  const store = blobStore();
  const blob = await downloadVerifiedAsset({ url, sha256: digest, size: source.length,
    store, chunkSize, fetcher: rangeFetcher([], { ignoreRange: true }) });
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), source);
  assert.equal(store.data.size, Math.ceil(source.length / chunkSize));
});

test('A9 counts only complete, aligned checkpoint chunks', () => {
  const total = 2 * REGION_DOWNLOAD_CHUNK_SIZE + 123;
  assert.equal(isValidCheckpoint(0, REGION_DOWNLOAD_CHUNK_SIZE, total), true);
  assert.equal(isValidCheckpoint(REGION_DOWNLOAD_CHUNK_SIZE, REGION_DOWNLOAD_CHUNK_SIZE, total), true);
  assert.equal(isValidCheckpoint(2 * REGION_DOWNLOAD_CHUNK_SIZE, 123, total), true);
  assert.equal(isValidCheckpoint(123, REGION_DOWNLOAD_CHUNK_SIZE, total), false);
  assert.equal(isValidCheckpoint(REGION_DOWNLOAD_CHUNK_SIZE, 56, total), false);
  assert.equal(isValidCheckpoint(3 * REGION_DOWNLOAD_CHUNK_SIZE, 12, total), false);
  assert.equal(isValidCheckpoint(-1, 32, total), false);
  assert.equal(isValidCheckpoint(0, 0, total), false);
});

test('A9 session cleanup never selects hashes referenced by other regions', () => {
  const sessions = [
    { packageId: 'a', hashes: ['sha-1', 'sha-2', 'sha-1'] },
    { packageId: 'b', hashes: ['sha-2', 'sha-3'] },
  ];
  assert.deepEqual(unreferencedSessionHashes('a', sessions), ['sha-1']);
  assert.deepEqual(unreferencedSessionHashes('b', sessions), ['sha-3']);
  assert.deepEqual(unreferencedSessionHashes('absent', sessions), []);
  assert.deepEqual(unreferencedSessionHashes('alone', [{ packageId: 'alone', hashes: ['a', 'b'] }]), ['a', 'b']);
});

test('A9 recovers from HTTP 200 on a resumed nonzero Range by restarting and rehashing', async () => {
  const store = blobStore();
  store.data.set(`${digest}:0`, new Blob([source.subarray(0, chunkSize)]));
  const calls = [];
  const progress = [];
  const blob = await downloadVerifiedAsset({
    url, sha256: digest, size: source.length, store, chunkSize,
    onProgress: (p) => progress.push(p.downloadedBytes),
    fetcher: rangeFetcher(calls, { ignoreRange: true }),
  });
  assert.equal(calls[0], chunkSize);
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), source);
  assert.equal(progress.at(-1), source.length);
  assert.ok(progress.every((n, i) => i === 0 || n >= progress[i - 1]));
});
