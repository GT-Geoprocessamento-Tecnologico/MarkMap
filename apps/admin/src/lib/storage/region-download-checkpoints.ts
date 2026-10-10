import type { ChunkStore } from './verified-range-download.mjs';

interface ChunkRow { key: string; sha: string; offset: number; data: ArrayBuffer; }
interface SessionRow {
  packageId: string;
  manifestSha: string;
  hashes: string[];
  totalBytes: number;
  updatedAt: string;
}
const DATABASE_NAME = 'MarkMapRegionalDownloads';
const STORE_CHUNKS = 'chunks';
const STORE_SESSIONS = 'sessions';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB read failed'));
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** Kept separate from GeoNexoOfflineMapPackages: staged chunks never become active maps. */
export class RegionDownloadCheckpoints implements ChunkStore {
  private opening: Promise<IDBDatabase> | null = null;
  private open(): Promise<IDBDatabase> {
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const chunks = db.createObjectStore(STORE_CHUNKS, { keyPath: 'key' });
          chunks.createIndex('sha', 'sha', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) db.createObjectStore(STORE_SESSIONS, { keyPath: 'packageId' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); this.opening = null; };
        resolve(request.result);
      };
      request.onerror = () => { this.opening = null; reject(request.error ?? new Error('IndexedDB open failed')); };
    });
    return this.opening;
  }
  async get(sha: string, offset: number): Promise<Uint8Array | null> {
    const db = await this.open();
    const row = await request<ChunkRow | undefined>(db.transaction(STORE_CHUNKS, 'readonly')
      .objectStore(STORE_CHUNKS).get(`${sha}:${offset}`));
    return row ? new Uint8Array(row.data) : null;
  }
  async put(sha: string, offset: number, bytes: Uint8Array): Promise<void> {
    const db = await this.open();
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    tx.objectStore(STORE_CHUNKS).put({ key: `${sha}:${offset}`, sha, offset, data } satisfies ChunkRow);
    await done(tx);
  }
  async deleteAsset(sha: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    const keys = await request<IDBValidKey[]>(tx.objectStore(STORE_CHUNKS).index('sha').getAllKeys(sha));
    for (const key of keys) tx.objectStore(STORE_CHUNKS).delete(key);
    await done(tx);
  }
  async setSession(session: Omit<SessionRow, 'updatedAt'>): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).put({ ...session, updatedAt: new Date().toISOString() } satisfies SessionRow);
    await done(tx);
  }
  async getSession(packageId: string): Promise<SessionRow | null> {
    const db = await this.open();
    return (await request<SessionRow | undefined>(db.transaction(STORE_SESSIONS, 'readonly')
      .objectStore(STORE_SESSIONS).get(packageId))) ?? null;
  }
  async clearSession(packageId: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).delete(packageId);
    await done(tx);
  }
  async getDownloadedBytes(hashes: string[]): Promise<number> {
    const db = await this.open();
    let bytes = 0;
    // Cursor: count persisted chunks without loading an entire 250 MiB
    // checkpoint set into JS memory via index.getAll(sha).
    for (const sha of new Set(hashes)) {
      bytes += await new Promise<number>((resolve, reject) => {
        const cursor = db.transaction(STORE_CHUNKS, 'readonly')
          .objectStore(STORE_CHUNKS).index('sha').openCursor(IDBKeyRange.only(sha));
        let partBytes = 0;
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) { resolve(partBytes); return; }
          partBytes += (row.value as ChunkRow).data.byteLength;
          row.continue();
        };
        cursor.onerror = () => reject(cursor.error ?? new Error('IndexedDB checkpoint scan failed'));
      });
    }
    return bytes;
  }
}
