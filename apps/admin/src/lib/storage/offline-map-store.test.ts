import { describe, it, expect, vi } from 'vitest';

describe('OfflineMapStore.remove benchmark', () => {
  it('measures request counts during remove', async () => {
    let getAllIndexCalls = 0;
    let getAllKeysIndexCalls = 0;
    let packagesDeleteCalls = 0;
    let assetsDeleteCalls = 0;

    const mockPackages = [
      { key: 'pkg1:gen1', packageId: 'pkg1', generation: 'gen1', state: 'active', bytes: 100 },
      { key: 'pkg1:gen2', packageId: 'pkg1', generation: 'gen2', state: 'staged', bytes: 100 },
      { key: 'pkg2:gen3', packageId: 'pkg2', generation: 'gen3', state: 'active', bytes: 100 },
    ];

    const mockAssets: Record<string, Array<{ key: string; packageId: string; path: string; bytes: Blob }>> = {
      gen1: Array.from({ length: 50 }, (_, i) => ({ key: `gen1:file${i}`, packageId: 'gen1', path: `file${i}`, bytes: new Blob() })),
      gen2: Array.from({ length: 50 }, (_, i) => ({ key: `gen2:file${i}`, packageId: 'gen2', path: `file${i}`, bytes: new Blob() })),
    };

    function createMockRequest<T>(result: T) {
      let _onsuccess: (() => void) | undefined;
      const req = {
        result,
        get onsuccess() { return _onsuccess; },
        set onsuccess(fn: (() => void) | undefined) {
          _onsuccess = fn;
          if (fn) queueMicrotask(() => fn());
        },
        onerror: undefined as (() => void) | undefined,
      };
      return req;
    }

    const mockAssetsIndex = {
      getAll(gen: string) {
        getAllIndexCalls++;
        return createMockRequest(mockAssets[gen] ?? []);
      },
      getAllKeys(gen: string) {
        getAllKeysIndexCalls++;
        return createMockRequest((mockAssets[gen] ?? []).map(a => a.key));
      }
    };

    const mockAssetsStore = {
      index() { return mockAssetsIndex; },
      delete() { assetsDeleteCalls++; }
    };

    const mockPackagesStore = {
      getAll() {
        return createMockRequest(mockPackages);
      },
      delete() { packagesDeleteCalls++; }
    };

    let txOnComplete: (() => void) | undefined;

    const mockTx = {
      objectStore(name: string) {
        if (name === 'packages') return mockPackagesStore;
        if (name === 'assets') return mockAssetsStore;
        throw new Error('unknown store ' + name);
      },
      get oncomplete() { return txOnComplete; },
      set oncomplete(fn: (() => void) | undefined) {
        txOnComplete = fn;
        if (fn) queueMicrotask(() => fn());
      },
      onabort: undefined as (() => void) | undefined,
      onerror: undefined as (() => void) | undefined,
    };

    const mockDb = {
      transaction() {
        return mockTx;
      }
    };

    vi.stubGlobal('indexedDB', { open: () => ({ result: mockDb, onsuccess: function(this: any) { this.onsuccess(); } }) });

    const { OfflineMapStore } = await import('./offline-map-store');
    const store = new OfflineMapStore('test-db');

    (store as any).dbPromise = Promise.resolve(mockDb);

    const start = performance.now();
    await store.remove('pkg1');
    const duration = performance.now() - start;

    console.log('BENCHMARK RESULTS (POST-OPTIMIZATION):', {
      getAllIndexCalls,
      getAllKeysIndexCalls,
      packagesDeleteCalls,
      assetsDeleteCalls,
      durationMs: duration,
    });

    expect(packagesDeleteCalls).toBe(2);
    expect(assetsDeleteCalls).toBe(100);
    expect(getAllIndexCalls).toBe(0);
    expect(getAllKeysIndexCalls).toBe(2);
  });
});
