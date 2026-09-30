import {
  syncConflictSchema,
  syncOperationSchema,
  type SyncConflict,
  type SyncEntity,
  type SyncEntityPayload,
  type SyncOperation,
} from "@geonexo/contracts";
import { entityKey, localDb, originalKey, type ConflictRecord, type EntityRecord, type LocalDb, type OriginalRecord, type OutboxRecord } from "../local-db";

const now = () => new Date().toISOString();

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Leitura local falhou."));
  });
}

export class LocalRepository {
  constructor(private readonly db: LocalDb = localDb) {}

  async workspaceId(): Promise<string> { return this.db.workspaceId(); }

  async mutate<T extends SyncEntityPayload>(input: {
    entity: T["entity"];
    entityId: string;
    payload?: T;
    operation: "upsert" | "delete";
    baseVersion: number | null;
    predecessorOperationId?: string;
  }): Promise<SyncOperation> {
    const workspaceId = await this.db.workspaceId();
    const operationId = crypto.randomUUID();
    const operation = syncOperationSchema.parse({
      operationId, workspaceId, entity: input.entity, entityId: input.entityId,
      operation: input.operation, baseVersion: input.baseVersion,
      ...(input.predecessorOperationId ? { predecessorOperationId: input.predecessorOperationId } : {}),
      createdAt: now(),
      ...(input.payload ? { payload: input.payload } : {}),
    });
    const entity: EntityRecord = {
      key: entityKey(workspaceId, input.entity, input.entityId), workspaceId,
      entity: input.entity, entityId: input.entityId, version: input.baseVersion ?? 0,
      deleted: input.operation === "delete", ...(input.payload ? { payload: input.payload } : {}),
      updatedAt: operation.createdAt, predecessorOperationId: operationId,
    };
    const outbox: OutboxRecord = { ...operation, key: operationId, immutable: true, localSequence: 0 };
    await this.db.transact(["meta", "entities", "outbox"], "readwrite", async (tx) => {
      const meta = await read<{ key: string; value: number } | undefined>(tx.store("meta").get("outboxSequence"));
      const localSequence = (meta?.value ?? 0) + 1;
      tx.store("meta").put({ key: "outboxSequence", value: localSequence });
      tx.store("entities").put(entity);
      tx.store("outbox").add({ ...outbox, localSequence });
    });
    return operation;
  }

  async getEntity(workspaceId: string, entity: SyncEntity, entityId: string): Promise<EntityRecord | null> {
    return this.db.transact(["entities"], "readonly", (tx) => read(tx.store("entities").get(entityKey(workspaceId, entity, entityId))));
  }

