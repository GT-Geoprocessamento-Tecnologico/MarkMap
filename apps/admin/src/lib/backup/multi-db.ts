import type { BackupCoverage } from './manifest';
import { OFFLINE_PACKAGE_DB, OFFLINE_PACKAGE_VERSION } from '@markmap/maps/offline/package';

export interface LocalEngineRecord {
  id: string;
  collection: string;
  payload: unknown;
  updatedAt: string;
}

export interface MeshRecord {
  meshId: string;
  name: string;
  glbBase64: string;
  size: number;
  createdAt: string;
  view?: unknown;
}

export interface LargeBlobRecord {
  key: string;
  bytesBase64: string;
  size: number;
  lastModified: string;
  etag?: string;
  checksum?: string;
}

export interface OfflineMapRecord {
  packageId: string;
  state: string;
  bytes: number;
  generation: string;
  /** Individual assets are not enumerated until a complete exporter exists. */
  assetsCount: number | null;
}

function resolveIDBFactory(customFactory?: IDBFactory): IDBFactory | null {
  if (customFactory) return customFactory;
  if (typeof indexedDB !== 'undefined') return indexedDB;
  if (typeof globalThis !== 'undefined' && 'indexedDB' in globalThis) {
    return (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB;
  }
  if (typeof window !== 'undefined' && 'indexedDB' in window) return window.indexedDB;
  return null;
}

function withCoverage<T>(records: T[]): { records: T[]; coverage: BackupCoverage } {
  return {
    records,
    coverage: {
      status: records.length === 0 ? 'absent' : 'included',
      schemaVersion: 1,
      recordCount: records.length,
    },
  };
}

/** Inspect counts in a single committed readonly snapshot without loading binaries. */
function countStoreRows(
  idb: IDBFactory,
  databaseName: string,
  stores: string[],
  readStore: string,
  countStore?: string,
  expectedVersion = 1,
): Promise<{ primaryCount: number; extraCount: number }> {
  return new Promise((resolve, reject) => {
    let db: IDBDatabase | null = null;
    let settled = false;
    let missingOnOpen = false;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      db?.close();
      reject(new Error(message));
    };
    const finish = (primaryCount = 0, extraCount = 0) => {
      if (settled) return;
      settled = true;
      db?.close();
      resolve({ primaryCount, extraCount });
    };

    let req: IDBOpenDBRequest;
    try {
      req = idb.open(databaseName);
    } catch {
      fail('Falha ao abrir banco IndexedDB existente.');
      return;
    }

    req.onupgradeneeded = () => {
      // open() without an explicit version would create a missing database.
      try {
        if (!req.transaction) throw new Error('Upgrade sem transacao.');
        req.transaction.abort();
        missingOnOpen = true;
      } catch {
        fail('Nao foi possivel cancelar abertura de banco ausente.');
      }
    };
    req.onerror = () => {
      if (missingOnOpen) finish();
      else fail('Falha ao abrir banco IndexedDB existente.');
    };
    req.onblocked = () => fail('Abertura de IndexedDB bloqueada.');
    req.onsuccess = () => {
      db = req.result;
      if (settled) {
        db.close();
        return;
      }
      if (db.version !== expectedVersion) {
        fail('Versao IndexedDB desconhecida; cobertura nao pode ser verificada.');
        return;
      }
      if (stores.some((store) => !db?.objectStoreNames.contains(store))) {
        fail('Store obrigatorio ausente em IndexedDB existente.');
        return;
      }
      try {
        const tx = db.transaction(stores, 'readonly');
        let primaryCount: number | null = null;
        let extraCount: number | null = countStore ? null : 0;
        tx.onerror = () => fail('Erro na transacao readonly IndexedDB.');
        tx.onabort = () => fail('Transacao readonly IndexedDB abortada.');
        tx.oncomplete = () => {
          if (primaryCount === null || extraCount === null) fail('Leitura incompleta no IndexedDB.');
          else finish(primaryCount, extraCount);
        };
        const primaryReq = tx.objectStore(readStore).count();
        primaryReq.onsuccess = () => {
          if (!Number.isSafeInteger(primaryReq.result) || primaryReq.result < 0)
            return fail('Contagem IndexedDB invalida.');
          primaryCount = primaryReq.result;
        };
        primaryReq.onerror = () => fail('Falha ao contar registros IndexedDB.');
        if (countStore) {
          // Count related stores in the same snapshot without loading large binary assets.
          const countReq = tx.objectStore(countStore).count();
          countReq.onsuccess = () => {
            if (!Number.isSafeInteger(countReq.result) || countReq.result < 0)
              return fail('Contagem IndexedDB invalida.');
            extraCount = countReq.result;
          };
          countReq.onerror = () => fail('Falha ao contar registros IndexedDB.');
        }
      } catch {
        fail('Transacao readonly IndexedDB indisponivel.');
      }
    };
  });
}

function requireIDB(factory?: IDBFactory): IDBFactory {
  const idb = resolveIDBFactory(factory);
  if (!idb) throw new Error('IndexedDB indisponivel: backup multibanco nao pode ser validado.');
  return idb;
}

export async function readLocalEngineSnapshot(
  factory?: IDBFactory,
): Promise<{ records: LocalEngineRecord[]; coverage: BackupCoverage }> {
  const { primaryCount } = await countStoreRows(requireIDB(factory), 'GeoNexoLocalEngineDB', ['store'], 'store');
  const records: LocalEngineRecord[] = [];
  return primaryCount ? { records, coverage: {
    status: 'pending', schemaVersion: 1, recordCount: null,
    reason: 'Dados e binarios do motor local ainda nao sao incluidos no backup.',
  } } : withCoverage(records);
}

export async function readMeshesSnapshot(
  factory?: IDBFactory,
): Promise<{ records: MeshRecord[]; coverage: BackupCoverage }> {
  const { primaryCount } = await countStoreRows(requireIDB(factory), 'geonexo-mesh-store', ['meshes'], 'meshes');
  const records: MeshRecord[] = [];
  return primaryCount ? { records, coverage: {
    status: 'pending', schemaVersion: 1, recordCount: null,
    reason: 'Malhas e seus metadados ainda nao sao incluidos no backup.',
  } } : withCoverage(records);
}

export async function readLargeBlobsSnapshot(
  factory?: IDBFactory,
): Promise<{ records: LargeBlobRecord[]; coverage: BackupCoverage }> {
  const { primaryCount, extraCount } = await countStoreRows(requireIDB(factory), 'large-blob-store', ['blobs', 'metadata'], 'blobs', 'metadata');
  const records: LargeBlobRecord[] = [];
  return primaryCount || extraCount ? { records, coverage: {
    status: 'pending', schemaVersion: 1, recordCount: null,
    reason: 'Blobs e seus metadados ainda nao sao incluidos no backup.',
  } } : withCoverage(records);
}

export async function readOfflineMapsSnapshot(
  factory?: IDBFactory,
): Promise<{ records: OfflineMapRecord[]; coverage: BackupCoverage }> {
  const { primaryCount, extraCount } = await countStoreRows(
    requireIDB(factory), OFFLINE_PACKAGE_DB, ['packages', 'assets'], 'packages', 'assets', OFFLINE_PACKAGE_VERSION,
  );
  const records: OfflineMapRecord[] = [];
  return primaryCount || extraCount ? { records, coverage: {
    status: 'pending', schemaVersion: 1, recordCount: null,
    reason: 'Os mapas offline ainda nao sao incluidos no backup.',
  } } : withCoverage(records);
}
