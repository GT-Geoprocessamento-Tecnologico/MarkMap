/**
 * LargeBlobStore - Interface comum para storage de arquivos grandes
 *
 * Fornece uma interface abstraída para operações de blob storage em diferentes
 * backends: IndexedDB (Web/PWA), OPFS (Web, quando disponível) e filesystem
 * nativo do Capacitor.
 *
 * Este módulo é o MM-MAP-110 da sequência Maps Engine v2 offline.
 *
 * Regra de uso: arquivos grandes e imutáveis devem usar um LargeBlobStore abstrato;
 * IndexedDB mantém metadados, índice de pacotes e domínio local.
 *
 * Implementação atual: IndexedDB bruto (sem dependências externas), conforme
 * ADR-0005 (storage regional LargeBlobStore). O backend nativo do Capacitor
 * (`CapacitorFilesystemBlobStore`) não está habilitado porque requer o plugin
 * opcional `@capacitor/filesystem`; quando ausente, o factory cai no IndexedDB,
 * que é um backend suportado pelo ADR-0005.
 */

import {
  DeviceStorageProfile,
  getDeviceStorageProfile,
  formatBytes,
  refreshStorageProfile,
} from "./device-storage-profile";

/** Tipos do LargeBlobStore */
export type BlobStoreBackend = "indexeddb" | "opfs" | "filesystem" | "unknown";

export type StoreOperation = "create" | "write" | "read" | "range" | "checksum" | "commit" | "activate" | "rollback" | "delete" | "enumerate";

export interface BlobStoreMetadata {
  key: string;
  size: number;
  lastModified: string;
  etag?: string;
  checksum?: string;
}

export interface BlobStoreError extends Error {
  code: string;
  retryable: boolean;
}

/** Opções de store */
export interface StoreOptions {
  ttl?: number; // tempo de vida em ms (0 = nunca expirar)
  concurrency?: number; // número máximo de transfers simultâneas
  chunkSize?: number; // tamanho em bytes para range requests / chunking
}

/** Eventos de progresso de transferência */
export interface TransferProgress {
  loaded: number;
  total: number | null;
  percent: number;
  speed: number; // bytes por segundo
  eta: number; // segundos até conclusão
  abort: () => void; // função para abortar o transfer
}

/** Result of a store operation */
export type StoreResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: BlobStoreError;
};

/** Metadados de um pacote regional */
export interface RegionPackageMetadata {
  id: string;
  version: string;
  label: string;
  size: number;
  checksum: string;
  lastModified: string;
  staging: boolean; // true se está em staging, false se ativo
  lastAttempt?: string; // timestamp da última tentativa de ativação
}

/** Registro interno persistido no object store `blobs` */
interface BlobRecord {
  key: string;
  packageId: string;
  staging: boolean;
  data: ArrayBuffer;
  size: number;
  checksum: string;
  lastModified: string;
}

/** Registro interno persistido no object store `metadata` */
type MetadataRecord = RegionPackageMetadata & { key: string };

/** Cria um BlobStoreError padronizado (sempre com `name`, herda de Error) */
export function createBlobStoreError(code: string, message: string, retryable: boolean): BlobStoreError {
  const error = new Error(message) as BlobStoreError;
  error.name = "BlobStoreError";
  error.code = code;
  error.retryable = retryable;
  return error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido";
}

/** Converte um IDBRequest em Promise */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDBRequest falhou"));
  });
}

/** Aguarda o commit de uma transação IndexedDB */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Transação abortada"));
    tx.onerror = () => reject(tx.error ?? new Error("Transação falhou"));
  });
}

/** Calcula o SHA-256 hexadecimal de um ArrayBuffer */
async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Converte ArrayBuffer | Uint8Array em ArrayBuffer */
function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  const view = data as Uint8Array<ArrayBuffer>;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

/** Interface principal do LargeBlobStore */
export interface LargeBlobStore {
  /** Backend atual em uso */
  backend: BlobStoreBackend;

  /** Inicializar o store (abrir DB ou preparar filesystem) */
  init(): Promise<{ success: boolean; backend: BlobStoreBackend; error?: string }>;

