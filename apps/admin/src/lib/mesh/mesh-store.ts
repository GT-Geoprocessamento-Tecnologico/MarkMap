import { validateGlbFile } from "./validation";

export interface MeshView {
  camera: "perspective" | "top" | "front";
  wireframe: boolean;
  opacity: number;
}

export interface MeshRecord {
  id: string;
  name: string;
  projectId?: string;
  sizeBytes: number;
  importedAt: string;
  view: MeshView;
}

export interface MeshStore {
  listMeshes(projectId?: string): Promise<MeshRecord[]>;
  saveMesh(input: { file: File; projectId?: string }): Promise<MeshRecord>;
  getMesh(id: string): Promise<{ record: MeshRecord; blob: Blob } | null>;
  removeMesh(id: string): Promise<void>;
  saveMeshView(id: string, view: MeshView): Promise<void>;
}

const DB_NAME = "geonexo-mesh-store";
const DB_VERSION = 1;
const STORE = "meshes";
const defaultView: MeshView = {
  camera: "perspective",
  wireframe: false,
  opacity: 1,
};

interface StoredMesh {
  record: MeshRecord;
  blob?: Blob;
  bytes?: ArrayBuffer;
}

function id(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues)
    globalThis.crypto.getRandomValues(bytes);
  else {
    const seed = `${Date.now()}-${Math.random()}`;
    for (let index = 0; index < bytes.length; index += 1)
      bytes[index] =
        seed.charCodeAt(index % seed.length) ^ Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes]
    .map(
      (value, index) =>
        `${value.toString(16).padStart(2, "0")}${[3, 5, 7, 9].includes(index) ? "-" : ""}`,
    )
    .join("");
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined")
    throw new Error("Armazenamento local não está disponível neste navegador.");
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "record.id" });
        store.createIndex("projectId", "record.projectId", { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(
        request.error ??
          new Error("Não foi possível abrir o armazenamento local."),
      );
  });
}

function transaction<T>(
  mode: IDBTransactionMode,
  work: (
    store: IDBObjectStore,
    finish: (value: T) => void,
    fail: (error: unknown) => void,
  ) => void,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let settled = false;
        let result: T | undefined;
        const finish = (value: T) => {
          if (!settled) result = value;
        };
        tx.oncomplete = () => {
          db.close();
          if (!settled) {
            settled = true;
            resolve(result as T);
          }
        };
        const fail = (error: unknown) => {
          db.close();
          if (!settled) {
            settled = true;
            reject(error);
          }
        };
        tx.onabort = () =>
          fail(tx.error ?? new Error("A operação local foi abortada."));
        tx.onerror = () =>
          fail(tx.error ?? new Error("Falha no armazenamento local."));
        try {
          work(store, finish, fail);
        } catch (error) {
          fail(error);
        }
      }),
  );
}

export const meshStore: MeshStore = {
  listMeshes: (projectId) =>
    transaction("readonly", (store, finish, fail) => {
      const request =
        projectId === undefined
          ? store.getAll()
          : store.index("projectId").getAll(projectId);
      request.onsuccess = () =>
        finish((request.result as StoredMesh[]).map((item) => item.record));
      request.onerror = () => fail(request.error);
    }),
  saveMesh: async ({ file, projectId }) => {
    await validateGlbFile(file);
    const bytes = await file.arrayBuffer();
    const record: MeshRecord = {
      id: id(),
      name: file.name,
      ...(projectId ? { projectId } : {}),
      sizeBytes: file.size,
      importedAt: new Date().toISOString(),
      view: { ...defaultView },
    };
    await transaction<void>("readwrite", (store, finish, fail) => {
      const request = store.put({ record, bytes } satisfies StoredMesh);
      request.onsuccess = () => finish(undefined);
      request.onerror = () =>
        fail(
          request.error ??
            new Error("Não foi possível salvar o GLB localmente."),
        );
    });
    return record;
  },
  getMesh: (meshId) =>
    transaction("readonly", (store, finish, fail) => {
      const request = store.get(meshId);
      request.onsuccess = () => {
        const item = request.result as StoredMesh | undefined;
        if (!item) {
          finish(null);
          return;
        }
        const blob =
          item.blob ??
          (item.bytes
            ? new Blob([item.bytes], { type: "model/gltf-binary" })
            : undefined);
        if (!blob) {
          fail(new Error("O arquivo original da malha não está disponível."));
          return;
        }
        finish({ record: item.record, blob });
      };
      request.onerror = () => fail(request.error);
    }),
  removeMesh: (meshId) =>
    transaction<void>("readwrite", (store, finish, fail) => {
      const request = store.delete(meshId);
      request.onsuccess = () => finish(undefined);
      request.onerror = () => fail(request.error);
    }),
  saveMeshView: (meshId, view) =>
    transaction<void>("readwrite", (store, finish, fail) => {
      if (
        !Number.isFinite(view.opacity) ||
        view.opacity < 0 ||
        view.opacity > 1
      ) {
        fail(new Error("Opacidade inválida."));
        return;
      }
      const request = store.get(meshId);
      request.onsuccess = () => {
        const item = request.result as StoredMesh | undefined;
        if (!item) {
          fail(new Error("Malha não encontrada."));
          return;
        }
        const update = store.put({
          ...item,
          record: { ...item.record, view },
        } satisfies StoredMesh);
        update.onsuccess = () => finish(undefined);
        update.onerror = () => fail(update.error);
      };
      request.onerror = () => fail(request.error);
    }),
};

export const { listMeshes, saveMesh, getMesh, removeMesh, saveMeshView } =
  meshStore;
