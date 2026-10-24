import { LOCAL_DB_NAME, LOCAL_DB_VERSION, type LocalDb, type LocalDbStores, type LocalDbTransaction } from "./types";

const STORES: LocalDbStores[] = ["meta", "entities", "originals", "outbox", "conflicts", "acks"];

function openDatabase(onVersionChange: () => void): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB não está disponível neste navegador."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    // A blocked request can later succeed. Do not keep an orphan connection open.
    let settled = false;
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
      if (settled) { db.close(); return; }
      settled = true;
      db.onversionchange = () => { db.close(); onVersionChange(); };
      resolve(db);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error("Não foi possível abrir o banco local."));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error("O banco local está bloqueado por outra versão aberta."));
    };
  });
}


/** Read workspace keys without loading large PDF/blob records. */
function storedWorkspaceIds(store: IDBObjectStore): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const ids: string[] = [];
    let request: IDBRequest<IDBCursor | null>;
    try {
      request = store.index("workspace").openKeyCursor(null, "nextunique");
    } catch (cause) {
      reject(cause);
      return;
    }
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(ids); return; }
      if (typeof cursor.key !== "string" || !cursor.key) {
        reject(new Error("Identidade inválida nos dados locais; nenhum workspace novo foi criado."));
        return;
      }
      ids.push(cursor.key);
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error("Não foi possível verificar os dados locais."));
  });
}

class IndexedLocalDb implements LocalDb {
  private dbPromise?: Promise<IDBDatabase>;
  private workspacePromise?: Promise<string>;

  private database(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      const opening = openDatabase(() => {
        if (this.dbPromise === opening) {
          this.dbPromise = undefined;
          this.workspacePromise = undefined;
        }
      });
      this.dbPromise = opening;
      // An opening failure must not poison future offline reads or edits.
      void opening.catch(() => {
        if (this.dbPromise === opening) this.dbPromise = undefined;
      });
    }
    return this.dbPromise;
  }

  async workspaceId(): Promise<string> {
    if (!this.workspacePromise) {
      const pending = this.transact(STORES, "readwrite", async (tx) => {
        const meta = tx.store("meta");
        const current = await requestValue<{ key: string; value: string } | undefined>(meta.get("workspaceId"));
        if (current?.value) return current.value;

        // Never invent a new workspace when durable records already refer to
        // an older identity: that would make saved projects and PDFs disappear.
        const existing = await Promise.all(
          (["entities", "originals", "outbox", "conflicts", "acks"] as const)
            .map((name) => storedWorkspaceIds(tx.store(name))),
        );
        const ids = [...new Set(existing.flat())];
        if (ids.length > 1)
          throw new Error("Dados de vários workspaces detectados. Recuperação automática bloqueada para evitar ocultar registros.");
        const value = ids[0] ?? crypto.randomUUID();
        meta.put({ key: "workspaceId", value });
        return value;
      });
      this.workspacePromise = pending;
      // A failed transaction must be retryable after a resume/version change.
      void pending.catch(() => {
        if (this.workspacePromise === pending) this.workspacePromise = undefined;
      });
    }
    return this.workspacePromise;
  }

  async transact<T>(stores: LocalDbStores[], mode: IDBTransactionMode, work: (tx: LocalDbTransaction) => Promise<T> | T): Promise<T> {
    const opening = this.database();
    const db = await opening;
    return new Promise<T>((resolve, reject) => {
      let result!: T;
      let callbackDone = false;
      let settled = false;
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(stores, mode);
      } catch (error) {
        // Some WebViews close IDB connections on suspend without firing
        // versionchange. Report the failed operation, then reopen on retry.
        if (
          error && typeof error === "object" && "name" in error &&
          error.name === "InvalidStateError" && this.dbPromise === opening
        ) {
          this.dbPromise = undefined;
          this.workspacePromise = undefined;
          try { db.close(); } catch { /* already closed */ }
        }
        // Do not automatically replay readwrite callbacks: they might have
        // side effects and their commit status is not necessarily known.
        reject(error);
        return;
      }
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

  close(): void {
    const opening = this.dbPromise;
    this.workspacePromise = undefined;
    this.dbPromise = undefined;
    // Handle a failed or still-opening connection without unhandled rejections.
    if (opening) void opening.then((db) => db.close(), () => undefined);
  }
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

export const localDb: LocalDb = new IndexedLocalDb();
export { IndexedLocalDb, requestValue };
export * from "./types";
