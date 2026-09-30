import { LOCAL_DB_NAME, LOCAL_DB_VERSION, type LocalDb, type LocalDbStores, type LocalDbTransaction } from "./types";

const STORES: LocalDbStores[] = ["meta", "entities", "originals", "outbox", "conflicts", "acks"];

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB não está disponível neste navegador."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: name === "meta" ? "key" : "key" });
        if (name === "entities") {
          store.createIndex("workspace", "workspaceId", { unique: false });
          store.createIndex("entity", ["workspaceId", "entity", "entityId"], { unique: true });
        } else if (name === "outbox") {
          store.createIndex("workspace", "workspaceId", { unique: false });
          store.createIndex("entity", ["workspaceId", "entity", "entityId"], { unique: false });
        } else if (name === "originals" || name === "conflicts" || name === "acks") {
          store.createIndex("workspace", "workspaceId", { unique: false });
        }
        if (name === "outbox") store.createIndex("workspaceSequence", ["workspaceId", "localSequence"], { unique: true });
      }
      if (db.objectStoreNames.contains("acks")) {
        const acks = request.transaction!.objectStore("acks");
        if (!acks.indexNames.contains("workspace")) acks.createIndex("workspace", "workspaceId", { unique: false });
      }
      if (db.objectStoreNames.contains("outbox")) {
        const outbox = request.transaction!.objectStore("outbox");
        if (!outbox.indexNames.contains("workspaceSequence")) outbox.createIndex("workspaceSequence", ["workspaceId", "localSequence"], { unique: true });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o banco local."));
    request.onblocked = () => reject(new Error("O banco local está bloqueado por outra versão aberta."));
  });
}

class IndexedLocalDb implements LocalDb {
  private dbPromise?: Promise<IDBDatabase>;
  private workspacePromise?: Promise<string>;

  private database(): Promise<IDBDatabase> {
    this.dbPromise ??= openDatabase();
    return this.dbPromise;
  }

  async workspaceId(): Promise<string> {
    if (!this.workspacePromise) {
      this.workspacePromise = this.transact(["meta"], "readwrite", async (tx) => {
        const store = tx.store("meta");
        const current = await requestValue<{ key: string; value: string }>(store.get("workspaceId"));
        if (current?.value) return current.value;
        const value = crypto.randomUUID();
        store.put({ key: "workspaceId", value });
        return value;
      });
    }
    return this.workspacePromise;
  }

  async transact<T>(stores: LocalDbStores[], mode: IDBTransactionMode, work: (tx: LocalDbTransaction) => Promise<T> | T): Promise<T> {
    const db = await this.database();
    return new Promise<T>((resolve, reject) => {
      let result!: T;
      let callbackDone = false;
      let settled = false;
      const transaction = db.transaction(stores, mode);
      const tx: LocalDbTransaction = { store: (name) => transaction.objectStore(name) };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        try { transaction.abort(); } catch { /* already completed */ }
        reject(error instanceof Error ? error : new Error("Transação local falhou."));
      };
      Promise.resolve().then(() => work(tx)).then((value) => { result = value; callbackDone = true; }, fail);
      transaction.oncomplete = () => {
        if (!callbackDone) return fail(new Error("Transação local terminou antes da operação."));
        if (!settled) { settled = true; resolve(result); }
      };
      transaction.onerror = () => fail(transaction.error ?? new Error("Transação local falhou."));
      transaction.onabort = () => fail(transaction.error ?? new Error("Transação local abortada."));
    });
  }

  close(): void { if (this.dbPromise) void this.dbPromise.then((db) => db.close()); this.workspacePromise = undefined; this.dbPromise = undefined; }
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

export const localDb: LocalDb = new IndexedLocalDb();
export { IndexedLocalDb, requestValue };
export * from "./types";
