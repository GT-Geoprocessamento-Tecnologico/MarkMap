import {
  syncConflictSchema,
  syncOperationSchema,
  type ServerChange,
  type SyncConflict,
  type SyncEntity,
  type SyncEntityPayload,
  type SyncOperation,
  type WorkspaceCapability,
  type Tombstone,
} from "@markmap/contracts";
import {
  entityKey,
  localDb,
  originalKey,
  type ConflictRecord,
  type EntityRecord,
  type LocalDb,
  type OriginalRecord,
  type OutboxRecord,
} from "../local-db";
import { readBlobBytes } from "../blob-bytes";
import { notifyImportCatalogChanged } from "../storage/import-catalog-events.mjs";
import { notifyEntityCatalogChanged } from "../storage/entity-catalog-events.mjs";
import { normalizeImportedOriginalName } from "../storage/original-file-name.mjs";
import { geoReferenceSchema, type GeoReference } from "@markmap/contracts";
import { assignedProjectGeoPdf, assertGeoPdfProjectIds, reassignProjectGeoPdf } from "../pdf/project-geopdf-link.mjs";
import {
  MAX_POINT_PHOTOS, MAX_WORKSPACE_POINT_PHOTO_BYTES,
  isPhotoMediaType, isSupportedBackupOriginalMediaType,
  validPointPhotoLink, validatePhotoBytes, validatePhotoOriginalMetadata,
} from "../photo/point-photo-policy.mjs";

type BootstrapIdentity = { installationId: string; bootstrapProof: string };

// Older installations stored Blob directly. New records use the bytes already
// validated below, avoiding WebKit's Blob preparation failure without a migration.
type StoredOriginal = Omit<OriginalRecord, 'blob'> & { blob?: Blob; originalBytes?: ArrayBuffer };
type PhotoLink = NonNullable<OriginalRecord['pointPhoto']>;
function samePhotoLink(left?: PhotoLink, right?: PhotoLink): boolean {
  if (!left || !right) return left === right;
  return left.projectId === right.projectId &&
    left.layerId === right.layerId && left.featureId === right.featureId;
}

function restoreOriginal(record: StoredOriginal): OriginalRecord {
  const { originalBytes, ...metadata } = record;
  const blob = record.blob instanceof Blob ? record.blob
    : originalBytes instanceof ArrayBuffer ? new Blob([originalBytes], { type: record.mediaType }) : null;
  if (!blob || blob.size !== record.bytes || blob.size < 1 || blob.size > 25 * 1024 * 1024)
    throw new Error('Os bytes do arquivo original não estão disponíveis ou estão incompletos.');
  validatePhotoOriginalMetadata(record);
  return { ...metadata, blob };
}

const now = () => new Date().toISOString();

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Leitura local falhou."));
  });
}

function featurePayloadAtVersion(
  payload: SyncEntityPayload | undefined,
  version: number,
): SyncEntityPayload | undefined {
  if (payload?.entity !== "feature") return payload;
  return {
    ...payload,
    data: { ...payload.data, version },
  };
}

export class LocalRepository {
  constructor(private readonly db: LocalDb = localDb) {}

  async workspaceId(): Promise<string> {
    return this.db.workspaceId();
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return this.db.transact(["meta"], "readonly", async (tx) => {
      const row = await read<{ key: string; value: T } | undefined>(
        tx.store("meta").get(key),
      );
      return row?.value;
    });
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    // PDF preview can finish calibration after another tab deletes the file.
    // Never resurrect its legacy metadata without the corresponding original.
    const pdfId = /^(?:pdfGeoref|pdfGeorefSource):(.+)$/.exec(key)?.[1];
    if (pdfId) {
      const workspaceId = await this.workspaceId();
      await this.db.transact(["originals", "meta"], "readwrite", async (tx) => {
        const original = await read<StoredOriginal | undefined>(
          tx.store("originals").get(originalKey(workspaceId, pdfId)),
        );
        if (!original || original.mediaType !== "application/pdf")
          throw new Error("GeoPDF foi excluído deste dispositivo.");
        tx.store("meta").put({ key, value });
      });
      return;
    }
    await this.db.transact(["meta"], "readwrite", (tx) => {
      tx.store("meta").put({ key, value });
    });
  }

  /** Keep both recovery values under one IndexedDB readwrite transaction.
   * Two tabs must not provision the same workspace with different proofs. */
  async ensureBootstrapIdentity(
    create: () => BootstrapIdentity,
  ): Promise<BootstrapIdentity> {
    return this.db.transact(["meta"], "readwrite", async (tx) => {
      const meta = tx.store("meta");
      const [installation, proof] = await Promise.all([
        read<{ key: string; value: string } | undefined>(meta.get("installationId")),
        read<{ key: string; value: string } | undefined>(meta.get("workspaceBootstrapProof")),
      ]);
      if (installation?.value && proof?.value)
        return { installationId: installation.value, bootstrapProof: proof.value };
      const generated = create();
      const installationId = installation?.value || generated.installationId;
      const bootstrapProof = proof?.value || generated.bootstrapProof;
      if (!installation?.value) meta.put({ key: "installationId", value: installationId });
      if (!proof?.value) meta.put({ key: "workspaceBootstrapProof", value: bootstrapProof });
      return { installationId, bootstrapProof };
    });
  }

  /** Never allow a delayed 401 recovery response to downgrade a newer bearer. */
  async saveWorkspaceCapability(candidate: WorkspaceCapability): Promise<WorkspaceCapability> {
    if (candidate.workspaceId !== await this.workspaceId())
      throw new Error("Workspace capability does not match this device.");
    return this.db.transact(["meta"], "readwrite", async (tx) => {
      const meta = tx.store("meta");
      const stored = await read<{ key: string; value: WorkspaceCapability } | undefined>(
        meta.get("workspaceCapability"),
      );
      const current = stored?.value;
      if (current && BigInt(current.generation) > BigInt(candidate.generation))
        return current;
      // Sync cursors are HMAC-signed with the bearer on the API. After rotation
      // the old cursor is no longer valid; retire it atomically with the token.
      // Keep the outbox, ACKs, conflicts and offline entities untouched.
      if (!current || current.bearer !== candidate.bearer)
        meta.delete("syncCursor");
      meta.put({ key: "workspaceCapability", value: candidate });
      return candidate;
    });
  }

