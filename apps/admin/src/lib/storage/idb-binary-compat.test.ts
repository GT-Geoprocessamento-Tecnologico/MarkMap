import { describe, expect, it } from 'vitest';

import { copyBytes, isBlobPreparationError, waitForTransactionAbort } from './idb-binary-compat.mjs';

describe('IndexedDB Blob compatibility error classification', () => {
  it('matches only WebKit Blob/File preparation failures', () => {
    expect(isBlobPreparationError({ name: 'UnknownError', message: 'Error preparing Blob/File data to be stored in object store' })).toBe(true);
    expect(isBlobPreparationError({ name: 'QuotaExceededError', message: 'Error preparing Blob/File data to be stored in object store' })).toBe(false);
    expect(isBlobPreparationError({ name: 'UnknownError', message: 'Quota exceeded' })).toBe(false);
    expect(isBlobPreparationError(new Error('Error preparing Blob/File data to be stored in object store'))).toBe(false);
  });

  it('does not settle on transaction error before abort, and preserves a subarray range', async () => {
    const tx = { error: null, oncomplete: null, onerror: null, onabort: null } as unknown as IDBTransaction & {
      onerror: (() => void) | null;
      onabort: (() => void) | null;
      error: DOMException | null;
    };
    const failure = new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
    const pending = waitForTransactionAbort(tx, () => failure);
    tx.onerror!();
    await Promise.resolve();
    let settled = false;
    void pending.catch(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    tx.error = failure;
    tx.onabort!();
    await expect(pending).rejects.toBe(failure);

    const source = new Uint8Array([1, 2, 3, 4]);
    expect(Array.from(new Uint8Array(copyBytes(source.subarray(1, 3))))).toEqual([2, 3]);
  });
});
