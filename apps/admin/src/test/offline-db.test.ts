import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function harness() {
  const request: { onsuccess?: () => void; onerror?: () => void; error?: Error } = {};
  const tx: { oncomplete?: () => void; onabort?: () => void; onerror?: () => void; error?: Error; objectStore: () => unknown } = {
    objectStore: () => ({ put: () => request }),
  };
  const db = { transaction: () => tx, close: vi.fn(), onversionchange: undefined };
  const opening: { result: typeof db; onsuccess?: () => void; onerror?: () => void } = { result: db };
  vi.stubGlobal('indexedDB', { open: () => opening });
  const { offlineDB } = await import('../lib/storage/offline-db');
  const write = offlineDB.save('datasets', 'fixture', { original: 'retained' });
  opening.onsuccess?.();
  await Promise.resolve();
  return { write, request, tx };
}

describe('local write transaction durability', () => {
  it('waits for transaction completion after request success', async () => {
    const { write, request, tx } = await harness();
    let finished = false;
    void write.then(() => { finished = true; });
    request.onsuccess?.();
    await Promise.resolve();
    expect(finished).toBe(false);
    tx.oncomplete?.();
    await write;
    expect(finished).toBe(true);
  });

  it('rejects an abort after a successful request', async () => {
    const { write, request, tx } = await harness();
    const assertion = expect(write).rejects.toThrow('quota');
    request.onsuccess?.();
    tx.error = new Error('quota');
    tx.onabort?.();
    await assertion;
  });

  it('reports transaction errors without confirming a save', async () => {
    const { write, tx } = await harness();
    const assertion = expect(write).rejects.toThrow('Não foi possível gravar');
    tx.onerror?.();
    await assertion;
  });
});
