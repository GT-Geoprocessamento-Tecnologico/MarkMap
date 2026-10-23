import type { ChunkStore } from "./verified-range-download.mjs";
import {
  isValidCheckpoint,
  REGION_DOWNLOAD_CHUNK_SIZE,
  unreferencedSessionHashes,
} from "./checkpoint-rules.mjs";
import { copyBytes, settleTransaction } from "./idb-binary-compat.mjs";

/** v1 records may be ArrayBuffers; readers normalize them to Blobs when needed. */
interface ChunkRow {
  key: string;
  sha: string;
  offset: number;
  data: ArrayBuffer | Blob;
}
export interface ExpectedRegionAsset {
  sha256: string;
  size: number;
}
interface SessionRow {
  packageId: string;
  manifestSha: string;
  hashes: string[];
  totalBytes: number;
  /** New sessions include sizes; v1 sessions remain readable without migration. */
  assets?: ExpectedRegionAsset[];
  updatedAt: string;
}
const DATABASE_NAME = "MarkMapRegionalDownloads";
const STORE_CHUNKS = "chunks";
const STORE_SESSIONS = "sessions";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB read failed"));
  });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}
export function deleteKeyCursorEntry(
  store: Pick<IDBObjectStore, "delete">,
  cursor: Pick<IDBCursor, "primaryKey">,
): IDBRequest {
  return store.delete(cursor.primaryKey);
}
const txError = new WeakMap<IDBTransaction, DOMException | null>();
function chunkLength(data: ChunkRow["data"]): number {
  if (data instanceof Blob) return data.size;
  if (data instanceof ArrayBuffer) return data.byteLength;
  return -1;
}

