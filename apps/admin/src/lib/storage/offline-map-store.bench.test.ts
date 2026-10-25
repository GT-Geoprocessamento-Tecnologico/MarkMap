import { describe, expect, it, vi } from 'vitest';
import { OfflineMapStore } from './offline-map-store.js';

type MockRecord = Record<string, unknown>;

describe('OfflineMapStore Benchmark / Unit Mock', () => {
  it('measures activate performance and IndexedDB requests executed', async () => {
    const packageId = 'pkg-test';
    const activeGen = 'active-gen-1';
    const nextGen = 'next-gen-target';
    const oldGens = Array.from({ length: 10 }, (_, i) => `old-gen-${i}`);

    const packagesStore: Record<string, MockRecord> = {
      [`${packageId}:${activeGen}`]: {
        key: `${packageId}:${activeGen}`,
        packageId,
        generation: activeGen,
        bytes: 1000,
        state: 'active',
        manifest: { id: packageId, name: 'Test' },
      },
      [`${packageId}:${nextGen}`]: {
        key: `${packageId}:${nextGen}`,
        packageId,
        generation: nextGen,
        bytes: 1000,
        state: 'staged',
        manifest: { id: packageId, name: 'Test' },
      },
    };

    for (const gen of oldGens) {
      packagesStore[`${packageId}:${gen}`] = {
        key: `${packageId}:${gen}`,
        packageId,
        generation: gen,
        bytes: 1000,
        state: 'staged',
        manifest: { id: packageId, name: 'Test' },
      };
    }

    const assetsStore: Record<string, MockRecord> = {};
    for (const gen of [...oldGens, nextGen]) {
      for (let a = 0; a < 50; a++) {
        assetsStore[`${gen}:asset-${a}`] = {
          key: `${gen}:asset-${a}`,
          packageId: gen,
          path: `asset-${a}`,
          bytes: new Blob(['dummy content ' + a]),
        };
      }
    }

    let getAllCount = 0;
    let getAllKeysCount = 0;

    const mockTx = {
      oncomplete: undefined as (() => void) | undefined,
      onabort: undefined as (() => void) | undefined,
      onerror: undefined as (() => void) | undefined,
      abort() {},
      objectStore(name: string) {
        if (name === 'packages') {
          return {
            getAll() {
              getAllCount++;
              const req = { result: Object.values(packagesStore), onsuccess: undefined as (() => void) | undefined, onerror: undefined as (() => void) | undefined };
              queueMicrotask(() => req.onsuccess?.());
              return req;
            },
            delete(key: string) {
              delete packagesStore[key];
            },
            put(val: MockRecord) {
              packagesStore[val.key as string] = val;
            },
          };
        } else {
          return {
            index(_idxName: string) {
              return {
                getAll(gen: string) {
                  getAllCount++;
                  const res = Object.values(assetsStore).filter((a) => a.packageId === gen);
                  const req = { result: res, onsuccess: undefined as (() => void) | undefined, onerror: undefined as (() => void) | undefined };
                  queueMicrotask(() => req.onsuccess?.());
                  return req;
                },
                getAllKeys(gen: string) {
                  getAllKeysCount++;
                  const res = Object.values(assetsStore).filter((a) => a.packageId === gen).map((a) => a.key);
                  const req = { result: res, onsuccess: undefined as (() => void) | undefined, onerror: undefined as (() => void) | undefined };
                  queueMicrotask(() => req.onsuccess?.());
                  return req;
                },
              };
            },
            delete(key: string) {
              delete assetsStore[key];
            },
          };
        }
      },
    };

    const mockDb = {
      transaction() {
        setTimeout(() => mockTx.oncomplete?.(), 0);
        return mockTx;
      },
      close: vi.fn(),
      onversionchange: undefined,
    };

    vi.stubGlobal('indexedDB', {
      open: () => {
        const opening = { result: mockDb, onsuccess: undefined as (() => void) | undefined };
        queueMicrotask(() => opening.onsuccess?.());
        return opening;
      },
    });

    const store = new OfflineMapStore('bench-db');
    await store.activate(packageId, nextGen, activeGen);

    expect(getAllCount).toBe(1);
    expect(getAllKeysCount).toBe(11);
    expect(packagesStore[`${packageId}:${nextGen}`].state).toBe('active');
  });
});
