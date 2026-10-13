import {
  pullSyncResponseSchema,
  pushSyncRequestSchema,
  pushSyncResponseSchema,
  type PushSyncAck,
  type SyncConflict,
} from "@geonexo/contracts";
import { applyPushOperation, getDb, pullChanges } from "@geonexo/db";
import type { Hono } from "hono";
import { z } from "zod";

import { AppError, ErrorCode } from "../lib/errors.js";
import { createSyncCursor, readSyncCursor } from "../lib/sync-cursor.js";

const pullQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const syncRoutes = (app: Hono<any, any, any>) => {
  app.post("/sync/push", async (c) => {
    const workspaceId = c.get("capabilityWorkspaceId") as string;
    const input = pushSyncRequestSchema.parse(await c.req.json());
    // Reject an ambiguous batch before the first DB transaction commits.
    // Replays across separate requests remain idempotent in applyPushOperation.
    const seenOperationIds = new Set<string>();
    for (const operation of input.operations) {
      if (seenOperationIds.has(operation.operationId))
        throw new AppError("Duplicate operation ID in sync batch", {
          status: 400,
          code: ErrorCode.VALIDATION_ERROR,
        });
      seenOperationIds.add(operation.operationId);
    }
    const accepted: PushSyncAck[] = [];
    const conflicts: SyncConflict[] = [];
    const alreadyApplied: PushSyncAck[] = [];

    for (const operation of input.operations) {
      const result = await applyPushOperation(getDb(), operation, workspaceId);
      if (result.status === "conflict") {
        if (result.conflict) conflicts.push(result.conflict);
        continue;
      }
      if (result.version === undefined || result.sequence === undefined)
        continue;
      const ack = {
        operationId: operation.operationId,
        version: result.version,
        sequence: result.sequence,
        ...(operation.predecessorOperationId !== undefined
          ? { predecessorOperationId: operation.predecessorOperationId }
          : {}),
      };
      if (result.status === "accepted") accepted.push(ack);
      else alreadyApplied.push(ack);
    }

    return c.json(
      pushSyncResponseSchema.parse({ accepted, conflicts, alreadyApplied }),
    );
  });

  app.get("/sync/pull", async (c) => {
    const workspaceId = c.get("capabilityWorkspaceId") as string;
    const capabilityHash = c.get("capabilityHash") as string;
    const query = pullQuerySchema.parse(c.req.query());
    const afterSequence =
      query.cursor !== undefined && query.cursor !== ""
        ? readSyncCursor(query.cursor, workspaceId, capabilityHash).sequence
        : "0";
    const page = await pullChanges(
      getDb(),
      { workspaceId, afterSequence, limit: query.limit },
      workspaceId,
    );
    return c.json(
      pullSyncResponseSchema.parse({
        changes: page.changes,
        tombstones: page.tombstones,
        nextCursor: createSyncCursor(
          workspaceId,
          page.lastSequence,
          capabilityHash,
        ),
        hasMore: page.hasMore,
      }),
    );
  });
};