/** Kept separate from GeoNexoOfflineMapPackages: staged chunks never become active maps. */
export class RegionDownloadCheckpoints implements ChunkStore {
  private opening: Promise<IDBDatabase> | null = null;
  private open(): Promise<IDBDatabase> {
    if (this.opening) return this.opening;
    this.opening = new Promise((resolve, reject) => {
      const opened = indexedDB.open(DATABASE_NAME, 1);
      opened.onupgradeneeded = () => {
        const db = opened.result;
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const chunks = db.createObjectStore(STORE_CHUNKS, { keyPath: "key" });
          chunks.createIndex("sha", "sha", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS))
          db.createObjectStore(STORE_SESSIONS, { keyPath: "packageId" });
      };
      opened.onsuccess = () => {
        opened.result.onversionchange = () => {
          opened.result.close();
          this.opening = null;
        };
        resolve(opened.result);
      };
      opened.onerror = () => {
        this.opening = null;
        reject(opened.error ?? new Error("IndexedDB open failed"));
      };
    });
    return this.opening;
  }

  /** Read legacy checkpoint bytes for old callers. Never reads the entire region. */
  async get(sha: string, offset: number): Promise<Uint8Array | null> {
    const blob = await this.getBlob(sha, offset);
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  }

  /** Blob-backed reads avoid accumulating per-chunk Uint8Arrays in the caller. */
  async getBlob(sha: string, offset: number): Promise<Blob | null> {
    const db = await this.open();
    const row = await request<ChunkRow | undefined>(
      db
        .transaction(STORE_CHUNKS, "readonly")
        .objectStore(STORE_CHUNKS)
        .get(`${sha}:${offset}`),
    );
    if (!row) return null;
    if (row.data instanceof Blob) return row.data;
    if (row.data instanceof ArrayBuffer) return new Blob([row.data]);
    return null;
  }

  async put(sha: string, offset: number, bytes: Uint8Array): Promise<void> {
    const db = await this.open();
    // Bounded 1 MiB ArrayBuffer copy; readers remain Blob-compatible.
    if (bytes.byteLength > REGION_DOWNLOAD_CHUNK_SIZE)
      throw new Error("Checkpoint chunk exceeds the 1 MiB limit");
    const binary = copyBytes(bytes);
    const put = async (data: ChunkRow["data"]) => {
      const tx = db.transaction(STORE_CHUNKS, "readwrite");
      const request = tx
        .objectStore(STORE_CHUNKS)
        .put({ key: `${sha}:${offset}`, sha, offset, data } satisfies ChunkRow);
      request.onerror = () => {
        if (!txError.has(tx)) txError.set(tx, request.error);
        try {
          tx.abort();
        } catch {
          /* already aborting */
        }
      };
      await settleTransaction(tx, () => txError.get(tx) ?? null);
    };
    // Checkpoints are always bounded ArrayBuffers; readers normalize legacy
    // records to Blob only after a successful durable write.
    await put(binary);
  }

  async deleteAsset(sha: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_CHUNKS, "readwrite");
    const keys = await request<IDBValidKey[]>(
      tx.objectStore(STORE_CHUNKS).index("sha").getAllKeys(sha),
    );
    for (const key of keys) tx.objectStore(STORE_CHUNKS).delete(key);
    await done(tx);
  }

  async setSession(session: Omit<SessionRow, "updatedAt">): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_SESSIONS, "readwrite");
    tx.objectStore(STORE_SESSIONS).put({
      ...session,
      updatedAt: new Date().toISOString(),
    } satisfies SessionRow);
    await done(tx);
  }
  async getSession(packageId: string): Promise<SessionRow | null> {
    const db = await this.open();
    return (
      (await request<SessionRow | undefined>(
        db
          .transaction(STORE_SESSIONS, "readonly")
          .objectStore(STORE_SESSIONS)
          .get(packageId),
      )) ?? null
    );
  }
  async clearSession(packageId: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(STORE_SESSIONS, "readwrite");
    tx.objectStore(STORE_SESSIONS).delete(packageId);
    await done(tx);
  }

  /**
   * Atomically close one installation session and reclaim only unshared chunks.
   * A second region referencing the same content hash retains its checkpoints.
   * Never touches the active regional package database or user outbox.
   */
  async finishSession(packageId: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([STORE_CHUNKS, STORE_SESSIONS], "readwrite");
    const finished = done(tx); // Attach before the transaction has a chance to finish.
    try {
      const sessions = tx.objectStore(STORE_SESSIONS);
      const rows = await request<SessionRow[]>(sessions.getAll());
      const staleHashes = unreferencedSessionHashes(packageId, rows);
      sessions.delete(packageId);
      const chunkStore = tx.objectStore(STORE_CHUNKS);
      const index = chunkStore.index("sha");
      // Queue all cursors while the transaction is active. Sequentially awaiting
      // between cursors can let WebKit auto-commit before the next request.
      const removals = staleHashes.map(
        (sha) =>
          new Promise<void>((resolve, reject) => {
            const cursor = index.openKeyCursor(IDBKeyRange.only(sha));
            cursor.onsuccess = () => {
              const row = cursor.result;
              if (!row) {
                resolve();
                return;
              }
              try {
                // A key cursor has no delete() method in WebKit. Delete by the
                // primary key while keeping the cursor value out of memory.
                const deletion = deleteKeyCursorEntry(chunkStore, row);
                deletion.onerror = () =>
                  reject(
                    deletion.error ??
                      new Error("IndexedDB checkpoint cleanup failed"),
                  );
                row.continue();
              } catch (error) {
                reject(error);
              }
            };
            cursor.onerror = () =>
              reject(
                cursor.error ??
                  new Error("IndexedDB checkpoint cleanup failed"),
              );
          }),
      );
      await Promise.all(removals);
      await finished;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* transaction already finished */
      }
      await finished.catch(() => undefined);
      throw error;
    }
  }

  /**
   * Count only aligned, complete checkpoints from the immutable manifest.
   * Old ArrayBuffer rows and new Blob rows are both compatible with DB v1.
   */
  async getDownloadedBytes(assets: ExpectedRegionAsset[]): Promise<number> {
    const db = await this.open();
    let bytes = 0;
    const unique = new Map<string, number>();
    for (const asset of assets) {
      if (
        !/^[a-f0-9]{64}$/i.test(asset.sha256) ||
        !Number.isSafeInteger(asset.size) ||
        asset.size <= 0
      )
        throw new Error("Invalid checkpoint asset metadata");
      const sha = asset.sha256.toLowerCase();
      const previous = unique.get(sha);
      if (previous !== undefined && previous !== asset.size)
        throw new Error("Conflicting sizes for checkpoint hash");
      unique.set(sha, asset.size);
    }
    for (const [sha, size] of unique) {
      bytes += await new Promise<number>((resolve, reject) => {
        const cursor = db
          .transaction(STORE_CHUNKS, "readonly")
          .objectStore(STORE_CHUNKS)
          .index("sha")
          .openCursor(IDBKeyRange.only(sha));
        let counted = 0;
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) {
            resolve(counted);
            return;
          }
          const checkpoint = row.value as ChunkRow;
          const length = chunkLength(checkpoint.data);
          if (
            isValidCheckpoint(
              checkpoint.offset,
              length,
              size,
              REGION_DOWNLOAD_CHUNK_SIZE,
            )
          )
            counted += length;
          row.continue();
        };
        cursor.onerror = () =>
          reject(cursor.error ?? new Error("IndexedDB checkpoint scan failed"));
      });
    }
    return bytes;
  }
}
