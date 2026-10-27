import type { BackupCoverage } from './manifest';
import { readBlobBytes } from '../blob-bytes';

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
  assetsCount: number;
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

function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 12_288) {
    const part = bytes.subarray(offset, offset + 12_288);
    let characters = '';
    for (let i = 0; i < part.length; i++) characters += String.fromCharCode(bytes[i + offset]);
    result += btoa(characters);
  }
  return result;
}

async function extractBytes(binary: unknown): Promise<Uint8Array> {
  if (binary instanceof ArrayBuffer) return new Uint8Array(binary);
  if (ArrayBuffer.isView(binary))
    return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
  if (binary instanceof Blob)
    return new Uint8Array(await readBlobBytes(binary));
  throw new Error('Dado binario nao reconhecido.');
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

/** Wait for the readonly transaction to complete, not just getAll.onsuccess. */
function readStoreRows(
  idb: IDBFactory,
  databaseName: string,
  stores: string[],
  readStore: string,
): Promise<unknown[]> {
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
    const finish = (rows: unknown[]) => {
      if (settled) return;
      settled = true;
      db?.close();
      resolve(rows);
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
      if (missingOnOpen) finish([]);
      else fail('Falha ao abrir banco IndexedDB existente.');
    };
    req.onblocked = () => fail('Abertura de IndexedDB bloqueada.');
    req.onsuccess = () => {
      db = req.result;
      if (settled) {
        db.close();
        return;
      }
      if (stores.some((store) => !db?.objectStoreNames.contains(store))) {
        fail('Store obrigatorio ausente em IndexedDB existente.');
        return;
      }
      try {
        const tx = db.transaction(stores, 'readonly');
        let rows: unknown[] | null = null;
        tx.onerror = () => fail('Erro na transacao readonly IndexedDB.');
        tx.onabort = () => fail('Transacao readonly IndexedDB abortada.');
        tx.oncomplete = () => {
          if (rows === null) fail('Leitura incompleta no IndexedDB.');
          else finish(rows);
        };
        const getAllReq = tx.objectStore(readStore).getAll();
        getAllReq.onsuccess = () => {
          if (!Array.isArray(getAllReq.result)) {
            fail('Resposta de leitura IndexedDB invalida.');
            return;
          }
          rows = getAllReq.result;
        };
        getAllReq.onerror = () => fail('Falha de leitura no IndexedDB.');
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
  const rows = await readStoreRows(requireIDB(factory), 'GeoNexoLocalEngineDB', ['store'], 'store');
  return withCoverage(rows as LocalEngineRecord[]);
}

export async function readMeshesSnapshot(
  factory?: IDBFactory,
): Promise<{ records: MeshRecord[]; coverage: BackupCoverage }> {
  const rows = await readStoreRows(requireIDB(factory), 'geonexo-mesh-store', ['meshes'], 'meshes');
  try {
    const records: MeshRecord[] = [];
    for (const row of rows as Array<Record<string, unknown>>) {
      const bytes = await extractBytes(row.glb);
      records.push({
        meshId: String(row.meshId || row.id || ''),
        name: String(row.name || ''),
        glbBase64: toBase64(bytes),
        size: bytes.byteLength,
        createdAt: String(row.createdAt || new Date().toISOString()),
        view: row.view,
      });
    }
    return withCoverage(records);
  } catch {
    throw new Error('Binario local ilegivel; backup multibanco interrompido.');
  }
}

export async function readLargeBlobsSnapshot(
  factory?: IDBFactory,
): Promise<{ records: LargeBlobRecord[]; coverage: BackupCoverage }> {
  const rows = await readStoreRows(requireIDB(factory), 'large-blob-store', ['blobs'], 'blobs');
  try {
    const records: LargeBlobRecord[] = [];
    for (const row of rows as Array<Record<string, unknown>>) {
      const bytes = await extractBytes(row.data || row.blob || row.buffer);
      records.push({
        key: String(row.key || ''),
        bytesBase64: toBase64(bytes),
        size: bytes.byteLength,
        lastModified: String(row.lastModified || new Date().toISOString()),
        etag: row.etag ? String(row.etag) : undefined,
        checksum: row.checksum ? String(row.checksum) : undefined,
      });
    }
    return withCoverage(records);
  } catch {
    throw new Error('Binario local ilegivel; backup multibanco interrompido.');
  }
}

export async function readOfflineMapsSnapshot(
  factory?: IDBFactory,
): Promise<{ records: OfflineMapRecord[]; coverage: BackupCoverage }> {
  const rows = await readStoreRows(
    requireIDB(factory), 'markmap-offline-packages', ['packages', 'assets'], 'packages',
  );
  try {
    const records: OfflineMapRecord[] = (rows as Array<Record<string, unknown>>).map((r) => ({
      packageId: String(r.packageId || r.key || ''),
      state: String(r.state || 'active'),
      bytes: typeof r.bytes === 'number' ? r.bytes : 0,
      generation: String(r.generation || ''),
      assetsCount: Array.isArray(r.assets) ? r.assets.length : 0,
    }));
    return withCoverage(records);
  } catch {
    throw new Error('Metadados de mapas offline invalidos.');
  }
}
