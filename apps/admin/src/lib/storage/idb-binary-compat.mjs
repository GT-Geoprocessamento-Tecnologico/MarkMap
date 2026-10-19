/**
 * WebKit reports this specific failure when it cannot serialize a Blob into
 * an object store. Other UnknownError/quota failures must remain fatal.
 */
export function isBlobPreparationError(error) {
  return error?.name === 'UnknownError' &&
    error?.message === 'Error preparing Blob/File data to be stored in object store';
}

/**
 * Settle a transaction without allowing WebKit's early onerror to strand it.
 * The timeout is armed only after an error; healthy writes have no timer.
 */
export function settleTransaction(tx, getRequestError = () => null, rollbackTimeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let hadError = false;
    let firstError = null;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      tx.oncomplete = null;
      tx.onerror = null;
      tx.onabort = null;
      if (error) reject(error); else resolve();
    };
    const armRollbackTimeout = (original) => {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        const timeout = new Error('IndexedDB transaction did not abort after an error');
        timeout.cause = original;
        finish(timeout);
      }, rollbackTimeoutMs);
    };
    tx.oncomplete = () => finish(hadError ? new Error('IndexedDB transaction completed after an error without confirmed rollback') : undefined);
    tx.onerror = (event) => {
      hadError = true;
      const eventError = event?.target?.error;
      const original = getRequestError() ?? tx.error ?? eventError ?? new Error('IndexedDB transaction failed');
      firstError ??= original;
      armRollbackTimeout(original);
      try { tx.abort(); } catch { /* abort may already be in progress */ }
    };
    tx.onabort = () => finish(firstError ?? getRequestError() ?? tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export const waitForTransactionAbort = settleTransaction;

export function copyBytes(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