  async listEntities(entity: SyncEntity, workspaceId?: string): Promise<EntityRecord[]> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["entities"], "readonly", (tx) => read<EntityRecord[]>(tx.store("entities").index("workspace").getAll(workspaceId)).then((rows) => rows
      .filter((row) => row.entity === entity && !row.deleted)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.entityId.localeCompare(b.entityId))));
  }

  async listOutbox(workspaceId?: string): Promise<SyncOperation[]> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["outbox", "acks"], "readonly", async (tx) => {
      const [all, acks] = await Promise.all([
        read<OutboxRecord[]>(tx.store("outbox").index("workspace").getAll(workspaceId)),
        read<Array<{ key: string }>>(tx.store("acks").index("workspace").getAll(workspaceId)),
      ]);
      const acknowledged = new Set(acks.map((ack) => ack.key));
      return all.filter((entry) => !acknowledged.has(entry.operationId)).sort((a, b) => a.localSequence - b.localSequence).map(({ key: _key, immutable: _immutable, localSequence: _localSequence, ...operation }) => operation);
    });
  }

  async acknowledge(operationId: string, version: number, sequence: string, predecessorOperationId?: string): Promise<boolean> {
    if (!Number.isInteger(version) || version < 1) throw new Error("A versão do acknowledgement deve ser positiva.");
    if (!/^(0|[1-9]\d*)$/.test(sequence) || BigInt(sequence) < 1n) throw new Error("A sequência do acknowledgement deve ser decimal positiva.");
    const workspaceId = await this.workspaceId();
    return this.db.transact(["outbox", "entities", "acks"], "readwrite", async (tx) => {
      const outbox = await read<OutboxRecord | undefined>(tx.store("outbox").get(operationId));
      if (!outbox || outbox.workspaceId !== workspaceId) return false;
      const previousAck = await read<{ version: number; sequence: string } | undefined>(tx.store("acks").get(operationId));
      if (previousAck && (version < previousAck.version || BigInt(sequence) < BigInt(previousAck.sequence))) return false;
      if (previousAck && version === previousAck.version && sequence === previousAck.sequence) return true;
      const entity = await read<EntityRecord | undefined>(tx.store("entities").get(entityKey(workspaceId, outbox.entity, outbox.entityId)));
      if (!entity || entity.predecessorOperationId !== operationId) return false;
      tx.store("entities").put({ ...entity, version, updatedAt: now() });
      tx.store("acks").put({ key: operationId, workspaceId, operationId, version, sequence, predecessorOperationId });
      return true;
    });
  }

  async saveOriginal(input: Omit<OriginalRecord, "key" | "workspaceId" | "createdAt">): Promise<void> {
    if (input.mediaType !== "application/pdf") throw new Error("O original local deve ser um PDF.");
    if (!(input.blob instanceof Blob) || input.blob.size < 1 || input.blob.size > 25 * 1024 * 1024) throw new Error("O PDF original excede o limite de 25 MiB ou está vazio.");
    if (input.bytes !== input.blob.size) throw new Error("O tamanho declarado do PDF não corresponde ao Blob.");
    if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new Error("SHA-256 inválido.");
    const bytes = typeof input.blob.arrayBuffer === "function" ? await input.blob.arrayBuffer() : await new Response(input.blob).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const actualHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    if (actualHash.toLowerCase() !== input.sha256.toLowerCase()) throw new Error("SHA-256 do PDF original não confere.");
    const workspaceId = await this.workspaceId();
    const record: OriginalRecord = { ...input, key: originalKey(workspaceId, input.blobId), workspaceId, createdAt: now() };
    await this.db.transact(["originals"], "readwrite", async (tx) => {
      const current = await read<OriginalRecord | undefined>(tx.store("originals").get(record.key));
      if (current) {
        if (current.mediaType === record.mediaType && current.bytes === record.bytes && current.sha256.toLowerCase() === record.sha256.toLowerCase()) return;
        throw new Error("Já existe um original com o mesmo blobId e metadados conflitantes.");
      }
      tx.store("originals").add(record);
    });
  }

  async getOriginal(blobId: string, workspaceId?: string): Promise<OriginalRecord | null> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["originals"], "readonly", (tx) => read(tx.store("originals").get(originalKey(workspaceId, blobId))));
  }

  async listOriginals(workspaceId?: string): Promise<OriginalRecord[]> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["originals"], "readonly", (tx) => read<OriginalRecord[]>(tx.store("originals").index("workspace").getAll(workspaceId)));
  }

  async saveConflict(conflict: SyncConflict): Promise<void> {
    const workspaceId = await this.workspaceId();
    const parsed = syncConflictSchema.parse(conflict);
    const record: ConflictRecord = { ...parsed, workspaceId, createdAt: now(), key: `${workspaceId}:${parsed.operationId}` };
    await this.db.transact(["conflicts"], "readwrite", (tx) => { tx.store("conflicts").put(record); });
  }

  async listConflicts(workspaceId?: string): Promise<SyncConflict[]> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["conflicts"], "readonly", (tx) => read<ConflictRecord[]>(tx.store("conflicts").index("workspace").getAll(workspaceId)).then((rows) => rows.map(({ key: _key, workspaceId: _workspaceId, createdAt: _createdAt, ...conflict }) => conflict)));
  }
}

export const localRepository = new LocalRepository();
export type { EntityRecord, OriginalRecord, OutboxRecord, ConflictRecord } from "../local-db";
