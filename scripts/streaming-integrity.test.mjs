import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { IncrementalSha256, sha256Blob } from '../packages/maps/src/offline/incremental-sha256.mjs';
import { downloadVerifiedAsset, DownloadIntegrityError } from '../apps/admin/src/lib/storage/verified-range-download.mjs';

const reference = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = Buffer.from(Array.from({ length: 513_257 }, (_, i) => (i * 37 + (i >> 6)) & 255));
const sha = reference(source);
const url = 'https://example.invalid/region/package.pmtiles';
const store = () => ({ chunks: new Map(),
  async get(hash, offset) { return this.chunks.get(hash + ':' + offset) ?? null; },
  async put(hash, offset, bytes) { this.chunks.set(hash + ':' + offset, bytes); },
  async deleteAsset(hash) { for (const k of this.chunks.keys()) if (k.startsWith(hash + ':')) this.chunks.delete(k); },
});
function streamOf(bytes, pieces = 317) {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      const end = Math.min(bytes.length, offset + pieces);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}

test('A5 SHA-256 vectors match Node crypto across arbitrary block boundaries', () => {
  for (const bytes of [
    Buffer.alloc(0), Buffer.from('abc'), Buffer.alloc(55, 97), Buffer.alloc(56, 97),
    Buffer.alloc(63, 97), Buffer.alloc(64, 97), Buffer.alloc(65, 97),
    Buffer.alloc(1000, 97), Buffer.alloc(1_000_000, 97), source,
  ]) {
    for (const stride of [1, 7, 59, 64, 1025]) {
      const hash = new IncrementalSha256();
      for (let i = 0; i < bytes.length; i += stride)
        hash.update(bytes.subarray(i, Math.min(i + stride, bytes.length)));
      assert.equal(hash.digestHex(), reference(bytes));
      assert.equal(hash.digestHex(), reference(bytes));
      assert.throws(() => hash.update(new Uint8Array()), /finalized/);
    }
  }
});

test('A5 Blob checksum uses bounded slices, not Blob.arrayBuffer for entire archive', async () => {
  const blob = new Blob([source]);
  blob.arrayBuffer = () => { throw Error('unbounded Blob.arrayBuffer called'); };
  assert.equal(await sha256Blob(blob, 1024), sha);
});

test('A6 full-file HTTP 200 is checkpointed progressively without response.arrayBuffer', async () => {
  const chunks = store();
  const progress = [];
  const result = await downloadVerifiedAsset({
    url, size: source.length, sha256: sha, store: chunks, chunkSize: 16_384,
    onProgress: (p) => progress.push(p.downloadedBytes),
    fetcher: async (_url, opts) => {
      assert.equal(opts.credentials, 'omit');
      return new Response(streamOf(source), { status: 200 });
    },
  });
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), source);
  assert.ok(progress.length > 3 && progress.every((n, i) => i === 0 || n > progress[i - 1]));
  assert.equal(progress.at(-1), source.length);
  assert.ok(chunks.chunks.size > 1);
});

test('A6 oversized HTTP 200 aborts and discards partial checkpoints', async () => {
  const chunks = store();
  await assert.rejects(downloadVerifiedAsset({
    url, size: source.length, sha256: sha, store: chunks, chunkSize: 16_384,
    fetcher: async () => new Response(streamOf(Buffer.concat([source, Buffer.from('EXTRA')])), { status: 200 }),
  }), (error) => error instanceof DownloadIntegrityError && error.code === 'size-mismatch');
  assert.equal(chunks.chunks.size, 0);
});

test('A6 truncated HTTP Range is rejected before checkpoint commit', async () => {
  const chunks = store();
  await assert.rejects(downloadVerifiedAsset({
    url, size: source.length, sha256: sha, store: chunks, chunkSize: 8192,
    fetcher: async () => new Response(streamOf(source.subarray(0, 50)), {
      status: 206,
      headers: { 'Content-Range': `bytes 0-8191/${source.length}` },
    }),
  }), (error) => error instanceof DownloadIntegrityError && error.code === 'size-mismatch');
  assert.equal(chunks.chunks.size, 0);
});

test('A6 excessive HTTP Range bytes are rejected before checkpoint commit', async () => {
  const chunks = store();
  await assert.rejects(downloadVerifiedAsset({
    url, size: source.length, sha256: sha, store: chunks, chunkSize: 8192,
    fetcher: async () => new Response(streamOf(source.subarray(0, 8193)), {
      status: 206,
      headers: { 'Content-Range': `bytes 0-8191/${source.length}` },
    }),
  }), (error) => error instanceof DownloadIntegrityError && error.code === 'size-mismatch');
  assert.equal(chunks.chunks.size, 0);
});
