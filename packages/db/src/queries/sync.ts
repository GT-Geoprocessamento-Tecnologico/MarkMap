import {
  assertGeometryCompatible,
  geometryTypeSchema,
  type ImportMetadata,
  type ServerChange,
  type SyncConflict,
  type SyncEntityPayload,
  type SyncOperation,
  type Tombstone,
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

const materializeAcceptedOperation = async (
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  input: SyncOperation,
  workspaceId: string,
  version: number,
): Promise<void> => {
  if (input.operation === "delete") {
    if (input.entity === "project") {
      await tx.execute(sql`
        UPDATE projects
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${input.entityId}::uuid AND workspace_id = ${workspaceId}::uuid
      `);
      return;
    }
    if (input.entity === "layer") {
      await tx.execute(sql`
        UPDATE layers
        SET deleted_at = now(), updated_at = now()
        WHERE id = ${input.entityId}::uuid AND workspace_id = ${workspaceId}::uuid
      `);
      return;
    }
    if (input.entity === "feature") {
      await tx.execute(sql`
        UPDATE features
        SET deleted_at = now(), updated_at = now(), version = ${version}
        WHERE id = ${input.entityId}::uuid AND workspace_id = ${workspaceId}::uuid
      `);
      return;
    }
    if (input.entity === "map") {
      await tx.execute(sql`
        DELETE FROM maps
        WHERE id = ${input.entityId}::uuid AND workspace_id = ${workspaceId}::uuid
      `);
      return;
    }
    if (input.entity === "import") {
      await tx.execute(sql`
        DELETE FROM imports
        WHERE id = ${input.entityId}::uuid AND workspace_id = ${workspaceId}::uuid
      `);
    }
    return;
  }

  const payload = input.payload;
  if (payload.entity === "project") {
    const data = payload.data;
    const rows = await tx.execute(sql`
      INSERT INTO projects (
        id, workspace_id, name, description, status, created_at, updated_at, deleted_at
      ) VALUES (
        ${data.id}::uuid,
        ${workspaceId}::uuid,
        ${data.name},
        ${data.description ?? null},
        ${data.status},
        ${data.createdAt}::timestamptz,
        ${data.updatedAt}::timestamptz,
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
      WHERE projects.workspace_id = EXCLUDED.workspace_id
      RETURNING id
    `);
    if (!rows[0]) throw new Error("project materialization scope mismatch");
    return;
  }

  if (payload.entity === "map") {
    const data = payload.data;
    const rows = await tx.execute(sql`
      INSERT INTO maps (
        id, workspace_id, project_id, name, description,
        default_center_lng, default_center_lat, default_zoom,
        created_at, updated_at
      ) VALUES (
        ${data.id}::uuid,
        ${workspaceId}::uuid,
        ${data.projectId}::uuid,
        ${data.name},
        ${data.description},
        ${data.defaultCenterLng},
        ${data.defaultCenterLat},
        ${data.defaultZoom},
        ${data.createdAt}::timestamptz,
        ${data.updatedAt}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        default_center_lng = EXCLUDED.default_center_lng,
        default_center_lat = EXCLUDED.default_center_lat,
        default_zoom = EXCLUDED.default_zoom,
        updated_at = EXCLUDED.updated_at
      WHERE maps.workspace_id = EXCLUDED.workspace_id
      RETURNING id
    `);
    if (!rows[0]) throw new Error("map materialization scope mismatch");
    return;
  }

  if (payload.entity === "layer") {
    const data = payload.data;
    const rows = await tx.execute(sql`
      INSERT INTO layers (
        id, workspace_id, project_id, name, description, kind, geometry_type,
        srid, style, metadata, visible_by_default, sort_order,
        created_at, updated_at, deleted_at
      ) VALUES (
        ${data.id}::uuid,
        ${workspaceId}::uuid,
        ${data.projectId}::uuid,
        ${data.name},
        ${data.description},
        ${data.kind},
        ${data.geometryType},
        ${data.srid},
        ${JSON.stringify(data.style)}::jsonb,
        ${JSON.stringify(data.metadata)}::jsonb,
        ${data.visibleByDefault},
        ${data.sortOrder},
        ${data.createdAt}::timestamptz,
        ${data.updatedAt}::timestamptz,
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        kind = EXCLUDED.kind,
        geometry_type = EXCLUDED.geometry_type,
        srid = EXCLUDED.srid,
        style = EXCLUDED.style,
        metadata = EXCLUDED.metadata,
        visible_by_default = EXCLUDED.visible_by_default,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
      WHERE layers.workspace_id = EXCLUDED.workspace_id
      RETURNING id
    `);
    if (!rows[0]) throw new Error("layer materialization scope mismatch");
    return;
  }

  if (payload.entity === "feature") {
    const data = payload.data;
    const layerRows = await tx.execute(sql`
      SELECT geometry_type
      FROM layers
      WHERE id = ${data.layerId}::uuid
        AND workspace_id = ${workspaceId}::uuid
        AND deleted_at IS NULL
      LIMIT 1
    `);
    const layer = layerRows[0] as { geometry_type?: string | null } | undefined;
    if (!layer) throw new Error("feature materialization layer not found");
    const geometryType =
      layer.geometry_type === null || layer.geometry_type === undefined
        ? null
        : geometryTypeSchema.parse(layer.geometry_type);
    assertGeometryCompatible(data.geometry, geometryType);

    const probeRows = await tx.execute(sql`
      SELECT ST_IsEmpty(g) AS empty, ST_IsValid(g) AS valid
      FROM (
        SELECT ST_SetSRID(
          ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)}),
          4326
        ) AS g
      ) AS probe
    `);
    const probe = probeRows[0] as { empty?: boolean; valid?: boolean } | undefined;
    if (!probe || probe.empty === true || probe.valid !== true)
      throw new Error("feature materialization geometry is invalid");

    const rows = await tx.execute(sql`
      INSERT INTO features (
        id, workspace_id, layer_id, geometry, properties, version,
        created_at, updated_at, deleted_at
      ) VALUES (
        ${data.id}::uuid,
        ${workspaceId}::uuid,
        ${data.layerId}::uuid,
        ST_Transform(
          ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(data.geometry)}), 4326),
          4674
        ),
        ${JSON.stringify(data.properties)}::jsonb,
        ${version},
        ${data.createdAt}::timestamptz,
        ${data.updatedAt}::timestamptz,
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        layer_id = EXCLUDED.layer_id,
        geometry = EXCLUDED.geometry,
        properties = EXCLUDED.properties,
        version = EXCLUDED.version,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
      WHERE features.workspace_id = EXCLUDED.workspace_id
      RETURNING id
    `);
    if (!rows[0]) throw new Error("feature materialization scope mismatch");
    return;
  }

  if (payload.entity === "import") {
    const data = payload.data;
    const status =
      data.state === "ready"
        ? "completed"
        : data.state === "needs-calibration"
          ? "processing"
          : data.state;
    const completed = data.state === "ready" || data.state === "failed";
    const rows = await tx.execute(sql`
      INSERT INTO imports (
        id, workspace_id, project_id, target_layer_id, original_name, format,
        status, row_count, error_code, error_message, created_at, completed_at
      ) VALUES (
        ${data.id}::uuid,
        ${workspaceId}::uuid,
        ${data.projectId}::uuid,
        NULL,
        ${data.originalName},
        ${data.format},
        ${status},
        NULL,
        ${data.errorCode},
        NULL,
        now(),
        ${completed ? new Date().toISOString() : null}::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id,
        original_name = EXCLUDED.original_name,
        format = EXCLUDED.format,
        status = EXCLUDED.status,
        error_code = EXCLUDED.error_code,
        completed_at = EXCLUDED.completed_at
      WHERE imports.workspace_id = EXCLUDED.workspace_id
      RETURNING id
    `);
    if (!rows[0]) throw new Error("import materialization scope mismatch");
  }
};

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

    await materializeAcceptedOperation(
      tx,
      input,
      capabilityWorkspaceId,
      version,
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