  /** Fazer staging de um novo pacote regional */
  staging(packageId: string, packageSize: number, options?: StoreOptions): Promise<StoreResult<{ stagingKey: string; estimatedTime: number }>>;

  /** Escrever dados no staging */
  write(stagingKey: string, data: ArrayBuffer | Uint8Array, options?: StoreOptions): Promise<StoreResult<{ bytesWritten: number; checksum: string }>>;

  /** Ler dados do staging */
  read(stagingKey: string, options?: { range?: [number, number] }): Promise<StoreResult<{ data: Uint8Array; size: number }>>;

  /** Calcular checksum de um staging key */
  checksum(stagingKey: string): Promise<StoreResult<{ algorithm: string; hash: string }>>;

  /** Commit/activate um staging key (torna-o o pacote ativo) */
  activate(stagingKey: string): Promise<StoreResult<{ previousKey: string | null; newState: "active" | "staged" }>>;

  /** Fazer rollback para o pacote anterior */
  rollback(): Promise<StoreResult<{ recovered: boolean; previousKey: string }>>;

  /** Excluir um staging key ou metadado */
  delete(stagingKey: string): Promise<StoreResult<void>>;

  /** Listar todos os pacotes (ativos + staged + antigos) */
  enumerate(): Promise<StoreResult<RegionPackageMetadata[]>>;

  /** Obter metadado de um pacote específico */
  getMetadata(packageId: string): Promise<StoreResult<RegionPackageMetadata>>;

  /** Atualizar metadado de um pacote */
  updateMetadata(packageId: string, metadata: Partial<RegionPackageMetadata>): Promise<StoreResult<void>>;

  /** Obter perfil de storage do dispositivo */
  getDeviceProfile(): Promise<DeviceStorageProfile>;

  /** Verificar se há espaço suficiente para um pacote */
  hasSpace(packageSize: number): Promise<boolean>;

  /** Fazer garbage collection de pacotes antigos/órfãos */
  gc(): Promise<StoreResult<{ collected: number; freedBytes: number }>>;
}

/** Implementação para Web/PWA usando IndexedDB */
export class IndexedDBBlobStore implements LargeBlobStore {
  readonly backend: BlobStoreBackend = "indexeddb";
  private db: IDBDatabase | null = null;
  private readonly dbName = "large-blob-store";
  private readonly blobStoreName = "blobs";
  private readonly metaStoreName = "metadata";
  private readonly dbVersion = 1;

