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
  | 'transaction-abort'
  | 'transaction-error-event'
  | 'future-version'
  | 'abort-after-read'
  | 'read-error'
  | 'empty'
  | 'valid-data'
  | 'invalid-binary'
  | 'invalid-map'
  | 'orphan-related'
  | 'packages-only'
  | 'count-error';

type InspectableFactory = IDBFactory & { closeCount(): number; openedName(): string | undefined; valueReads(): number };

function fakeFactory(storeName: string, scenario: Scenario): InspectableFactory {
  let closed = 0;
  let opened: string | undefined;
  let reads = 0;
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
    result: scenario === 'empty' || scenario === 'orphan-related' ? [] : [row],
    onsuccess: null,
    onerror: null,
  } as unknown as IDBRequest<unknown[]>;
  const tx = {
    onabort: null,
    onerror: null,
    oncomplete: null,
    objectStore: (name: string) => ({
      getAll: () => {
        reads += 1;
        queueMicrotask(() => {
          if (scenario === 'transaction-abort') {
            tx.onabort?.(new Event('abort'));
          } else if (scenario === 'transaction-error-event') {
            tx.onerror?.(new Event('error'));
          } else if (scenario === 'read-error') {
            getAll.onerror?.(new Event('error'));
            tx.onabort?.(new Event('abort'));
          } else {
            getAll.onsuccess?.(new Event('success'));
            if (scenario === 'abort-after-read') tx.onabort?.(new Event('abort'));
            else queueMicrotask(() => tx.oncomplete?.(new Event('complete')));
          }
        });
        return getAll;
      },
      count: () => {
        const primary = name === storeName;
        const result = scenario === 'empty' || (scenario === 'orphan-related' && primary) ||
          (scenario === 'packages-only' && !primary) ? 0 : 1;
        const request = { result, onsuccess: null, onerror: null } as unknown as IDBRequest<number>;
        queueMicrotask(() => {
          if (scenario === 'transaction-abort') tx.onabort?.(new Event('abort'));
          else if (scenario === 'transaction-error-event') tx.onerror?.(new Event('error'));
          else if (scenario === 'read-error' || (scenario === 'count-error' && !primary)) request.onerror?.(new Event('error'));
          else {
            request.onsuccess?.(new Event('success'));
            if (scenario === 'abort-after-read') tx.onabort?.(new Event('abort'));
            else queueMicrotask(() => tx.oncomplete?.(new Event('complete')));
          }
        });
        return request;
      },
    }),
  } as unknown as IDBTransaction;
  const db = {
    version: scenario === 'future-version' ? 2 : 1,
    objectStoreNames: { contains: (name: string) => scenario !== 'missing-store' && (name === storeName || name === 'assets' || name === 'metadata') },
    close: () => { closed += 1; },
    transaction: () => {
      if (scenario === 'transaction-error') throw new Error('transacao bloqueada');
      return tx;
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
    closeCount: () => closed,
    openedName: () => opened,
    valueReads: () => reads,
    open: (name: string) => {
      opened = name;
      if (scenario === 'open-error') throw new Error('abertura indisponivel');
      queueMicrotask(() => {
        if (scenario === 'missing-db') {
          request.onupgradeneeded?.(new Event('upgradeneeded') as IDBVersionChangeEvent);
          request.onerror?.(new Event('error'));
        } else if (scenario === 'blocked') {
          request.onblocked?.(new Event('blocked') as IDBVersionChangeEvent);
        } else {
          request.onsuccess?.(new Event('success'));
        }
      });
      return request;
    },
  } as unknown as InspectableFactory;
}

const readers = [
  { name: 'local engine', store: 'store', read: readLocalEngineSnapshot },
  { name: 'malhas 3D', store: 'meshes', read: readMeshesSnapshot },
  { name: 'blobs grandes', store: 'blobs', read: readLargeBlobsSnapshot },
  { name: 'mapas offline', store: 'packages', read: readOfflineMapsSnapshot },
] as const;

describe('backup multibanco: erros nunca significam ausencia de dados', () => {
  for (const { name, store, read } of readers) {
    it(name + ': somente abertura de banco inexistente retorna absent', async () => {
      const result = await read(fakeFactory(store, 'missing-db'));
      expect(result.coverage).toMatchObject({ status: 'absent', recordCount: 0 });
      expect(result.records).toEqual([]);
    });

    it(name + ': banco existente vazio tem contagem zero', async () => {
      const result = await read(fakeFactory(store, 'empty'));
      expect(result.coverage).toMatchObject({ status: 'absent', recordCount: 0 });
    });

    it(name + ': banco com registros informa cobertura fiel', async () => {
      const factory = fakeFactory(store, 'valid-data');
      const result = await read(factory);
      expect(result.coverage).toMatchObject({ status: 'pending', recordCount: null });
      expect(result.records).toHaveLength(0);
      expect(factory.valueReads()).toBe(0);
      expect(factory.closeCount()).toBe(1);
    });

    for (const scenario of [
      'open-error', 'blocked', 'missing-store', 'future-version', 'transaction-error',
      'transaction-abort', 'transaction-error-event', 'abort-after-read', 'read-error',
    ] as const) {
      it(name + ': ' + scenario + ' interrompe backup em vez de omitir dados', async () => {
        const factory = fakeFactory(store, scenario);
        await expect(read(factory)).rejects.toThrow();
        if (scenario === 'transaction-abort' || scenario === 'transaction-error-event' || scenario === 'abort-after-read') {
          expect(factory.closeCount()).toBe(1);
        }
      });
    }
  }

  it('não materializa bytes de malhas ou blobs ainda não suportados', async () => {
    for (const { store, read } of [
      { store: 'meshes', read: readMeshesSnapshot },
      { store: 'blobs', read: readLargeBlobsSnapshot },
    ]) {
      const factory = fakeFactory(store, 'invalid-binary');
      expect((await read(factory)).coverage.status).toBe('pending');
      expect(factory.valueReads()).toBe(0);
    }
  });

  it('consulta o banco canônico de mapas e não declara completo sem os assets', async () => {
    const factory = fakeFactory('packages', 'valid-data');
    const result = await readOfflineMapsSnapshot(factory);
    expect(factory.openedName()).toBe('GeoNexoOfflineMapPackages');
    expect(result.coverage).toMatchObject({ status: 'pending', recordCount: null });
  });

  it('um pacote sem assets também permanece pendente', async () => {
    const result = await readOfflineMapsSnapshot(fakeFactory('packages', 'packages-only'));
    expect(result.coverage).toMatchObject({ status: 'pending', recordCount: null });
    expect(result.records).toEqual([]);
  });

  it.each([
    { name: 'assets de mapa órfãos', store: 'packages', read: readOfflineMapsSnapshot },
    { name: 'metadados de blob órfãos', store: 'blobs', read: readLargeBlobsSnapshot },
  ])('$name nunca são declarados ausentes', async ({ store, read }) => {
    const result = await read(fakeFactory(store, 'orphan-related'));
    expect(result.coverage).toMatchObject({ status: 'pending', recordCount: null });
  });

  it.each([
    { store: 'packages', read: readOfflineMapsSnapshot },
    { store: 'blobs', read: readLargeBlobsSnapshot },
  ])('falha ao contar store relacionado interrompe a leitura de $store', async ({ store, read }) => {
    await expect(read(fakeFactory(store, 'count-error'))).rejects.toThrow(/contar/);
  });
});
