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
    for (let i = 0; i < part.length; i++) characters += String.fromCharCode(part[i]);
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

export async function readLocalEngineSnapshot(
  factory?: IDBFactory,
): Promise<{ records: LocalEngineRecord[]; coverage: BackupCoverage }> {
  const idb = resolveIDBFactory(factory);
  if (!idb) {
    return { records: [], coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 } };
  }
  try {
    return await new Promise((resolve) => {
      const req = idb.open('GeoNexoLocalEngineDB');
      req.onupgradeneeded = () => {
        try {
          req.transaction?.abort();
        } catch {}
      };
      req.onerror = () =>
        resolve({
          records: [],
          coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
        });
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('store')) {
          db.close();
          return resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
        try {
          const tx = db.transaction('store', 'readonly');
          const store = tx.objectStore('store');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = () => {
            const rows = (getAllReq.result || []) as LocalEngineRecord[];
            db.close();
            if (rows.length === 0) {
              resolve({
                records: [],
                coverage: {
                  status: 'absent',
                  schemaVersion: 1,
                  recordCount: 0,
                },
              });
            } else {
              resolve({
                records: rows,
                coverage: {
                  status: 'included',
                  schemaVersion: 1,
                  recordCount: rows.length,
                },
              });
            }
          };
          getAllReq.onerror = () => {
            db.close();
            resolve({
              records: [],
              coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
            });
          };
        } catch {
          db.close();
          resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
      };
    });
  } catch {
    return {
      records: [],
      coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
    };
  }
}

export async function readMeshesSnapshot(
  factory?: IDBFactory,
): Promise<{ records: MeshRecord[]; coverage: BackupCoverage }> {
  const idb = resolveIDBFactory(factory);
  if (!idb) {
    return { records: [], coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 } };
  }
  try {
    return await new Promise((resolve) => {
      const req = idb.open('geonexo-mesh-store');
      req.onupgradeneeded = () => {
        try {
          req.transaction?.abort();
        } catch {}
      };
      req.onerror = () =>
        resolve({
          records: [],
          coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
        });
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meshes')) {
          db.close();
          return resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
        try {
          const tx = db.transaction('meshes', 'readonly');
          const store = tx.objectStore('meshes');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = async () => {
            const rawRows = (getAllReq.result || []) as Array<
              Record<string, unknown>
            >;
            db.close();
            if (rawRows.length === 0) {
              return resolve({
                records: [],
                coverage: {
                  status: 'absent',
                  schemaVersion: 1,
                  recordCount: 0,
                },
              });
            }
            try {
              const records: MeshRecord[] = [];
              for (const row of rawRows) {
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
              resolve({
                records,
                coverage: {
                  status: 'included',
                  schemaVersion: 1,
                  recordCount: records.length,
                },
              });
            } catch {
              resolve({
                records: [],
                coverage: {
                  status: 'absent',
                  schemaVersion: 1,
                  recordCount: 0,
                },
              });
            }
          };
          getAllReq.onerror = () => {
            db.close();
            resolve({
              records: [],
              coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
            });
          };
        } catch {
          db.close();
          resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
      };
    });
  } catch {
    return {
      records: [],
      coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
    };
  }
}

export async function readLargeBlobsSnapshot(
  factory?: IDBFactory,
): Promise<{ records: LargeBlobRecord[]; coverage: BackupCoverage }> {
  const idb = resolveIDBFactory(factory);
  if (!idb) {
    return { records: [], coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 } };
  }
  try {
    return await new Promise((resolve) => {
      const req = idb.open('large-blob-store');
      req.onupgradeneeded = () => {
        try {
          req.transaction?.abort();
        } catch {}
      };
      req.onerror = () =>
        resolve({
          records: [],
          coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
        });
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('blobs')) {
          db.close();
          return resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
        try {
          const tx = db.transaction('blobs', 'readonly');
          const store = tx.objectStore('blobs');
          const getAllReq = store.getAll();
          getAllReq.onsuccess = async () => {
            const rawRows = (getAllReq.result || []) as Array<
              Record<string, unknown>
            >;
            db.close();
            if (rawRows.length === 0) {
              return resolve({
                records: [],
                coverage: {
                  status: 'absent',
                  schemaVersion: 1,
                  recordCount: 0,
                },
              });
            }
            try {
              const records: LargeBlobRecord[] = [];
              for (const row of rawRows) {
                const bytes = await extractBytes(
                  row.data || row.blob || row.buffer,
                );
                records.push({
                  key: String(row.key || ''),
                  bytesBase64: toBase64(bytes),
                  size: bytes.byteLength,
                  lastModified: String(
                    row.lastModified || new Date().toISOString(),
                  ),
                  etag: row.etag ? String(row.etag) : undefined,
                  checksum: row.checksum ? String(row.checksum) : undefined,
                });
              }
              resolve({
                records,
                coverage: {
                  status: 'included',
                  schemaVersion: 1,
                  recordCount: records.length,
                },
              });
            } catch {
              resolve({
                records: [],
                coverage: {
                  status: 'absent',
                  schemaVersion: 1,
                  recordCount: 0,
                },
              });
            }
          };
          getAllReq.onerror = () => {
            db.close();
            resolve({
              records: [],
              coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
            });
          };
        } catch {
          db.close();
          resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
      };
    });
  } catch {
    return {
      records: [],
      coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
    };
  }
}

export async function readOfflineMapsSnapshot(
  factory?: IDBFactory,
): Promise<{ records: OfflineMapRecord[]; coverage: BackupCoverage }> {
  const idb = resolveIDBFactory(factory);
  if (!idb) {
    return { records: [], coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 } };
  }
  try {
    return await new Promise((resolve) => {
      const req = idb.open('markmap-offline-packages');
      req.onupgradeneeded = () => {
        try {
          req.transaction?.abort();
        } catch {}
      };
      req.onerror = () =>
        resolve({
          records: [],
          coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
        });
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('packages')) {
          db.close();
          return resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
        try {
          const tx = db.transaction(['packages', 'assets'], 'readonly');
          const packagesStore = tx.objectStore('packages');
          const getAllReq = packagesStore.getAll();
          getAllReq.onsuccess = () => {
            const rawRows = (getAllReq.result || []) as Array<
              Record<string, unknown>
            >;
            db.close();
            if (rawRows.length === 0) {
              return resolve({
                records: [],
                coverage: {
                  status: 'absent',
                  schemaVersion: 1,
                  recordCount: 0,
                },
              });
            }
            const records: OfflineMapRecord[] = rawRows.map((r) => ({
              packageId: String(r.packageId || r.key || ''),
              state: String(r.state || 'active'),
              bytes: typeof r.bytes === 'number' ? r.bytes : 0,
              generation: String(r.generation || ''),
              assetsCount: Array.isArray(r.assets) ? r.assets.length : 0,
            }));
            resolve({
              records,
              coverage: {
                status: 'included',
                schemaVersion: 1,
                recordCount: records.length,
              },
            });
          };
          getAllReq.onerror = () => {
            db.close();
            resolve({
              records: [],
              coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
            });
          };
        } catch {
          db.close();
          resolve({
            records: [],
            coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
          });
        }
      };
    });
  } catch {
    return {
      records: [],
      coverage: { status: 'absent', schemaVersion: 1, recordCount: 0 },
    };
  }
}

