import type { SyncConflict, SyncEntity, SyncEntityPayload, SyncOperation } from "@markmap/contracts";

export const LOCAL_DB_NAME = "GeoNexoLocalFirstDB";
export const LOCAL_DB_VERSION = 2;

export type EntityRecord = {
  key: string;
  workspaceId: string;
  entity: SyncEntity;
  entityId: string;
  version: number;
  deleted: boolean;
  payload?: SyncEntityPayload;
  updatedAt: string;
  predecessorOperationId?: string;
};

export type OriginalRecord = {
  key: string;
  workspaceId: string;
  blobId: string;
  blob: Blob;
  mediaType: string;
  bytes: number;
  sha256: string;
  originalName?: string;
  createdAt: string;
};

export type OutboxRecord = SyncOperation & { key: string; immutable: true; localSequence: number };
export type ConflictRecord = SyncConflict & { key: string; workspaceId: string; createdAt: string };

export type LocalDbStores = "meta" | "entities" | "originals" | "outbox" | "conflicts" | "acks";

export type LocalDb = {
  workspaceId(): Promise<string>;
  transact<T>(stores: LocalDbStores[], mode: IDBTransactionMode, work: (tx: LocalDbTransaction) => Promise<T> | T): Promise<T>;
  close(): void;
};

export type LocalDbTransaction = {
  store(name: LocalDbStores): IDBObjectStore;
};

export const entityKey = (workspaceId: string, entity: SyncEntity, entityId: string) => `${workspaceId}:${entity}:${entityId}`;
export const originalKey = (workspaceId: string, blobId: string) => `${workspaceId}:${blobId}`;
