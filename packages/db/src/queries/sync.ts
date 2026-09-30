import type {
  ImportMetadata,
  ServerChange,
  SyncConflict,
  SyncEntityPayload,
  SyncOperation,
  Tombstone,
} from "@geonexo/contracts";
import { and, asc, eq, gt, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import {
  syncEntities,
  syncOperations,
  syncTombstones,
  uploadSessions,
} from "../schema/sync.js";

const asObject = (value: unknown): Record<string, unknown> =>
  value as Record<string, unknown>;
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const conflictFor = (
  input: SyncOperation,
  currentVersion: number,
  serverPayload?: SyncEntityPayload,
): SyncConflict => ({
  operationId: input.operationId,
  entity: input.entity,
  entityId: input.entityId,
  baseVersion: input.baseVersion,
  serverVersion: currentVersion,
  ...(input.operation === "upsert" ? { localPayload: input.payload } : {}),
  ...(serverPayload ? { serverPayload } : {}),
  reason: "VERSION_CONFLICT",
});

export async function applyPushOperation(
  db: Db,
  input: SyncOperation,
  capabilityWorkspaceId: string,
): Promise<{
  status: "accepted" | "already_applied" | "conflict";
  version?: number;
  sequence?: string;
  conflict?: SyncConflict;
}> {
  if (input.workspaceId !== capabilityWorkspaceId)
    return {
      status: "conflict",
      conflict: {
        operationId: input.operationId,
        entity: input.entity,
        entityId: input.entityId,
        baseVersion: input.baseVersion,
        serverVersion: 0,
        reason: "SCOPE_REJECTED",
      },
    };
  return db.transaction(async (tx) => {
    const [workspace] = await tx.execute(
      sql`SELECT id FROM workspaces WHERE id = ${capabilityWorkspaceId} AND revoked = false FOR UPDATE`,
    );
    if (!workspace)
      return {
        status: "conflict",
        conflict: {
          operationId: input.operationId,
          entity: input.entity,
          entityId: input.entityId,
          baseVersion: input.baseVersion,
          serverVersion: 0,
          reason: "SCOPE_REJECTED",
        },
      };

    const [previous] = await tx
      .select({
        version: syncOperations.version,
        sequence: syncOperations.sequence,
        envelope: syncOperations.envelope,
      })
      .from(syncOperations)
      .where(
        and(
          eq(syncOperations.workspaceId, capabilityWorkspaceId),
          eq(syncOperations.operationId, input.operationId),
        ),
      )
      .limit(1);
    if (previous) {
      if (canonicalJson(previous.envelope) !== canonicalJson(input))
        return {
          status: "conflict",
          conflict: {
            operationId: input.operationId,
            entity: input.entity,
            entityId: input.entityId,
            baseVersion: input.baseVersion,
            serverVersion: 0,
            reason: "SCOPE_REJECTED",
          },
        };
      return {
        status: "already_applied",
        version: previous.version,
        sequence: String(previous.sequence),
      };
    }

    const [current] = await tx
      .select({ version: syncEntities.version, payload: syncEntities.payload })
      .from(syncEntities)
      .where(
        and(
          eq(syncEntities.workspaceId, capabilityWorkspaceId),
          eq(syncEntities.entity, input.entity),
          eq(syncEntities.entityId, input.entityId),
        ),
      )
      .limit(1);
    const currentVersion = current?.version ?? 0;
    const serverPayload = current?.payload
      ? (current.payload as SyncEntityPayload)
      : undefined;

    let expectedVersion = input.baseVersion;
    if (input.predecessorOperationId) {
      const [predecessor] = await tx
        .select({
          version: syncOperations.version,
          entity: syncOperations.entity,
          entityId: syncOperations.entityId,
        })
        .from(syncOperations)
        .where(
          and(
            eq(syncOperations.workspaceId, capabilityWorkspaceId),
            eq(syncOperations.operationId, input.predecessorOperationId),
          ),
        )
        .limit(1);
      if (
        !predecessor ||
        predecessor.entity !== input.entity ||
        predecessor.entityId !== input.entityId
      )
        return {
          status: "conflict",
          conflict: conflictFor(input, currentVersion, serverPayload),
        };
      expectedVersion = predecessor.version;
    }

    if (expectedVersion !== null && expectedVersion !== currentVersion)
      return {
        status: "conflict",
        conflict: conflictFor(input, currentVersion, serverPayload),
      };

    const version = currentVersion + 1;
    const [seqRow] = await tx.execute(
      sql`UPDATE workspaces SET next_sequence = next_sequence + 1, updated_at = now() WHERE id = ${capabilityWorkspaceId} RETURNING next_sequence`,
    );
    const sequence = String(
      (seqRow as { next_sequence: bigint }).next_sequence,
    );
    const deleted = input.operation === "delete";
    const payload = deleted ? null : asObject(input.payload);

    await tx
      .insert(syncEntities)
      .values({
        workspaceId: capabilityWorkspaceId,
        entity: input.entity,
        entityId: input.entityId,
        version,
        payload,
        deletedAt: deleted ? sql`now()` : null,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [
          syncEntities.workspaceId,
          syncEntities.entity,
          syncEntities.entityId,
        ],
        set: {
          version,
          payload,
          deletedAt: deleted ? sql`now()` : null,
          updatedAt: sql`now()`,
        },
      });

    await tx.insert(syncOperations).values({
      workspaceId: capabilityWorkspaceId,
      operationId: input.operationId,
      entity: input.entity,
      entityId: input.entityId,
      operation: input.operation,
      envelope: input,
      version,
      sequence: BigInt(sequence),
    });

    if (deleted)
      await tx
        .insert(syncTombstones)
        .values({
          workspaceId: capabilityWorkspaceId,
          entity: input.entity,
          entityId: input.entityId,
          version,
          sequence: BigInt(sequence),
          deletedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: [
            syncTombstones.workspaceId,
            syncTombstones.entity,
            syncTombstones.entityId,
          ],
          set: { version, sequence: BigInt(sequence), deletedAt: sql`now()` },
        });
    else
      await tx
        .delete(syncTombstones)
        .where(
          and(
            eq(syncTombstones.workspaceId, capabilityWorkspaceId),
            eq(syncTombstones.entity, input.entity),
            eq(syncTombstones.entityId, input.entityId),
          ),
        );

    return { status: "accepted", version, sequence };
  });
}

export async function pullChanges(
  db: Db,
  input: { workspaceId: string; afterSequence: string; limit: number },
  capabilityWorkspaceId: string,
): Promise<{
  changes: ServerChange[];
  tombstones: Tombstone[];
  lastSequence: string;
  hasMore: boolean;
}> {
  if (input.workspaceId !== capabilityWorkspaceId)
    throw new Error("workspace scope mismatch");
  const limit = Math.max(1, Math.min(500, input.limit));
  const rows = await db
    .select()
    .from(syncOperations)
    .where(
      and(
        eq(syncOperations.workspaceId, input.workspaceId),
        gt(syncOperations.sequence, BigInt(input.afterSequence)),
      ),
    )
    .orderBy(asc(syncOperations.sequence))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const changes: ServerChange[] = selected
    .filter((row) => row.operation === "upsert")
    .map((row) => {
      const envelope = row.envelope as SyncOperation;
      if (envelope.operation !== "upsert")
        throw new Error("Stored sync operation does not match its operation type");
      return {
        operationId: envelope.operationId,
        entity: envelope.entity,
        entityId: envelope.entityId,
        operation: "upsert" as const,
        payload: envelope.payload,
        version: row.version,
        sequence: String(row.sequence),
      };
    });
  const tombstones: Tombstone[] = selected
    .filter((row) => row.operation === "delete")
    .map((row) => ({
      entity: row.entity as Tombstone["entity"],
      entityId: row.entityId,
      version: row.version,
      sequence: String(row.sequence),
      deletedAt: row.createdAt.toISOString(),
    }));
  return {
    changes,
    tombstones,
    lastSequence: selected.length
      ? String(selected[selected.length - 1]!.sequence)
      : input.afterSequence,
    hasMore,
  };
}

export async function createUploadSession(
  db: Db,
  input: { workspaceId: string; metadata: ImportMetadata },
): Promise<{ blobId: string; uploadId: string }> {
  const blobId = input.metadata.source.id;
  const [row] = await db
    .insert(uploadSessions)
    .values({
      workspaceId: input.workspaceId,
      blobId,
      metadata: input.metadata,
    })
    .returning({ uploadId: uploadSessions.id, blob: uploadSessions.blobId });
  if (!row) throw new Error("upload session was not created");
  return { blobId: row.blob, uploadId: row.uploadId };
}
