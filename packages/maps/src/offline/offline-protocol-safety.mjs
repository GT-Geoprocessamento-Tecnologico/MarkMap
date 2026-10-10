/** Typed, local-only protocol failures. Messages never contain paths or URLs. */
export class OfflineProtocolIntegrityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OfflineProtocolIntegrityError';
    this.code = code;
  }
}

export const offlineAbortError = () => new DOMException('Offline map request cancelled', 'AbortError');

export function assertOfflineByteRange(offset, length, fileSize, maximum) {
  if (![offset, length, fileSize, maximum].every(Number.isSafeInteger) ||
      offset < 0 || length < 0 || fileSize < 0 || maximum <= 0 || length > maximum) {
    throw new OfflineProtocolIntegrityError('invalid-range', 'Invalid offline tile byte range');
  }
  // Compare by subtraction so offset + length cannot overflow a safe integer.
  if (offset > fileSize || length > fileSize - offset) {
    throw new OfflineProtocolIntegrityError('truncated-range', 'Offline tile range is outside the archive');
  }
}

/** Abort a caller promptly, and ALWAYS remove the listener when settled. */
export function abortableOfflineRead(work, signal) {
  if (!signal) return Promise.resolve(work);
  return new Promise((resolve, reject) => {
    let completed = false;
    const finish = (callback, value) => {
      if (completed) return;
      completed = true;
      signal.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => finish(reject, offlineAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(work).then(
      value => finish(resolve, value),
      error => finish(reject, error),
    );
    if (signal.aborted) onAbort();
  });
}

export function assertOfflineAssetBlob(blob, maximum) {
  if (!(blob instanceof Blob)) {
    throw new OfflineProtocolIntegrityError('invalid-asset', 'Invalid offline map asset');
  }
  if (!Number.isSafeInteger(maximum) || maximum <= 0 || blob.size > maximum) {
    throw new OfflineProtocolIntegrityError('asset-too-large', 'offline package asset is too large');
  }
  return blob;
}

export function assertOfflineReadLength(buffer, expected) {
  if (!(buffer instanceof ArrayBuffer) || !Number.isSafeInteger(expected) ||
      expected < 0 || buffer.byteLength !== expected) {
    throw new OfflineProtocolIntegrityError('incomplete-read', 'Incomplete offline map asset read');
  }
  return buffer;
}
