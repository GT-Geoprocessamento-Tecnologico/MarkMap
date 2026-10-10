/**
 * Verified resumable HTTP Range download with bounded response streaming.
 * Each successful chunk reaches durable storage before progress is published.
 */
import { IncrementalSha256 } from '../../../../../packages/maps/src/offline/incremental-sha256.mjs';
import { REGION_DOWNLOAD_CHUNK_SIZE } from './checkpoint-rules.mjs';

export class DownloadIntegrityError extends Error {
  constructor(code, message) { super(message); this.name = 'DownloadIntegrityError'; this.code = code; }
}
const HEX = /^[a-f0-9]{64}$/i;
const failure = (code, message) => new DownloadIntegrityError(code, message);
const assertRunning = (signal) => {
  if (signal?.aborted) throw failure('aborted', 'download cancelled');
};

/** Read a Range response with an absolute upper bound before allocating a chunk. */
async function readExactRange(response, wanted, signal) {
  const reader = response.body?.getReader();
  if (!reader) throw failure('invalid-response', 'range response body is missing');
  const buffer = new Uint8Array(wanted);
  let length = 0;
  try {
    while (true) {
      assertRunning(signal);
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || value.byteLength + length > wanted)
        throw failure('size-mismatch', 'range response exceeded expected length');
      buffer.set(value, length);
      length += value.byteLength;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (signal?.aborted) throw failure('aborted', 'download cancelled');
    if (error instanceof DownloadIntegrityError) throw error;
    throw failure('network-error', error instanceof Error ? error.message : 'range stream failed');
  } finally { reader.releaseLock(); }
  if (length !== wanted) throw failure('size-mismatch', 'range response shorter than manifest');
  return buffer;
}

/** Read immutable Blob checkpoints without retaining every ArrayBuffer in RAM. */
async function existingPart(store, key, offset, wanted) {
  if (typeof store.getBlob !== 'function') return null;
  const part = await store.getBlob(key, offset);
  return part instanceof Blob && part.size === wanted ? part : null;
}

/** A successful store.put must be readable before claiming progress. */
async function persistedPart(store, key, offset, bytes) {
  if (typeof store.getBlob !== 'function') return new Blob([bytes]);
  const part = await existingPart(store, key, offset, bytes.byteLength);
  if (!part) throw failure('checkpoint-unreadable', 'stored chunk is missing or invalid');
  return part;
}

async function hashPart(hasher, part) {
  // Each part is at most chunkSize (<= 4 MiB), never the entire package.
  hasher.update(new Uint8Array(await part.arrayBuffer()));
}

/**
 * A server ignoring Range may return HTTP 200 only at offset zero.
 * Stream it into fixed-size checkpoints; never response.arrayBuffer() the whole asset.
 */
