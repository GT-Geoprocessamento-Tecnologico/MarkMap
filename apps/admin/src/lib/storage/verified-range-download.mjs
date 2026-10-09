/**
 * Verified, resumable HTTP Range transfer for an immutable regional asset.
 * No download result is accepted until size and SHA-256 match the manifest.
 * The injected chunk store persists each chunk before progress is reported.
 */
export class DownloadIntegrityError extends Error {
  constructor(code, message) { super(message); this.name = 'DownloadIntegrityError'; this.code = code; }
}
const HEX = /^[a-f0-9]{64}$/i;

export async function downloadVerifiedAsset({
  url, sha256, size, store, fetcher = fetch, signal, onProgress = () => {}, chunkSize = 1024 * 1024,
}) {
  if (typeof url !== 'string' || !/^https:\/\//.test(url) && !/^http:\/\/localhost(?::\d+)?\//.test(url))
    throw new DownloadIntegrityError('invalid-url', 'asset URL must be HTTPS or localhost');
  if (!HEX.test(sha256 ?? '') || !Number.isSafeInteger(size) || size <= 0 || size > 250 * 1024 * 1024)
    throw new DownloadIntegrityError('invalid-asset', 'manifest asset size/checksum invalid');
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024 || chunkSize > 4 * 1024 * 1024)
    throw new DownloadIntegrityError('invalid-chunk-size', 'range chunk size out of bounds');
  const key = sha256.toLowerCase();
  const slices = [];
  let completed = 0;
  const assertNotAborted = () => { if (signal?.aborted) throw new DownloadIntegrityError('aborted', 'download cancelled'); };
  for (let offset = 0; offset < size; offset += chunkSize) {
    assertNotAborted();
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
        if (signal?.aborted) throw new DownloadIntegrityError('aborted', 'download cancelled');
        throw new DownloadIntegrityError('network-error', error instanceof Error ? error.message : 'network failed');
      }
      if (!response.ok || (response.status !== 206 && !(response.status === 200 && offset === 0)))
        throw new DownloadIntegrityError('invalid-response', 'download server must support HTTP Range or return the whole file from offset zero');
      if (response.status === 206) {
        const header = response.headers.get('Content-Range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
        if (!header || Number(header[1]) !== offset || Number(header[2]) !== offset + wanted - 1 || Number(header[3]) !== size)
          throw new DownloadIntegrityError('invalid-content-range', 'server Content-Range does not match manifest');
      }
      let received;
      try { received = new Uint8Array(await response.arrayBuffer()); }
      catch { throw new DownloadIntegrityError('invalid-response', 'could not read response'); }
      if (response.status === 200) {
        if (received.length !== size) throw new DownloadIntegrityError('size-mismatch', 'full response length mismatches manifest');
        // No Range support. Re-chunk and persist only once to avoid redownloading.
        for (let part = 0; part < size; part += chunkSize)
          await store.put(key, part, received.slice(part, Math.min(size, part + chunkSize)));
        chunk = received.subarray(0, wanted);
      } else {
        if (received.length !== wanted) throw new DownloadIntegrityError('size-mismatch', 'range response length mismatches manifest');
        chunk = received;
        await store.put(key, offset, chunk);
      }
    }
    slices.push(chunk);
    completed += chunk.length;
    onProgress({ downloadedBytes: completed, totalBytes: size });
  }
  assertNotAborted();
  const blob = new Blob(slices);
  if (blob.size !== size) throw new DownloadIntegrityError('size-mismatch', 'assembled asset length mismatch');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  const computed = [...digest].map((x) => x.toString(16).padStart(2, '0')).join('');
  if (computed !== key) {
    await store.deleteAsset(key);
    throw new DownloadIntegrityError('checksum-mismatch', 'downloaded bytes do not match immutable manifest SHA-256');
  }
  return blob;
}
