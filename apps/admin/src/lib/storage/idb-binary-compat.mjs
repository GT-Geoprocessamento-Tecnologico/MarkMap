/**
 * WebKit reports this specific failure when it cannot serialize a Blob into
 * an object store. Other UnknownError/quota failures must remain fatal.
 */
export function isBlobPreparationError(error) {
  return error?.name === 'UnknownError' &&
    error?.message === 'Error preparing Blob/File data to be stored in object store';
}

/** Wait for the abort event: WebKit can report tx.onerror before rollback ends. */
export function waitForTransactionAbort(tx, getRequestError = () => null) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => undefined;
    tx.onabort = () => reject(getRequestError() ?? tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function copyBytes(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