async function storeFullFallback(response, { size, chunkSize, store, key, signal, parts, hasher, onProgress }) {
  const reader = response.body?.getReader();
  if (!reader) throw failure('invalid-response', 'full response body is missing');
  let saved = 0;
  let buffered = 0;
  let target = new Uint8Array(Math.min(size, chunkSize));
  try {
    while (true) {
      assertRunning(signal);
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || value.byteLength > size - saved - buffered)
        throw failure('size-mismatch', 'full response exceeds manifest length');
      let at = 0;
      while (at < value.byteLength) {
        assertRunning(signal);
        const copied = Math.min(value.byteLength - at, target.length - buffered);
        target.set(value.subarray(at, at + copied), buffered);
        buffered += copied;
        at += copied;
        if (buffered === target.length) {
          // Checkpoint first; incomplete chunks are never made resumable.
          await store.put(key, saved, target);
          const part = await persistedPart(store, key, saved, target);
          await hashPart(hasher, part);
          parts.push(part);
          saved += target.length;
          onProgress({ downloadedBytes: saved, totalBytes: size });
          buffered = 0;
          if (saved < size) target = new Uint8Array(Math.min(size - saved, chunkSize));
        }
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (signal?.aborted) throw failure('aborted', 'download cancelled');
    if (error instanceof DownloadIntegrityError) throw error;
    throw failure('network-error', error instanceof Error ? error.message : 'download stream failed');
  } finally { reader.releaseLock(); }
  if (saved !== size || buffered !== 0)
    throw failure('size-mismatch', 'full response shorter than manifest');
}

export async function downloadVerifiedAsset({
  url, sha256, size, store, fetcher = fetch, signal,
  onProgress = () => {}, chunkSize = REGION_DOWNLOAD_CHUNK_SIZE,
}) {
  if (typeof url !== 'string' || (!/^https:\/\//.test(url) && !/^http:\/\/localhost(?::\d+)?\//.test(url)))
    throw failure('invalid-url', 'asset URL must be HTTPS or localhost');
  if (!HEX.test(sha256 ?? '') || !Number.isSafeInteger(size) || size <= 0 || size > 250 * 1024 * 1024)
    throw failure('invalid-asset', 'manifest asset size/checksum invalid');
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024 || chunkSize > 4 * 1024 * 1024)
    throw failure('invalid-chunk-size', 'range chunk size out of bounds');

  const key = sha256.toLowerCase();
  const parts = [];
  let hasher = new IncrementalSha256();
  let completed = 0;
  for (let offset = 0; offset < size; offset += chunkSize) {
    assertRunning(signal);
    const wanted = Math.min(size - offset, chunkSize);
    let part = await existingPart(store, key, offset, wanted);

    if (!part) {
      // Adapter compatibility: existing test/memory stores only implement get().
      let chunk = typeof store.getBlob === 'function' ? null : await store.get(key, offset);
      if (!(chunk instanceof Uint8Array && chunk.length === wanted)) chunk = null;
      if (!chunk) {
        let response;
        try {
          response = await fetcher(url, {
            method: 'GET', headers: { Range: `bytes=${offset}-${offset + wanted - 1}` },
            signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
          });
        } catch (error) {
          if (signal?.aborted) throw failure('aborted', 'download cancelled');
          throw failure('network-error', error instanceof Error ? error.message : 'network failed');
        }
        if (!response.ok || (response.status !== 206 && response.status !== 200))
          throw failure('invalid-response', 'download server must return HTTP 206 or a full HTTP 200');
        if (response.status === 200) {
          // Server ignored Range, possibly after we reused earlier checkpoints.
          // Restart the digest/assembly from zero, never concatenate old+new bytes.
          const progressFloor = completed;
          parts.length = 0;
          hasher = new IncrementalSha256();
          try {
            await storeFullFallback(response, { size, chunkSize, store, key, signal,
              parts, hasher, onProgress: (p) => {
                // A resumed download should not make visible progress go backwards.
                if (p.downloadedBytes >= progressFloor)
                  onProgress(p);
              } });
          } catch (error) {
            // Do not retain partial full-response checkpoints after a failed response.
            await store.deleteAsset(key).catch(() => undefined);
            throw error;
          }
          completed = size;
          break;
        }
        const header = response.headers.get('Content-Range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
        if (!header || Number(header[1]) !== offset ||
            Number(header[2]) !== offset + wanted - 1 || Number(header[3]) !== size)
          throw failure('invalid-content-range', 'server Content-Range does not match manifest');
        chunk = await readExactRange(response, wanted, signal);
        await store.put(key, offset, chunk);
      }
      part = await persistedPart(store, key, offset, chunk);
    }

    // Hash the exact immutable Blob part we will return, not a separate copy.
    await hashPart(hasher, part);
    parts.push(part);
    completed += wanted;
    onProgress({ downloadedBytes: completed, totalBytes: size });
  }

  assertRunning(signal);
  if (hasher.digestHex() !== key) {
    await store.deleteAsset(key);
    throw failure('checksum-mismatch', 'downloaded bytes do not match immutable manifest SHA-256');
  }
  // Blob-backed IndexedDB parts avoid retaining all typed chunks in JS heap.
  // The browser decides how Blob composition is backed; device RAM is not guaranteed.
  const blob = new Blob(parts);
  if (blob.size !== size) throw failure('size-mismatch', 'assembled asset length mismatch');
  return blob;
}