  async mutate(input: {
    entity: SyncEntity;
    entityId: string;
    payload?: SyncEntityPayload;
    operation: "upsert" | "delete";
    baseVersion: number | null;
    predecessorOperationId?: string;
  }): Promise<SyncOperation> {
    const workspaceId = await this.db.workspaceId();
    const operationId = crypto.randomUUID();
    const createdAt = now();
    const key = entityKey(workspaceId, input.entity, input.entityId);
    const operation = await this.db.transact(
      ["meta", "entities", "outbox"],
      "readwrite",
      async (tx) => {
        const current = await read<EntityRecord | undefined>(
          tx.store("entities").get(key),
        );
        const predecessorOperationId =
          input.predecessorOperationId ?? current?.predecessorOperationId;
        const operation = syncOperationSchema.parse({
          operationId,
          workspaceId,
          entity: input.entity,
          entityId: input.entityId,
          operation: input.operation,
          baseVersion: input.baseVersion,
          ...(predecessorOperationId ? { predecessorOperationId } : {}),
          createdAt,
          ...(input.payload ? { payload: input.payload } : {}),
        });
        const entity: EntityRecord = {
          key,
          workspaceId,
          entity: input.entity,
          entityId: input.entityId,
          version: current?.version ?? input.baseVersion ?? 0,
          deleted: input.operation === "delete",
          ...(input.payload ? { payload: input.payload } : {}),
          updatedAt: createdAt,
          predecessorOperationId: operationId,
        };
        const meta = await read<{ key: string; value: number } | undefined>(
          tx.store("meta").get("outboxSequence"),
        );
        const localSequence = (meta?.value ?? 0) + 1;
        tx.store("meta").put({ key: "outboxSequence", value: localSequence });
        tx.store("entities").put(entity);
        tx.store("outbox").add({
          ...operation,
          key: operationId,
          immutable: true,
          localSequence,
        } satisfies OutboxRecord);
        return operation;
      },
    );
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("markmap-local-mutation"));
    return operation;
  }

  /**
   * Delete a project or a layer, including all of its known descendants, in
   * one durable IndexedDB transaction. Deletions are tombstones with immutable
   * sync outbox operations; only point photos are removed as local binaries.
   * GeoPDFs remain shared files, with only the deleted project link removed.
   */
  async deleteOwnedTree(input: {
    kind: "project" | "layer";
    id: string;
    expectedName: string;
  }): Promise<{
    deleted: boolean;
    projectId: string;
    layers: number;
    features: number;
    photos: number;
    pdfLinks: number;
  }> {
    const workspaceId = await this.workspaceId();
    const completed = await this.db.transact(
      ["meta", "entities", "originals", "outbox"],
      "readwrite",
      async (tx) => {
        const entities = tx.store("entities");
        const all = await read<EntityRecord[]>(entities.index("workspace").getAll(workspaceId));
        const target = all.find((row) => row.entity === input.kind && row.entityId === input.id);
        if (!target) throw new Error("Registro não encontrado neste dispositivo.");
        if (target.deleted) return {
          result: { deleted: false, projectId: input.id, layers: 0, features: 0, photos: 0, pdfLinks: 0 },
          changedPdfIds: [] as string[],
        };
        const targetName = target.payload?.entity === "project" || target.payload?.entity === "layer"
          ? target.payload.data.name : undefined;
        if (targetName === undefined) throw new Error("Dados locais inválidos; exclusão cancelada.");
        if (targetName !== input.expectedName)
          throw new Error("O registro mudou em outra aba. Recarregue antes de excluir.");
        if (input.kind === "layer" && target.payload?.entity !== "layer")
          throw new Error("Camada inválida; exclusão cancelada.");
        if (input.kind === "project" && target.payload?.entity !== "project")
          throw new Error("Projeto inválido; exclusão cancelada.");
        const projectId = input.kind === "project" ? input.id :
          target.payload?.entity === "layer" ? target.payload.data.projectId : "";
        if (input.kind === "layer") {
          const owner = all.find((row) => row.entity === "project" && row.entityId === projectId);
          if (!owner || owner.deleted)
            throw new Error("O projeto desta camada já foi excluído.");
        }
        const layerIds = new Set(all.filter((row) => row.entity === "layer" &&
          row.payload?.entity === "layer" && (input.kind === "project"
            ? row.payload.data.projectId === projectId : row.entityId === input.id))
          .map((row) => row.entityId));
        if (input.kind === "layer") layerIds.add(input.id);
        const belongsToProject = (row: EntityRecord): boolean => {
          const payload = row.payload;
          return (payload?.entity === "layer" || payload?.entity === "map" || payload?.entity === "import") &&
            payload.data.projectId === projectId;
        };
        const removed = all.filter((row) => {
          if (row.deleted) return false;
          if (row.entity === "feature" && row.payload?.entity === "feature")
            return layerIds.has(row.payload.data.layerId);
          if (input.kind === "layer") return row.entity === "layer" && row.entityId === input.id;
          return (row.entity === "project" && row.entityId === projectId) || belongsToProject(row);
        });
        // Child operations must reach the sync server before their parents.
        const rank = (entity: SyncEntity) => entity === "feature" ? 0 :
          entity === "import" || entity === "map" ? 1 : entity === "layer" ? 2 : 3;
        removed.sort((a, b) => rank(a.entity) - rank(b.entity) || a.entityId.localeCompare(b.entityId));
        const meta = tx.store("meta");
        const current = await read<{ value: number } | undefined>(meta.get("outboxSequence"));
        let sequence = current?.value ?? 0;
        const createdAt = now();
        for (const row of removed) {
          const operationId = crypto.randomUUID();
          const operation = syncOperationSchema.parse({
            operationId, workspaceId, entity: row.entity, entityId: row.entityId,
            operation: "delete", baseVersion: row.version ?? 0,
            ...(row.predecessorOperationId ? { predecessorOperationId: row.predecessorOperationId } : {}),
            createdAt,
          });
          entities.put({
            ...row, payload: undefined, deleted: true, updatedAt: createdAt,
            predecessorOperationId: operationId,
          } satisfies EntityRecord);
          tx.store("outbox").add({
            ...operation, key: operationId, immutable: true, localSequence: ++sequence,
          } satisfies OutboxRecord);
        }
        meta.put({ key: "outboxSequence", value: sequence });
        const originals = tx.store("originals");
        const allOriginals = await read<StoredOriginal[]>(originals.index("workspace").getAll(workspaceId));
        let photos = 0;
        const changedPdfIds: string[] = [];
        for (const record of allOriginals) {
          const photo = record.pointPhoto;
          const removePhoto = photo && (input.kind === "project"
            ? photo.projectId === projectId
            : photo.projectId === projectId && photo.layerId === input.id);
          if (removePhoto) {
            if (!isPhotoMediaType(record.mediaType))
              throw new Error("Vínculo de foto inválido. Nenhum dado foi excluído.");
            originals.delete(record.key);
            photos++;
            continue;
          }
          if (input.kind === "project" && record.projectGeoPdfIds?.includes(projectId)) {
            originals.put({ ...record,
              projectGeoPdfIds: record.projectGeoPdfIds.filter((id) => id !== projectId) });
            changedPdfIds.push(record.blobId);
          }
        }
        // Mesh binaries live in a different database. This durable marker lets
        // startup/retry finish that cleanup after an interruption.
        if (input.kind === "project")
          meta.put({ key: `pendingProjectMeshCleanup:${workspaceId}:${projectId}`, value: true });
        return {
          result: {
            deleted: true, projectId,
            layers: removed.filter((row) => row.entity === "layer").length,
            features: removed.filter((row) => row.entity === "feature").length,
            photos, pdfLinks: changedPdfIds.length,
          }, changedPdfIds,
        };
      },
    );
    if (completed.result.deleted) {
      for (const id of completed.changedPdfIds)
        notifyImportCatalogChanged({ kind: "original", id, action: "updated" });
      notifyEntityCatalogChanged({ kind: input.kind, id: input.id, action: "deleted" });
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("markmap-local-mutation"));
    }
    return completed.result;
  }

  /** Recover mesh cleanup across separate IndexedDB databases after a crash. */
  async pendingProjectMeshCleanupIds(): Promise<string[]> {
    const workspaceId = await this.workspaceId();
    const prefix = `pendingProjectMeshCleanup:${workspaceId}:`;
    return this.db.transact(["meta"], "readonly", async (tx) => {
      const rows = await read<Array<{ key: string; value: unknown }>>(tx.store("meta").getAll());
      return rows.filter((row) => row.key.startsWith(prefix) && row.value === true)
        .map((row) => row.key.slice(prefix.length));
    });
  }

  async completeProjectMeshCleanup(projectId: string): Promise<void> {
    const workspaceId = await this.workspaceId();
    await this.db.transact(["meta"], "readwrite", (tx) => {
      tx.store("meta").delete(`pendingProjectMeshCleanup:${workspaceId}:${projectId}`);
    });
  }

  async getEntity(
    workspaceId: string,
    entity: SyncEntity,
    entityId: string,
  ): Promise<EntityRecord | null> {
    return this.db.transact(["entities"], "readonly", (tx) =>
      read(tx.store("entities").get(entityKey(workspaceId, entity, entityId))),
    );
  }

  async listEntities(
    entity: SyncEntity,
    workspaceId?: string,
  ): Promise<EntityRecord[]> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["entities"], "readonly", (tx) =>
      read<EntityRecord[]>(
        tx.store("entities").index("workspace").getAll(workspaceId),
      ).then((rows) =>
        rows
          .filter((row) => row.entity === entity && !row.deleted)
          .sort(
            (a, b) =>
              b.updatedAt.localeCompare(a.updatedAt) ||
              a.entityId.localeCompare(b.entityId),
          ),
      ),
    );
  }

  async listOutbox(workspaceId?: string): Promise<SyncOperation[]> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["outbox", "acks", "conflicts"], "readonly", async (tx) => {
      const [all, acks, conflicts] = await Promise.all([
        read<OutboxRecord[]>(
          tx.store("outbox").index("workspace").getAll(workspaceId),
        ),
        read<Array<{ key: string }>>(
          tx.store("acks").index("workspace").getAll(workspaceId),
        ),
        read<ConflictRecord[]>(
          tx.store("conflicts").index("workspace").getAll(workspaceId),
        ),
      ]);
      const acknowledged = new Set(acks.map((ack) => ack.key));
      const conflicted = new Set(conflicts.map((conflict) => conflict.operationId));
      return all
        .filter((entry) => !acknowledged.has(entry.operationId) && !conflicted.has(entry.operationId))
        .sort((a, b) => a.localSequence - b.localSequence)
        .map(
          ({ key: _key, immutable: _immutable, localSequence: _localSequence, ...operation }) =>
            operation,
        );
    });
  }

  async acknowledge(
    operationId: string,
    version: number,
    sequence: string,
    predecessorOperationId?: string,
  ): Promise<boolean> {
    if (!Number.isInteger(version) || version < 1)
      throw new Error("A versão do acknowledgement deve ser positiva.");
    if (!/^(0|[1-9]\d*)$/.test(sequence) || BigInt(sequence) < 1n)
      throw new Error("A sequência do acknowledgement deve ser decimal positiva.");
    const workspaceId = await this.workspaceId();
    return this.db.transact(
      ["outbox", "entities", "acks"],
      "readwrite",
      async (tx) => {
        const previousAck = await read<
          { version: number; sequence: string } | undefined
        >(tx.store("acks").get(operationId));
        if (
          previousAck &&
          (version < previousAck.version ||
            BigInt(sequence) < BigInt(previousAck.sequence))
        )
          return false;
        if (
          previousAck &&
          version === previousAck.version &&
          sequence === previousAck.sequence
        )
          return true;

        const outbox = await read<OutboxRecord | undefined>(
          tx.store("outbox").get(operationId),
        );
        if (!outbox || outbox.workspaceId !== workspaceId) return false;
        const entity = await read<EntityRecord | undefined>(
          tx
            .store("entities")
            .get(entityKey(workspaceId, outbox.entity, outbox.entityId)),
        );
        if (entity?.predecessorOperationId === operationId) {
          tx.store("entities").put({
            ...entity,
            version,
            payload: featurePayloadAtVersion(entity.payload, version),
            updatedAt: now(),
          });
        }
        tx.store("acks").put({
          key: operationId,
          workspaceId,
          operationId,
          version,
          sequence,
          predecessorOperationId,
        });
        // The durable acknowledgement is the receipt. Keeping the full immutable
        // outbox envelope after that only grows IndexedDB on long field sessions.
        tx.store("outbox").delete(operationId);
        return true;
      },
    );
  }

  async applyServerPage(
    changes: ServerChange[],
    tombstones: Tombstone[],
    nextCursor: string,
    options?: { expectedCursor?: string },
  ): Promise<void> {
    const workspaceId = await this.workspaceId();
    await this.db.transact(
      ["meta", "entities", "outbox", "acks", "conflicts"],
      "readwrite",
      async (tx) => {
        // Another tab may have committed a newer page while this request was
        // in flight. Check within the same readwrite transaction as the edits.
        if (options) {
          const stored = await read<{ key: string; value: string } | undefined>(
            tx.store("meta").get("syncCursor"),
          );
          if (stored?.value !== options.expectedCursor)
            throw new Error("Sync cursor changed during page application");
        }
        const entities = tx.store("entities");
        const outboxStore = tx.store("outbox");
        const ackStore = tx.store("acks");
        const conflictStore = tx.store("conflicts");

        const latestPending = async (
          entity: SyncEntity,
          entityId: string,
        ): Promise<OutboxRecord | undefined> => {
          const candidates = await read<OutboxRecord[]>(
            outboxStore
              .index("entity")
              .getAll([workspaceId, entity, entityId]),
          );
          const pending: OutboxRecord[] = [];
          for (const candidate of candidates) {
            const ack = await read<{ key: string } | undefined>(
              ackStore.get(candidate.operationId),
            );
            if (!ack) pending.push(candidate);
          }
          return pending.sort((a, b) => b.localSequence - a.localSequence)[0];
        };

        const writeConflict = async (
          pending: OutboxRecord,
          serverVersion: number,
          serverPayload?: SyncEntityPayload,
        ): Promise<void> => {
          // Pull groups upserts and tombstones separately. They may refer to
          // different versions of the same entity, even in a single page.
          // Never replace a newer durable conflict with an older event.
          const key = `${workspaceId}:${pending.operationId}`;
          const previous = await read<ConflictRecord | undefined>(
            conflictStore.get(key),
          );
          if (previous && previous.serverVersion >= serverVersion) return;
          const conflict = syncConflictSchema.parse({
            operationId: pending.operationId,
            entity: pending.entity,
            entityId: pending.entityId,
            baseVersion: pending.baseVersion,
            serverVersion,
            ...(pending.operation === "upsert" && pending.payload
              ? { localPayload: pending.payload }
              : {}),
            ...(serverPayload ? { serverPayload } : {}),
            reason: "VERSION_CONFLICT",
          });
          conflictStore.put({
            ...conflict,
            key,
            workspaceId,
            createdAt: now(),
          } satisfies ConflictRecord);
        };

        for (const change of changes) {
          if (change.operation !== "upsert") continue;
          const pending = await latestPending(change.entity, change.entityId);
          if (pending?.operationId === change.operationId) {
            ackStore.put({
              key: change.operationId,
              workspaceId,
              operationId: change.operationId,
              version: change.version,
              sequence: change.sequence,
              predecessorOperationId: pending.predecessorOperationId,
            });
            outboxStore.delete(change.operationId);
            const current = await read<EntityRecord | undefined>(
              entities.get(entityKey(workspaceId, change.entity, change.entityId)),
            );
            if (current?.predecessorOperationId === change.operationId)
              entities.put({
                ...current,
                version: change.version,
                payload: featurePayloadAtVersion(change.payload, change.version),
                updatedAt: now(),
              });
            continue;
          }
          if (pending?.predecessorOperationId === change.operationId) continue;
          if (pending) {
            // A local edit based on version N already knows the history up to
            // N. Old pull pages must not quarantine it as a new conflict.
            if (pending.baseVersion !== null && change.version <= pending.baseVersion)
              continue;
            await writeConflict(pending, change.version, change.payload);
            continue;
          }
          const current = await read<EntityRecord | undefined>(
            entities.get(entityKey(workspaceId, change.entity, change.entityId)),
          );
          if (current && current.version > change.version) continue;
          entities.put({
            key: entityKey(workspaceId, change.entity, change.entityId),
            workspaceId,
            entity: change.entity,
            entityId: change.entityId,
            version: change.version,
            deleted: false,
            payload: featurePayloadAtVersion(change.payload, change.version),
            updatedAt: now(),
            predecessorOperationId: change.operationId,
          } satisfies EntityRecord);
        }

        for (const tombstone of tombstones) {
          const pending = await latestPending(tombstone.entity, tombstone.entityId);
          if (pending) {
            if (pending.baseVersion !== null) {
              // An older deletion is already covered by the version the local
              // operation was based on: it cannot invalidate that edit.
              if (tombstone.version <= pending.baseVersion) continue;
              // A tombstone has no operationId. A pending delete at the next
              // version could be our own committed operation OR a concurrent
              // delete. Do not guess or manufacture an ACK: keep it in the
              // durable outbox for push to confirm or return a real conflict.
              if (
                pending.operation === "delete" &&
                tombstone.version === pending.baseVersion + 1
              ) continue;
            }
            await writeConflict(pending, tombstone.version);
            continue;
          }
          const current = await read<EntityRecord | undefined>(
            entities.get(
              entityKey(workspaceId, tombstone.entity, tombstone.entityId),
            ),
          );
          if (current && current.version > tombstone.version) continue;
          entities.put({
            key: entityKey(workspaceId, tombstone.entity, tombstone.entityId),
            workspaceId,
            entity: tombstone.entity,
            entityId: tombstone.entityId,
            version: tombstone.version,
            deleted: true,
            updatedAt: tombstone.deletedAt,
          } satisfies EntityRecord);
        }

        tx.store("meta").put({ key: "syncCursor", value: nextCursor });
      },
    );
  }

  async resolveConflict(
    operationId: string,
    resolution: "keep-local" | "use-server",
  ): Promise<void> {
    const workspaceId = await this.workspaceId();
    const createdAt = now();
    await this.db.transact(
      ["meta", "entities", "outbox", "conflicts"],
      "readwrite",
      async (tx) => {
        const conflictsStore = tx.store("conflicts");
        const conflict = await read<ConflictRecord | undefined>(
          conflictsStore.get(`${workspaceId}:${operationId}`),
        );
        if (!conflict)
          throw new Error("O conflito já foi resolvido ou não existe.");

        const entityStore = tx.store("entities");
        const entityRecord = await read<EntityRecord | undefined>(
          entityStore.get(
            entityKey(workspaceId, conflict.entity, conflict.entityId),
          ),
        );
        const outboxStore = tx.store("outbox");
        const entityOutbox = await read<OutboxRecord[]>(
          outboxStore
            .index("entity")
            .getAll([workspaceId, conflict.entity, conflict.entityId]),
        );
        for (const pending of entityOutbox)
          outboxStore.delete(pending.operationId);

        const allConflicts = await read<ConflictRecord[]>(
          conflictsStore.index("workspace").getAll(workspaceId),
        );
        for (const current of allConflicts) {
          if (
            current.entity === conflict.entity &&
            current.entityId === conflict.entityId
          )
            conflictsStore.delete(current.key);
        }

        const key = entityKey(
          workspaceId,
          conflict.entity,
          conflict.entityId,
        );

        if (resolution === "use-server") {
          if (conflict.serverPayload) {
            entityStore.put({
              key,
              workspaceId,
              entity: conflict.entity,
              entityId: conflict.entityId,
              version: conflict.serverVersion,
              deleted: false,
              payload: featurePayloadAtVersion(
                conflict.serverPayload,
                conflict.serverVersion,
              ),
              updatedAt: createdAt,
            } satisfies EntityRecord);
          } else {
            entityStore.put({
              key,
              workspaceId,
              entity: conflict.entity,
              entityId: conflict.entityId,
              version: conflict.serverVersion,
              deleted: true,
              updatedAt: createdAt,
            } satisfies EntityRecord);
          }
          return;
        }

        if (!entityRecord)
          throw new Error(
            "A versão local não está mais disponível neste dispositivo.",
          );
        const nextOperationId = crypto.randomUUID();
        const nextOperation = syncOperationSchema.parse({
          operationId: nextOperationId,
          workspaceId,
          entity: conflict.entity,
          entityId: conflict.entityId,
          operation: entityRecord.deleted ? "delete" : "upsert",
          baseVersion: conflict.serverVersion,
          createdAt,
          ...(!entityRecord.deleted && entityRecord.payload
            ? { payload: entityRecord.payload }
            : {}),
        });
        const sequenceMeta = await read<
          { key: string; value: number } | undefined
        >(tx.store("meta").get("outboxSequence"));
        const localSequence = (sequenceMeta?.value ?? 0) + 1;
        tx.store("meta").put({
          key: "outboxSequence",
          value: localSequence,
        });
        outboxStore.add({
          ...nextOperation,
          key: nextOperationId,
          immutable: true,
          localSequence,
        } satisfies OutboxRecord);
        entityStore.put({
          ...entityRecord,
          version: conflict.serverVersion,
          payload: featurePayloadAtVersion(
            entityRecord.payload,
            conflict.serverVersion,
          ),
          updatedAt: createdAt,
          predecessorOperationId: nextOperationId,
        });
      },
    );

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("markmap-local-mutation"));
      window.dispatchEvent(new Event("markmap-conflict-resolved"));
    }
  }

  async saveOriginal(
    input: Omit<OriginalRecord, "key" | "workspaceId" | "createdAt">,
  ): Promise<void> {
    const { blob, ...metadata } = input;
    if (!isSupportedBackupOriginalMediaType(input.mediaType))
      throw new Error("O original local deve ser PDF, GeoTIFF ou foto JPEG/PNG/WebP.");
    validatePhotoOriginalMetadata(input);
    if (input.projectGeoPdfIds !== undefined || input.geoPdfReference !== undefined) {
      if (input.mediaType !== "application/pdf")
        throw new Error("Associações ou georreferência exigem PDF.");
      assertGeoPdfProjectIds(input.projectGeoPdfIds);
      if (input.geoPdfReference !== undefined) geoReferenceSchema.parse(input.geoPdfReference);
    }
    if (
      !(blob instanceof Blob) ||
      blob.size < 1 ||
      blob.size > 25 * 1024 * 1024
    )
      throw new Error("O original excede o limite de 25 MiB ou está vazio.");
    if (input.bytes !== blob.size)
      throw new Error("O tamanho declarado do original não corresponde ao Blob.");
    if (!/^[a-f0-9]{64}$/i.test(input.sha256))
      throw new Error("SHA-256 inválido.");
    const bytes = await readBlobBytes(blob);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(bytes),
    );
    const actualHash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (actualHash.toLowerCase() !== input.sha256.toLowerCase())
      throw new Error("SHA-256 do arquivo original não confere.");
    if (isPhotoMediaType(input.mediaType))
      validatePhotoBytes(input.mediaType, new Uint8Array(bytes));
    const workspaceId = await this.workspaceId();
    const record: StoredOriginal = {
      ...metadata,
      originalBytes: bytes,
      key: originalKey(workspaceId, input.blobId),
      workspaceId,
      createdAt: now(),
    };
    const added = await this.db.transact(input.pointPhoto ? ["originals", "entities"] : ["originals"], "readwrite", async (tx) => {
      if (input.pointPhoto) {
        const link = input.pointPhoto;
        const [feature, layer] = await Promise.all([
          read<EntityRecord | undefined>(tx.store("entities").get(entityKey(workspaceId, "feature", link.featureId))),
          read<EntityRecord | undefined>(tx.store("entities").get(entityKey(workspaceId, "layer", link.layerId))),
        ]);
        if (!feature || feature.deleted || feature.payload?.entity !== "feature" ||
            feature.payload.data.layerId !== link.layerId ||
            !layer || layer.deleted || layer.payload?.entity !== "layer" ||
            layer.payload.data.projectId !== link.projectId) {
          throw new Error("O ponto não pertence a este projeto/camada ou foi excluído.");
        }
      }
      const current = await read<StoredOriginal | undefined>(
        tx.store("originals").get(record.key),
      );
      if (current) {
        if (
          current.mediaType === record.mediaType &&
          current.bytes === record.bytes &&
          current.sha256.toLowerCase() === record.sha256.toLowerCase() &&
          samePhotoLink(current.pointPhoto, record.pointPhoto)
        )
          return false;
        throw new Error(
          "Já existe um original com o mesmo blobId e metadados conflitantes.",
        );
      }
      // The quota check shares this transaction with add(), preventing two
      // tabs from racing past the per-point and per-workspace photo limits.
      if (record.pointPhoto) {
        const existing = await read<StoredOriginal[]>(
          tx.store("originals").index("workspace").getAll(workspaceId),
        );
        const photoRecords = existing.filter((row) => isPhotoMediaType(row.mediaType));
        const samePointCount = photoRecords.filter((row) =>
          samePhotoLink(row.pointPhoto, record.pointPhoto)).length;
        if (samePointCount >= MAX_POINT_PHOTOS)
          throw new Error("Quantidade máxima de fotos deste ponto atingida.");
        if (photoRecords.reduce((sum, row) => sum + row.bytes, 0) +
            record.bytes > MAX_WORKSPACE_POINT_PHOTO_BYTES)
          throw new Error("Limite de fotos do workspace atingido para backup parcial.");
      }
      tx.store("originals").add(record);
      return true;
    });
    if (added && (input.mediaType === "application/pdf" || input.mediaType === "image/tiff"))
      notifyImportCatalogChanged({ kind: "original", id: input.blobId, action: "saved" });
  }

  /** Rename only a PDF/GeoTIFF label. The binary, hash and project links are immutable. */
  async renameImportedOriginal(blobId: string, rawName: string, expectedName?: string, expectedCreatedAt?: string): Promise<string> {
    const workspaceId = await this.workspaceId();
    const name = await this.db.transact(["originals"], "readwrite", async (tx) => {
      const store = tx.store("originals");
      const key = originalKey(workspaceId, blobId);
      const original = await read<StoredOriginal | undefined>(store.get(key));
      if (!original || (original.mediaType !== "application/pdf" && original.mediaType !== "image/tiff"))
        throw new Error("PDF ou GeoTIFF não encontrado neste workspace.");
      if ((expectedName !== undefined && (original.originalName ?? "") !== expectedName) ||
          (expectedCreatedAt !== undefined && original.createdAt !== expectedCreatedAt))
        throw new Error("O arquivo mudou em outra aba. Atualize a lista antes de renomear.");
      const normalized = normalizeImportedOriginalName(rawName, original.mediaType, original.originalName);
      if (normalized !== original.originalName) store.put({ ...original, originalName: normalized });
      return normalized;
    });
    notifyImportCatalogChanged({ kind: "original", id: blobId, action: "renamed" });
    return name;
  }

  /** Remove the owned local binary and legacy PDF calibration keys in one IndexedDB transaction.
   * A project using this PDF loses its raster link, but no project, feature or photo is deleted. */
  async deleteImportedOriginal(
    blobId: string,
    expected?: Pick<OriginalRecord, "sha256" | "originalName" | "projectGeoPdfIds" | "createdAt">,
  ): Promise<boolean> {
    const workspaceId = await this.workspaceId();
    const removed = await this.db.transact(["originals", "meta"], "readwrite", async (tx) => {
      const store = tx.store("originals");
      const key = originalKey(workspaceId, blobId);
      const original = await read<StoredOriginal | undefined>(store.get(key));
      if (!original) return false;
      if (original.mediaType !== "application/pdf" && original.mediaType !== "image/tiff")
        throw new Error("Exclusão de outros tipos de original não autorizada.");
      if (expected) {
        const originalLinks = [...(original.projectGeoPdfIds ?? [])].sort();
        const expectedLinks = [...(expected.projectGeoPdfIds ?? [])].sort();
        if (original.sha256 !== expected.sha256 || original.createdAt !== expected.createdAt ||
            (original.originalName ?? "") !== (expected.originalName ?? "") ||
            JSON.stringify(originalLinks) !== JSON.stringify(expectedLinks))
          throw new Error("Este arquivo mudou em outra aba ou foi associado a outro projeto. Atualize antes de excluir.");
      }
      store.delete(key);
      if (original.mediaType === "application/pdf") {
        const meta = tx.store("meta");
        meta.delete(`pdfGeoref:${blobId}`);
        meta.delete(`pdfGeorefSource:${blobId}`);
      }
      return true;
    });
    if (removed) notifyImportCatalogChanged({ kind: "original", id: blobId, action: "deleted" });
    return removed;
  }

  async getOriginal(
    blobId: string,
    workspaceId?: string,
  ): Promise<OriginalRecord | null> {
    workspaceId ??= await this.workspaceId();
    const record = await this.db.transact(["originals"], "readonly", (tx) =>
      read<StoredOriginal | undefined>(
        tx.store("originals").get(originalKey(workspaceId as string, blobId)),
      ),
    );
    return record ? restoreOriginal(record) : null;
  }

  async listOriginals(workspaceId?: string): Promise<OriginalRecord[]> {
    workspaceId ??= await this.workspaceId();
    const records = await this.db.transact(["originals"], "readonly", (tx) =>
      read<StoredOriginal[]>(
        tx.store("originals").index("workspace").getAll(workspaceId),
      ),
    );
    return records.map(restoreOriginal);
  }

  /**
   * Read only point photos. A corrupt or very large unrelated GeoPDF/GeoTIFF
   * must not prevent the user from exporting all surviving field photos.
   * Malformed photo links still fail closed rather than being silently omitted.
   */
  async listPointPhotoOriginals(): Promise<OriginalRecord[]> {
    const workspaceId = await this.workspaceId();
    const originals = await this.db.transact(["originals"], "readonly", (tx) =>
      read<StoredOriginal[]>(tx.store("originals").index("workspace").getAll(workspaceId)),
    );
    const mismatched = originals.some((record) =>
      record.pointPhoto !== undefined && !isPhotoMediaType(record.mediaType),
    );
    if (mismatched) throw new Error("Arquivo vinculado a ponto com tipo inválido; backup de fotos cancelado.");
    return originals.filter((record) => isPhotoMediaType(record.mediaType))
      .map(restoreOriginal);
  }

  /**
   * Read only PDF originals for map selection. Corrupt unrelated GeoTIFFs or
   * photos must not prevent opening a georeferenced project PDF.
   */
  async listGeoPdfOriginals(): Promise<OriginalRecord[]> {
    const workspaceId = await this.workspaceId();
    const rows = await this.db.transact(["originals"], "readonly", (tx) =>
      read<StoredOriginal[]>(tx.store("originals").index("workspace").getAll(workspaceId)),
    );
    return rows.filter((record) => record.mediaType === "application/pdf")
      .map(restoreOriginal);
  }

  /** Link project overlays in the PDF original metadata so encrypted backups
   * restore the association and original binary without relying on meta keys. */
  async getProjectGeoPdf(projectId: string): Promise<OriginalRecord | null> {
    return assignedProjectGeoPdf(await this.listGeoPdfOriginals(), projectId);
  }

  async assignProjectGeoPdf(projectId: string, blobId: string | null): Promise<void> {
    const workspaceId = await this.workspaceId();
    const changedIds = await this.db.transact(["entities", "originals"], "readwrite", async (tx) => {
      const project = await read<EntityRecord | undefined>(
        tx.store("entities").get(entityKey(workspaceId, "project", projectId)),
      );
      if (!project || project.deleted || project.payload?.entity !== "project")
        throw new Error("Projeto local não encontrado neste workspace.");
      const originals = tx.store("originals");
      const rows = await read<StoredOriginal[]>(originals.index("workspace").getAll(workspaceId));
      const updated = reassignProjectGeoPdf(rows, projectId, blobId);
      const changed: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        if (updated[i] !== rows[i]) {
          originals.put(updated[i]!);
          changed.push(rows[i]!.blobId);
        }
      }
      return changed;
    });
    for (const id of changedIds)
      notifyImportCatalogChanged({ kind: "original", id, action: "updated" });
  }

  async saveGeoPdfReference(blobId: string, reference: GeoReference): Promise<void> {
    const parsed = geoReferenceSchema.parse(reference);
    const workspaceId = await this.workspaceId();
    await this.db.transact(["originals"], "readwrite", async (tx) => {
      const store = tx.store("originals");
      const record = await read<StoredOriginal | undefined>(store.get(originalKey(workspaceId, blobId)));
      if (!record || record.mediaType !== "application/pdf")
        throw new Error("GeoPDF original não encontrado.");
      store.put({ ...record, geoPdfReference: parsed });
    });
    notifyImportCatalogChanged({ kind: "original", id: blobId, action: "updated" });
  }

  /**
   * Restore all point photos in ONE IndexedDB readwrite transaction.
   * The archive must have been decrypted/validated before entry; do not
   * partially import on corrupt links, collisions or storage limits.
   */
  async restorePointPhotosAtomically(
    sourceWorkspaceId: string,
    photos: Array<Pick<OriginalRecord, "blobId" | "blob" | "mediaType" | "bytes" |
      "sha256" | "originalName" | "createdAt" | "pointPhoto">>,
  ): Promise<{ added: number; unchanged: number; orphaned: number }> {
    const workspaceId = await this.workspaceId();
    if (sourceWorkspaceId !== workspaceId)
      throw new Error("Workspace do backup diferente. Restaure primeiro os projetos correspondentes.");
    if (!Array.isArray(photos) || photos.length > 10_000)
      throw new Error("Lista de fotos inválida ou excessiva.");
    const seen = new Set<string>();
    const prepared = await Promise.all(photos.map(async (photo) => {
      if (!photo || typeof photo.blobId !== "string" || !photo.blobId.trim() ||
          photo.blobId.length > 128 || seen.has(photo.blobId) ||
          !(photo.blob instanceof Blob) || photo.blob.size !== photo.bytes ||
          !isPhotoMediaType(photo.mediaType) || !validPointPhotoLink(photo.pointPhoto) ||
          typeof photo.createdAt !== "string" || Number.isNaN(Date.parse(photo.createdAt)))
        throw new Error("Foto inválida ou duplicada no backup.");
      seen.add(photo.blobId);
      validatePhotoOriginalMetadata(photo);
      const bytes = await readBlobBytes(photo.blob);
      validatePhotoBytes(photo.mediaType, new Uint8Array(bytes));
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))]
        .map((byte) => byte.toString(16).padStart(2, "0")).join("");
      if (hash !== photo.sha256.toLowerCase()) throw new Error("Foto com hash inconsistente.");
      return {
        key: originalKey(workspaceId, photo.blobId), workspaceId,
        blobId: photo.blobId, mediaType: photo.mediaType, bytes: photo.bytes,
        sha256: hash, ...(photo.originalName === undefined ? {} : { originalName: photo.originalName }),
        createdAt: photo.createdAt, pointPhoto: photo.pointPhoto!, originalBytes: bytes,
      } satisfies StoredOriginal;
    }));
    return this.db.transact(["originals", "entities"], "readwrite", async (tx) => {
      const store = tx.store("originals");
      const existing = await read<StoredOriginal[]>(store.index("workspace").getAll(workspaceId));
      const byId = new Map(existing.map((record) => [record.blobId, record]));
      const added: typeof prepared = [];
      let unchanged = 0;
      for (const row of prepared) {
        const current = byId.get(row.blobId);
        if (current) {
          if (!isPhotoMediaType(current.mediaType) ||
              current.sha256.toLowerCase() !== row.sha256 ||
              current.bytes !== row.bytes || !samePhotoLink(current.pointPhoto, row.pointPhoto) ||
              current.mediaType !== row.mediaType)
            throw new Error("Foto local com o mesmo ID e conteúdo diferente. Restauração cancelada.");
          // Metadata alone is not proof that bytes remain intact on device.
          // Compare the immutable local binary synchronously *inside* the
          // IndexedDB transaction; do not await crypto here (WebKit auto-commits).
          const stored = current.originalBytes;
          const incoming = row.originalBytes;
          if (!(stored instanceof ArrayBuffer) || !(incoming instanceof ArrayBuffer)) {
            throw new Error("Foto existente sem bytes verificáveis; restauração cancelada para evitar perda.");
          }
          const left = new Uint8Array(stored);
          const right = new Uint8Array(incoming);
          if (left.byteLength !== right.byteLength || left.some((byte, i) => byte !== right[i])) {
            throw new Error("Foto existente com bytes diferentes dos metadados; restauração cancelada.");
          }
          unchanged++;
        } else added.push(row);
      }
      const photoRows = existing.filter((record) => isPhotoMediaType(record.mediaType));
      if (photoRows.reduce((sum, item) => sum + item.bytes, 0) +
          added.reduce((sum, item) => sum + item.bytes, 0) > MAX_WORKSPACE_POINT_PHOTO_BYTES)
        throw new Error("Fotos excedem o limite de armazenamento local do workspace.");
      const counts = new Map<string, number>();
      for (const row of [...photoRows, ...added]) {
        const link = row.pointPhoto;
        if (!link || !validPointPhotoLink(link)) throw new Error("Foto local sem vínculo válido.");
        const key = `${link.projectId}:${link.layerId}:${link.featureId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (counts.get(key)! > MAX_POINT_PHOTOS)
          throw new Error("Quantidade máxima de fotos por ponto excedida.");
      }
      // Schedule all reads before any writes so WebKit keeps the transaction live.
      const links = await Promise.all(added.map(async (row) => {
        const link = row.pointPhoto!;
        const [feature, layer] = await Promise.all([
          read<EntityRecord | undefined>(tx.store("entities").get(entityKey(workspaceId, "feature", link.featureId))),
          read<EntityRecord | undefined>(tx.store("entities").get(entityKey(workspaceId, "layer", link.layerId))),
        ]);
        return { link, feature, layer };
      }));
      let orphaned = 0;
      for (const { link, feature, layer } of links) {
        // Deleted/missing points must not cause loss of previously archived
        // photos. Keep them in the same workspace as unlinked originals until
        // their project/feature is restored, never reassign to a different ID.
        if (!feature || feature.deleted || !layer || layer.deleted) {
          orphaned++;
          continue;
        }
        if (feature.payload?.entity !== "feature" ||
            feature.payload.data.layerId !== link.layerId ||
            layer.payload?.entity !== "layer" ||
            layer.payload.data.projectId !== link.projectId)
          throw new Error("Foto vinculada a projeto/camada diferente. Restauração cancelada.");
      }
      for (const row of added) store.add(row);
      return { added: added.length, unchanged, orphaned };
    });
  }

  /** Only delete a photo after verifying its workspace and exact point association. */
  async deletePointPhoto(
    blobId: string,
    link: { projectId: string; layerId: string; featureId: string },
  ): Promise<void> {
    if (!validPointPhotoLink(link)) throw new Error("Referência de ponto inválida.");
    const workspaceId = await this.workspaceId();
    await this.db.transact(["originals"], "readwrite", async (tx) => {
      const key = originalKey(workspaceId, blobId);
      const record = await read<StoredOriginal | undefined>(tx.store("originals").get(key));
      if (!record || !isPhotoMediaType(record.mediaType) ||
          !samePhotoLink(record.pointPhoto, link))
        throw new Error("Foto não pertence ao ponto deste workspace.");
      tx.store("originals").delete(key);
    });
  }

  async saveConflict(conflict: SyncConflict): Promise<void> {
    const workspaceId = await this.workspaceId();
    const parsed = syncConflictSchema.parse(conflict);
    const record: ConflictRecord = {
      ...parsed,
      workspaceId,
      createdAt: now(),
      key: `${workspaceId}:${parsed.operationId}`,
    };
    // A push reply can arrive after another tab ACKed or resolved this
    // operation. Conflict persistence must share the outbox/ACK transaction
    // boundary with those decisions: never resurrect a resolved operation.
    await this.db.transact(["conflicts", "outbox", "acks"], "readwrite", async (tx) => {
      const pending = await read<OutboxRecord | undefined>(
        tx.store("outbox").get(parsed.operationId),
      );
      if (!pending || pending.workspaceId !== workspaceId) return;
      const ack = await read<{ key: string } | undefined>(
        tx.store("acks").get(parsed.operationId),
      );
      if (ack) return;
      if (
        pending.entity !== parsed.entity ||
        pending.entityId !== parsed.entityId ||
        pending.baseVersion !== parsed.baseVersion
      )
        throw new Error("Conflict receipt does not match pending operation.");

      const store = tx.store("conflicts");
      // An in-flight push may report an older server state after another tab
      // has applied a newer pull. Never downgrade the durable resolution target.
      const previous = await read<ConflictRecord | undefined>(store.get(record.key));
      if (previous && previous.serverVersion >= record.serverVersion) return;
      store.put(record);
    });
  }

  async listConflicts(workspaceId?: string): Promise<SyncConflict[]> {
    workspaceId ??= await this.workspaceId();
    return this.db.transact(["conflicts"], "readonly", (tx) =>
      read<ConflictRecord[]>(
        tx.store("conflicts").index("workspace").getAll(workspaceId),
      ).then((rows) =>
        rows.map(
          ({ key: _key, workspaceId: _workspaceId, createdAt: _createdAt, ...conflict }) =>
            conflict,
        ),
      ),
    );
  }
}

export const localRepository = new LocalRepository();
export type {
  EntityRecord,
  OriginalRecord,
  OutboxRecord,
  ConflictRecord,
} from "../local-db";
