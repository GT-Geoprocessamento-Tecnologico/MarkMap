import { describe, expect, it, vi } from 'vitest';

import { copyBytes, isBlobPreparationError, settleTransaction, shouldMaterializeSmallPackage, SMALL_PACKAGE_BINARY_LIMIT } from './idb-binary-compat.mjs';

type TestTransaction = { error: DOMException | null; abort: ReturnType<typeof vi.fn>; oncomplete: (() => void) | null; onerror: ((event?: Event) => void) | null; onabort: (() => void) | null };
const testTransaction = (): TestTransaction => ({ error: null, abort: vi.fn(), oncomplete: null, onerror: null, onabort: null });

describe('IndexedDB Blob compatibility error classification', () => {
  it('matches only WebKit Blob/File preparation failures', () => {
    expect(isBlobPreparationError({ name: 'UnknownError', message: 'Error preparing Blob/File data to be stored in object store' })).toBe(true);
    expect(isBlobPreparationError({ name: 'QuotaExceededError', message: 'Error preparing Blob/File data to be stored in object store' })).toBe(false);
    expect(isBlobPreparationError({ name: 'UnknownError', message: 'Quota exceeded' })).toBe(false);
    expect(isBlobPreparationError(new Error('Error preparing Blob/File data to be stored in object store'))).toBe(false);
  });

  it('selects bounded ArrayBuffer representation only at the 10 MiB package limit', () => {
    expect(shouldMaterializeSmallPackage(1)).toBe(true);
    expect(shouldMaterializeSmallPackage(SMALL_PACKAGE_BINARY_LIMIT)).toBe(true);
    expect(shouldMaterializeSmallPackage(SMALL_PACKAGE_BINARY_LIMIT + 1)).toBe(false);
    expect(shouldMaterializeSmallPackage(0)).toBe(false);
  });

  it('does not settle on transaction error before abort, and preserves a subarray range', async () => {
    const tx = { error: null, oncomplete: null, onerror: null, onabort: null } as unknown as IDBTransaction & {
      onerror: (() => void) | null;
      onabort: (() => void) | null;
      error: DOMException | null;
    };
    const failure = new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
    const pending = settleTransaction(tx, () => failure, 20);
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

  it('completes healthy writes without arming a rollback timer', async () => {
    vi.useFakeTimers();
    const tx = testTransaction();
    const pending = settleTransaction(tx as unknown as IDBTransaction, () => null, 10);
    tx.oncomplete!();
    await expect(pending).resolves.toBeUndefined();
    vi.advanceTimersByTime(100);
    expect(tx.abort).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('aborts on error and preserves the original error when abort follows', async () => {
    const tx = testTransaction();
    const failure = new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
    const pending = settleTransaction(tx as unknown as IDBTransaction, () => failure, 20);
    tx.onerror!();
    expect(tx.abort).toHaveBeenCalledTimes(1);
    tx.onabort!();
    await expect(pending).rejects.toBe(failure);
    tx.oncomplete?.();
  });

  it('returns a bounded actionable error when WebKit never aborts', async () => {
    vi.useFakeTimers();
    const tx = testTransaction();
    const failure = new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
    const pending = settleTransaction(tx as unknown as IDBTransaction, () => failure, 10);
    tx.onerror!();
    vi.advanceTimersByTime(11);
    await expect(pending).rejects.toMatchObject({ message: 'IndexedDB transaction did not abort after an error', cause: failure });
    vi.useRealTimers();
  });

  it('keeps quota errors distinct and settles once despite late events', async () => {
    const tx = testTransaction();
    const failure = new DOMException('quota', 'QuotaExceededError');
    const pending = settleTransaction(tx as unknown as IDBTransaction, () => failure, 20);
    tx.onerror!();
    tx.onabort!();
    await expect(pending).rejects.toBe(failure);
    expect(isBlobPreparationError(failure)).toBe(false);
    tx.oncomplete?.();
  });

  it('rejects inconclusive completion after an error without enabling fallback', async () => {
    const tx = testTransaction();
    const failure = new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
    const pending = settleTransaction(tx as unknown as IDBTransaction, () => failure, 20);
    tx.onerror!();
    tx.oncomplete!();
    await expect(pending).rejects.toMatchObject({ message: 'IndexedDB transaction completed after an error without confirmed rollback' });
  });

  it('preserves the first Blob error when a later request reports AbortError', async () => {
    const tx = testTransaction();
    const blobError = new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError');
    const abortError = new DOMException('transaction aborted', 'AbortError');
    let requestError: DOMException | null = blobError;
    const pending = settleTransaction(tx as unknown as IDBTransaction, () => requestError, 20);
    tx.onerror!();
    requestError = abortError;
    tx.onerror!();
    tx.onabort!();
    await expect(pending).rejects.toBe(blobError);
  });

  it('uses the transaction error event target when other error sources are empty', async () => {
    const tx = testTransaction();
    const quotaError = new DOMException('quota', 'QuotaExceededError');
    const pending = settleTransaction(tx as unknown as IDBTransaction, () => null, 20);
    tx.onerror!({ target: { error: quotaError } } as unknown as Event);
    tx.onabort!();
    await expect(pending).rejects.toBe(quotaError);
    expect(isBlobPreparationError(quotaError)).toBe(false);
  });
});
