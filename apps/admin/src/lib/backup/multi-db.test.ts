import { describe, expect, it } from 'vitest';
import {
  readLargeBlobsSnapshot,
  readLocalEngineSnapshot,
  readMeshesSnapshot,
  readOfflineMapsSnapshot,
} from './multi-db';

// Fake IDB events exercise error paths without opening or modifying real storage.
type Scenario =
  | 'missing-db'
  | 'open-error'
  | 'blocked'
  | 'missing-store'
  | 'transaction-error'
  | 'read-error'
  | 'empty'
  | 'valid-data'
  | 'invalid-binary'
  | 'invalid-map';

function fakeFactory(storeName: string, scenario: Scenario): IDBFactory {
  const row =
    storeName === 'store'
      ? { id: 'a', collection: 'projects', payload: {}, updatedAt: '2026-01-01' }
      : storeName === 'meshes'
        ? { meshId: 'm1', name: 'Malha', glb: scenario === 'invalid-binary' ? 'bad' : new Uint8Array([1, 2]), createdAt: '2026-01-01' }
        : storeName === 'blobs'
          ? { key: 'b1', data: scenario === 'invalid-binary' ? 'bad' : new Uint8Array([3, 4]), lastModified: '2026-01-01' }
          : scenario === 'invalid-map'
            ? null
            : { packageId: 'p1', state: 'active', bytes: 42, generation: '1', assets: ['a'] };
  const getAll = {
    result: scenario === 'empty' ? [] : [row],
    onsuccess: null,
    onerror: null,
  } as unknown as IDBRequest<unknown[]>;
  const db = {
    objectStoreNames: { contains: (name: string) => scenario !== 'missing-store' && (name === storeName || name === 'assets') },
    close: () => undefined,
    transaction: () => {
      if (scenario === 'transaction-error') throw new Error('transacao bloqueada');
      return {
        objectStore: () => ({
          getAll: () => {
            queueMicrotask(() => {
              if (scenario === 'read-error') getAll.onerror?.(new Event('error'));
              else getAll.onsuccess?.(new Event('success'));
            });
            return getAll;
          },
        }),
      };
    },
  } as unknown as IDBDatabase;
  const request = {
    result: db,
    error: new DOMException('falha simulada', 'UnknownError'),
    transaction: { abort: () => undefined },
    onupgradeneeded: null,
    onerror: null,
    onsuccess: null,
    onblocked: null,
  } as unknown as IDBOpenDBRequest;

  return {
    open: () => {
      if (scenario === 'open-error') throw new Error('abertura indisponivel');
      queueMicrotask(() => {
        if (scenario === 'missing-db') {
          request.onupgradeneeded?.(new Event('upgradeneeded'));
          request.onerror?.(new Event('error'));
        } else if (scenario === 'blocked') {
          request.onblocked?.(new Event('blocked'));
        } else {
          request.onsuccess?.(new Event('success'));
        }
      });
      return request;
    },
  } as unknown as IDBFactory;
}

const readers = [
  { name: 'local engine', store: 'store', read: readLocalEngineSnapshot },
  { name: 'malhas 3D', store: 'meshes', read: readMeshesSnapshot },
  { name: 'blobs grandes', store: 'blobs', read: readLargeBlobsSnapshot },
  { name: 'mapas offline', store: 'packages', read: readOfflineMapsSnapshot },
] as const;

describe('backup multibanco: erros nunca significam ausencia de dados', () => {
  for (const { name, store, read } of readers) {
    it(`${name}: somente abertura de banco inexistente retorna absent`, async () => {
      const result = await read(fakeFactory(store, 'missing-db'));
      expect(result.coverage).toMatchObject({ status: 'absent', recordCount: 0 });
      expect(result.records).toEqual([]);
    });

    it(`${name}: banco existente vazio tem contagem zero`, async () => {
      const result = await read(fakeFactory(store, 'empty'));
      expect(result.coverage).toMatchObject({ status: 'absent', recordCount: 0 });
    });

    it(`${name}: banco com registros retorna included`, async () => {
      const result = await read(fakeFactory(store, 'valid-data'));
      expect(result.coverage).toMatchObject({ status: 'included', recordCount: 1 });
      expect(result.records).toHaveLength(1);
    });

    for (const scenario of ['open-error', 'blocked', 'missing-store', 'transaction-error', 'read-error'] as const) {
      it(`${name}: ${scenario} interrompe backup em vez de omitir dados`, async () => {
        await expect(read(fakeFactory(store, scenario))).rejects.toThrow();
      });
    }
  }

  it('malha com bytes ilegíveis não vira seção ausente', async () => {
    await expect(readMeshesSnapshot(fakeFactory('meshes', 'invalid-binary'))).rejects.toThrow(/Binario/);
  });

  it('blob com bytes ilegíveis não vira seção ausente', async () => {
    await expect(readLargeBlobsSnapshot(fakeFactory('blobs', 'invalid-binary'))).rejects.toThrow(/Binario/);
  });

  it('metadados nulos de mapa não deixam o leitor pendurado', async () => {
    await expect(readOfflineMapsSnapshot(fakeFactory('packages', 'invalid-map'))).rejects.toThrow(/Metadados/);
  });
});
