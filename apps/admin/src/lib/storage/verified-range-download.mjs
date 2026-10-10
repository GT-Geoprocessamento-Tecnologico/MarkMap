/**
 * Verified resumable HTTP Range download with bounded response streaming.
 * Each successful chunk reaches durable storage before progress is published.
 */
import { IncrementalSha256 } from '../../../../../packages/maps/src/offline/incremental-sha256.mjs';

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

/**
 * A server ignoring Range may return HTTP 200 only at offset zero.
 * Stream it into fixed-size checkpoints; never response.arrayBuffer() the whole asset.
 */
async function storeFullFallback(response, { size, chunkSize, store, key, signal, slices, hasher, onProgress }) {
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
          hasher.update(target);
          slices.push(target);
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
  onProgress = () => {}, chunkSize = 1024 * 1024,
}) {
  if (typeof url !== 'string' || (!/^https:\/\//.test(url) && !/^http:\/\/localhost(?::\d+)?\//.test(url)))
    throw failure('invalid-url', 'asset URL must be HTTPS or localhost');
  if (!HEX.test(sha256 ?? '') || !Number.isSafeInteger(size) || size <= 0 || size > 250 * 1024 * 1024)
    throw failure('invalid-asset', 'manifest asset size/checksum invalid');
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024 || chunkSize > 4 * 1024 * 1024)
    throw failure('invalid-chunk-size', 'range chunk size out of bounds');

  const key = sha256.toLowerCase();
  const slices = [];
  const hasher = new IncrementalSha256();
  let completed = 0;
  for (let offset = 0; offset < size; offset += chunkSize) {
    assertRunning(signal);
    const wanted = Math.min(size - offset, chunkSize);
    let chunk = await store.get(key, offset);
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
      if (!response.ok || (response.status !== 206 && !(response.status === 200 && offset === 0)))
        throw failure('invalid-response', 'download server must support HTTP Range or return the whole file from offset zero');

      if (response.status === 200) {
        try {
          await storeFullFallback(response, { size, chunkSize, store, key, signal,
            slices, hasher, onProgress });
        } catch (error) {
          // Partial full-response checkpoints must never look like a completed asset.
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

    // Persistent or newly fetched chunk: update the checksum in the correct offset order.
    hasher.update(chunk);
    slices.push(chunk);
    completed += chunk.byteLength;
    onProgress({ downloadedBytes: completed, totalBytes: size });
  }

  assertRunning(signal);
  const blob = new Blob(slices);
  if (blob.size !== size) throw failure('size-mismatch', 'assembled asset length mismatch');
  if (hasher.digestHex() !== key) {
    await store.deleteAsset(key);
    throw failure('checksum-mismatch', 'downloaded bytes do not match immutable manifest SHA-256');
  }
  return blob;
}