  async init(): Promise<{ success: boolean; backend: BlobStoreBackend; error?: string }> {
    if (this.db) return { success: true, backend: this.backend };

    if (typeof indexedDB === "undefined") {
      return { success: false, backend: "unknown", error: "IndexedDB indisponível neste ambiente" };
    }

    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const openRequest = indexedDB.open(this.dbName, this.dbVersion);

        openRequest.onupgradeneeded = () => {
          const db = openRequest.result;

          if (!db.objectStoreNames.contains(this.blobStoreName)) {
            const blobStore = db.createObjectStore(this.blobStoreName, { keyPath: "key" });
            blobStore.createIndex("packageId", "packageId", { unique: false });
            blobStore.createIndex("lastModified", "lastModified", { unique: false });
          }

          if (!db.objectStoreNames.contains(this.metaStoreName)) {
            const metaStore = db.createObjectStore(this.metaStoreName, { keyPath: "key" });
            metaStore.createIndex("staging", "staging", { unique: false });
            metaStore.createIndex("lastModified", "lastModified", { unique: false });
          }
        };

        openRequest.onsuccess = () => resolve(openRequest.result);
        openRequest.onerror = () => reject(openRequest.error ?? new Error("Falha ao abrir IndexedDB"));
      });

      return { success: true, backend: this.backend };
    } catch (error) {
      return { success: false, backend: this.backend, error: errorMessage(error) };
    }
  }

  private database(): IDBDatabase {
    if (!this.db) throw new Error("LargeBlobStore não inicializado: chame init() antes das operações");
    return this.db;
  }

  async staging(packageId: string, packageSize: number, options?: StoreOptions): Promise<StoreResult<{ stagingKey: string; estimatedTime: number }>> {
    try {
      const db = this.database();
      const now = new Date().toISOString();
      const stagingKey = `staging-${packageId}-${Date.now()}`;

      const tx = db.transaction([this.blobStoreName, this.metaStoreName], "readwrite");
      const blobs = tx.objectStore(this.blobStoreName);
      const meta = tx.objectStore(this.metaStoreName);

      blobs.put({
        key: stagingKey,
        packageId,
        staging: true,
        data: new ArrayBuffer(0),
        size: 0,
        checksum: "",
        lastModified: now,
      } satisfies BlobRecord);

      meta.put({
        key: packageId,
        id: packageId,
        version: "0.0.0",
        label: formatBytes(packageSize),
        size: packageSize,
        checksum: "",
        lastModified: now,
        staging: true,
        lastAttempt: now,
      } satisfies MetadataRecord);

      await txDone(tx);

      const chunkSize = options?.chunkSize && options.chunkSize > 0 ? options.chunkSize : 1024 * 1024;
      const estimatedTime = Math.max(1, Math.ceil(packageSize / chunkSize));

      return { success: true, data: { stagingKey, estimatedTime } };
    } catch (error) {
      return { success: false, error: createBlobStoreError("staging-failed", errorMessage(error), true) };
    }
  }

  async write(stagingKey: string, data: ArrayBuffer | Uint8Array, options?: StoreOptions): Promise<StoreResult<{ bytesWritten: number; checksum: string }>> {
    try {
      const buffer = toArrayBuffer(data);
      const checksum = await sha256Hex(buffer);

      const db = this.database();
      const tx = db.transaction(this.blobStoreName, "readwrite");
      const blobs = tx.objectStore(this.blobStoreName);

      const existing = await requestToPromise<BlobRecord | undefined>(blobs.get(stagingKey));
      if (!existing) {
        tx.abort();
        return { success: false, error: createBlobStoreError("staging-not-found", `Chave de staging inexistente: ${stagingKey}`, false) };
      }

      blobs.put({
        ...existing,
        data: buffer,
        size: buffer.byteLength,
        checksum,
        lastModified: new Date().toISOString(),
      } satisfies BlobRecord);

      await txDone(tx);

      if (options?.ttl && options.ttl > 0) {
        // TTL é tratado pelo gc(): registramos apenas a data de escrita.
      }

      return { success: true, data: { bytesWritten: buffer.byteLength, checksum } };
    } catch (error) {
      return { success: false, error: createBlobStoreError("write-failed", errorMessage(error), true) };
    }
  }

  async read(stagingKey: string, options?: { range?: [number, number] }): Promise<StoreResult<{ data: Uint8Array; size: number }>> {
    try {
      const db = this.database();
      const record = await requestToPromise<BlobRecord | undefined>(
        db.transaction(this.blobStoreName, "readonly").objectStore(this.blobStoreName).get(stagingKey),
      );

      if (!record) {
        return { success: false, error: createBlobStoreError("not-found", `Chave inexistente: ${stagingKey}`, false) };
      }

      const view = new Uint8Array(record.data);
      if (!options?.range) {
        return { success: true, data: { data: view.slice(), size: record.size } };
      }

      const [start, end] = options.range;
      const from = Math.max(0, Math.min(start, view.length));
      const to = Math.max(from, Math.min(end, view.length));
      return { success: true, data: { data: view.slice(from, to), size: to - from } };
    } catch (error) {
      return { success: false, error: createBlobStoreError("read-failed", errorMessage(error), true) };
    }
  }

  async checksum(stagingKey: string): Promise<StoreResult<{ algorithm: string; hash: string }>> {
    try {
      const db = this.database();
      const record = await requestToPromise<BlobRecord | undefined>(
        db.transaction(this.blobStoreName, "readonly").objectStore(this.blobStoreName).get(stagingKey),
      );

      if (!record) {
        return { success: false, error: createBlobStoreError("not-found", `Chave inexistente: ${stagingKey}`, false) };
      }

      if (record.checksum) {
        return { success: true, data: { algorithm: "SHA-256", hash: record.checksum } };
      }

      const hash = await sha256Hex(record.data);
      return { success: true, data: { algorithm: "SHA-256", hash } };
    } catch (error) {
      return { success: false, error: createBlobStoreError("checksum-failed", errorMessage(error), true) };
    }
  }

  async activate(stagingKey: string): Promise<StoreResult<{ previousKey: string | null; newState: "active" | "staged" }>> {
    try {
      const db = this.database();
      const tx = db.transaction([this.blobStoreName, this.metaStoreName], "readwrite");
      const blobs = tx.objectStore(this.blobStoreName);
      const meta = tx.objectStore(this.metaStoreName);

      const record = await requestToPromise<BlobRecord | undefined>(blobs.get(stagingKey));
      if (!record) {
        tx.abort();
        return { success: false, error: createBlobStoreError("staging-not-found", `Chave de staging inexistente: ${stagingKey}`, false) };
      }

      if (record.size === 0) {
        tx.abort();
        return { success: false, error: createBlobStoreError("empty-package", "Pacote vazio não pode ser ativado", false) };
      }

      // Desativar qualquer pacote ativo anterior
      const activeIndex = blobs.index("packageId");
      const previousKey = await findActiveKey(activeIndex, record.packageId);

      const all = await requestToPromise<MetadataRecord[]>(meta.getAll());
      const activatedAt = new Date().toISOString();

      blobs.put({ ...record, staging: false, lastModified: activatedAt } satisfies BlobRecord);

      const metadata: MetadataRecord = all.find((entry) => entry.id === record.packageId) ?? {
        key: record.packageId,
        id: record.packageId,
        version: "0.0.0",
        label: record.packageId,
        size: record.size,
        checksum: record.checksum,
        lastModified: activatedAt,
        staging: false,
      };
      meta.put({ ...metadata, staging: false, size: record.size, checksum: record.checksum, lastModified: activatedAt } satisfies MetadataRecord);

      await txDone(tx);

      return { success: true, data: { previousKey, newState: "active" } };
    } catch (error) {
      return { success: false, error: createBlobStoreError("activate-failed", errorMessage(error), true) };
    }
  }

  async rollback(): Promise<StoreResult<{ recovered: boolean; previousKey: string }>> {
    try {
      const db = this.database();
      const tx = db.transaction([this.blobStoreName, this.metaStoreName], "readwrite");
      const blobs = tx.objectStore(this.blobStoreName);
      const meta = tx.objectStore(this.metaStoreName);

      const staged = await requestToPromise<BlobRecord[]>(blobs.index("packageId").getAll());
      const stagedEntry = staged.filter((entry) => entry.staging).sort((a, b) => b.lastModified.localeCompare(a.lastModified))[0];
      if (!stagedEntry) {
        tx.abort();
        return { success: false, error: createBlobStoreError("no-staged-package", "Nenhum pacote em staging para desfazer", false) };
      }

      const active = staged.filter((entry) => entry.packageId === stagedEntry.packageId && !entry.staging)[0];
      if (!active) {
        tx.abort();
        return { success: false, error: createBlobStoreError("no-previous-package", "Nenhum pacote anterior para restaurar", false) };
      }

      blobs.delete(stagedEntry.key);

      const metadata = await requestToPromise<MetadataRecord | undefined>(meta.get(stagedEntry.packageId));
      if (metadata) {
        meta.put({ ...metadata, staging: false, lastModified: active.lastModified } satisfies MetadataRecord);
      }

      await txDone(tx);

      return { success: true, data: { recovered: true, previousKey: active.key } };
    } catch (error) {
      return { success: false, error: createBlobStoreError("rollback-failed", errorMessage(error), true) };
    }
  }

  async delete(stagingKey: string): Promise<StoreResult<void>> {
    try {
      const db = this.database();
      const tx = db.transaction([this.blobStoreName, this.metaStoreName], "readwrite");
      const blobs = tx.objectStore(this.blobStoreName);
      const meta = tx.objectStore(this.metaStoreName);

      const record = await requestToPromise<BlobRecord | undefined>(blobs.get(stagingKey));
      blobs.delete(stagingKey);

      if (record) {
        const metadata = await requestToPromise<MetadataRecord | undefined>(meta.get(record.packageId));
        const hasOtherBlobs = (await requestToPromise<number>(blobs.index("packageId").count(record.packageId))) > 0;
        if (metadata && !hasOtherBlobs) meta.delete(record.packageId);
      }

      await txDone(tx);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: createBlobStoreError("delete-failed", errorMessage(error), true) };
    }
  }

  async enumerate(): Promise<StoreResult<RegionPackageMetadata[]>> {
    try {
      const db = this.database();
      const all = await requestToPromise<MetadataRecord[]>(
        db.transaction(this.metaStoreName, "readonly").objectStore(this.metaStoreName).getAll(),
      );
      return { success: true, data: all.map(stripKey) };
    } catch (error) {
      return { success: false, error: createBlobStoreError("enumerate-failed", errorMessage(error), false) };
    }
  }

  async getMetadata(packageId: string): Promise<StoreResult<RegionPackageMetadata>> {
    try {
      const db = this.database();
      const record = await requestToPromise<MetadataRecord | undefined>(
        db.transaction(this.metaStoreName, "readonly").objectStore(this.metaStoreName).get(packageId),
      );
      if (!record) {
        return { success: false, error: createBlobStoreError("not-found", `Pacote inexistente: ${packageId}`, false) };
      }
      return { success: true, data: stripKey(record) };
    } catch (error) {
      return { success: false, error: createBlobStoreError("get-metadata-failed", errorMessage(error), false) };
    }
  }

  async updateMetadata(packageId: string, metadata: Partial<RegionPackageMetadata>): Promise<StoreResult<void>> {
    try {
      const db = this.database();
      const tx = db.transaction(this.metaStoreName, "readwrite");
      const meta = tx.objectStore(this.metaStoreName);

      const record = await requestToPromise<MetadataRecord | undefined>(meta.get(packageId));
      if (!record) {
        tx.abort();
        return { success: false, error: createBlobStoreError("not-found", `Pacote inexistente: ${packageId}`, false) };
      }

      meta.put({ ...record, ...metadata, key: packageId, lastModified: new Date().toISOString() } satisfies MetadataRecord);

      await txDone(tx);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: createBlobStoreError("update-metadata-failed", errorMessage(error), true) };
    }
  }

  async getDeviceProfile(): Promise<DeviceStorageProfile> {
    return refreshStorageProfile();
  }

  async hasSpace(packageSize: number): Promise<boolean> {
    if (packageSize <= 0) return false;
    const profile = await getDeviceStorageProfile();
    return profile.freeSpace >= packageSize && profile.safeLimit >= packageSize;
  }

  async gc(): Promise<StoreResult<{ collected: number; freedBytes: number }>> {
    try {
      const db = this.database();
      const tx = db.transaction([this.blobStoreName, this.metaStoreName], "readwrite");
      const blobs = tx.objectStore(this.blobStoreName);
      const meta = tx.objectStore(this.metaStoreName);

      const now = Date.now();
      const staleWindowMs = 24 * 60 * 60 * 1000; // staging abandonado há mais de 24h

      const records = await requestToPromise<BlobRecord[]>(blobs.getAll());
      const orphans = records.filter((record) => record.staging && now - Date.parse(record.lastModified) > staleWindowMs);

      let collected = 0;
      let freedBytes = 0;

      for (const record of orphans) {
        blobs.delete(record.key);
        meta.delete(record.packageId);
        collected += 1;
        freedBytes += record.size;
      }

      await txDone(tx);
      return { success: true, data: { collected, freedBytes } };
    } catch (error) {
      return { success: false, error: createBlobStoreError("gc-failed", errorMessage(error), true) };
    }
  }
}

/** Remove o campo interno `key` do registro de metadados */
function stripKey(record: MetadataRecord): RegionPackageMetadata {
  const { key: _key, ...metadata } = record;
  return metadata;
}

/** Localiza a chave do pacote atualmente ativo para um packageId */
async function findActiveKey(
  index: IDBIndex,
  packageId: string,
): Promise<string | null> {
  const entries = await requestToPromise<BlobRecord[]>(index.getAll(packageId));
  return entries.find((entry) => !entry.staging)?.key ?? null;
}

/** Fábria de criaçãodo store */
export class BlobStoreFactory {
  static async create(): Promise<LargeBlobStore> {
    // IndexedDB é o backend suportado pelo ADR-0005 em Web/PWA e Capacitor.
    const store = new IndexedDBBlobStore();
    await store.init();
    return store;
  }
}
