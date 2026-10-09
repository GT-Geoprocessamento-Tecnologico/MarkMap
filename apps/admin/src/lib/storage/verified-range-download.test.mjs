import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { downloadVerifiedAsset, DownloadIntegrityError } from './verified-range-download.mjs';
const bytes = Buffer.from('regional '.repeat(1000));
const sha = createHash('sha256').update(bytes).digest('hex');
const makeStore = () => ({ map: new Map(),
  async get(hash, offset) { return this.map.get(`${hash}:${offset}`) ?? null; },
  async put(hash, offset, data) { this.map.set(`${hash}:${offset}`, data); },
  async deleteAsset(hash) { for (const k of this.map.keys()) if (k.startsWith(hash + ':')) this.map.delete(k); },
});
const url = 'https://example.invalid/maps/package.pmtiles';
function fetchRange({ failingOffset = -1, tamper = false, ignoreRange = false, calls = [] } = {}) {
  return async (_url, init) => {
    const [from, to] = init.headers.Range.match(/bytes=(\d+)-(\d+)/).slice(1).map(Number);
    calls.push(from);
    if (from === failingOffset) throw Error('simulated network disconnect');
    if (ignoreRange) return new Response(bytes, { status: 200 });
    const data = Buffer.from(bytes.subarray(from, to + 1));
    if (tamper) data[0] ^= 1;
    return new Response(data, { status: 206, headers: { 'Content-Range': `bytes ${from}-${to}/${bytes.length}` } });
  };
}

test('downloads checksummed chunks and resumes without requesting persisted offsets', async () => {
  const store = makeStore(); const calls = [];
  await assert.rejects(() => downloadVerifiedAsset({ url, size: bytes.length, sha256: sha, store,
    chunkSize: 2048, fetcher: fetchRange({ failingOffset: 4096, calls }) }), /network disconnect/);
  const original = calls.length;
  const blob = await downloadVerifiedAsset({ url, size: bytes.length, sha256: sha, store,
    chunkSize: 2048, fetcher: fetchRange({ calls }) });
  assert.equal(Buffer.from(await blob.arrayBuffer()).toString('hex'), bytes.toString('hex'));
  assert.ok(!calls.slice(original).includes(0));
  assert.ok(!calls.slice(original).includes(2048));
});
test('fails closed on corrupted chunks and clears invalid checkpoint', async () => {
  const store = makeStore();
  await assert.rejects(() => downloadVerifiedAsset({ url, size: bytes.length, sha256: sha, store,
    chunkSize: 2048, fetcher: fetchRange({ tamper: true }) }), (e) => e instanceof DownloadIntegrityError && e.code === 'checksum-mismatch');
  assert.equal(store.map.size, 0);
});
test('accepts full-file fallback only from offset zero and validates exact size', async () => {
  const store = makeStore();
  const blob = await downloadVerifiedAsset({ url, size: bytes.length, sha256: sha, store,
    chunkSize: 2048, fetcher: fetchRange({ ignoreRange: true }) });
  assert.equal(blob.size, bytes.length);
});
test('rejects wrong Content-Range and aborts without publishing success', async () => {
  const store = makeStore();
  await assert.rejects(() => downloadVerifiedAsset({ url, size: bytes.length, sha256: sha, store,
    chunkSize: 2048, fetcher: async () => new Response('hi', { status: 206,
      headers: { 'Content-Range': 'bytes 0-1/2' } }) }), /Content-Range/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(() => downloadVerifiedAsset({ url, size: bytes.length, sha256: sha, store,
    chunkSize: 2048, signal: abort.signal, fetcher: fetchRange() }), /cancelled/);
});
