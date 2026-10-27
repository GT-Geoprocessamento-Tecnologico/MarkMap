import type { SyncOperation } from "@markmap/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { Env } from "../src/env.js";

// Isolate Hono's request/response contract; do not connect to Neon here.
const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  findWorkspaceByCapabilityHash: vi.fn(),
  applyPushOperations: vi.fn(),
  applyPushOperation: vi.fn(),
}));

vi.mock("@markmap/db", async () => ({
  ...(await vi.importActual<typeof import("@markmap/db")>("@markmap/db")),
  ...dbMocks,
}));

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ENTITY_ID = "22222222-2222-4222-8222-222222222222";
const BEARER = "a".repeat(42) + "U";
const AUTHORIZATION = "Bearer " + BEARER;
const CREATED_AT = "2026-01-01T00:00:00.000Z";

const env: Env = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  CORS_ORIGINS: "https://appmarkmap.mtsferreira.dev",
  LOG_LEVEL: "error",
  corsOrigins: ["https://appmarkmap.mtsferreira.dev"],
  hasDatabase: false,
};

const operationId = (index: number): string =>
  "00000000-0000-4000-8000-" + String(index).padStart(12, "0");

const deletion = (
  index: number,
  predecessorOperationId?: string,
): SyncOperation => ({
  operationId: operationId(index),
  workspaceId: WORKSPACE_ID,
  entity: "project",
  entityId: ENTITY_ID,
  operation: "delete",
  baseVersion: null,
  createdAt: CREATED_AT,
  ...(predecessorOperationId !== undefined ? { predecessorOperationId } : {}),
});

const postBatch = async (
  operations: SyncOperation[],
  authorization?: string,
): Promise<Response> =>
  createApp(env).request("/api/v1/sync/push", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization !== undefined ? { authorization } : {}),
    },
    body: JSON.stringify({ operations }),
  });

describe("Hono sync push contract (no production database)", () => {
  beforeEach(() => {
    dbMocks.getDb.mockReset().mockReturnValue({});
    dbMocks.findWorkspaceByCapabilityHash.mockReset().mockResolvedValue({
      workspaceId: WORKSPACE_ID,
      capabilityHash: "f".repeat(64),
      generation: "1",
    });
    dbMocks.applyPushOperations.mockReset();
    dbMocks.applyPushOperation.mockReset();
  });

  it("rejects a missing bearer before any persistence", async () => {
    const response = await postBatch([deletion(1)]);

    expect(response.status).toBe(401);
    expect(dbMocks.findWorkspaceByCapabilityHash).not.toHaveBeenCalled();
    expect(dbMocks.getDb).not.toHaveBeenCalled();
    expect(dbMocks.applyPushOperations).not.toHaveBeenCalled();
    expect(dbMocks.applyPushOperation).not.toHaveBeenCalled();
  });

  it("rejects a revoked capability before applying the batch", async () => {
    dbMocks.findWorkspaceByCapabilityHash.mockResolvedValue(null);

    const response = await postBatch([deletion(1)], AUTHORIZATION);

    expect(response.status).toBe(401);
    // The capability lookup reads the DB handle but must never write data.
    expect(dbMocks.getDb).toHaveBeenCalledTimes(1);
    expect(dbMocks.applyPushOperations).not.toHaveBeenCalled();
    expect(dbMocks.applyPushOperation).not.toHaveBeenCalled();
  });

  it("rejects duplicate IDs in the request before the first DB transaction", async () => {
    const original = deletion(1);
    const response = await postBatch([original, original], AUTHORIZATION);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(dbMocks.applyPushOperations).not.toHaveBeenCalled();
    expect(dbMocks.applyPushOperation).not.toHaveBeenCalled();
    expect(dbMocks.getDb).toHaveBeenCalledTimes(1);
  });

  it("rejects a batch of 501 operations without writing anything", async () => {
    const operations = Array.from({ length: 501 }, (_, index) =>
      deletion(index + 1),
    );
    const response = await postBatch(operations, AUTHORIZATION);

    expect(response.status).toBe(400);
    expect(dbMocks.applyPushOperations).not.toHaveBeenCalled();
    expect(dbMocks.applyPushOperation).not.toHaveBeenCalled();
  });

  it("separates accepted, replayed, and conflicting receipts per operation", async () => {
    const first = deletion(1);
    const replay = deletion(2, first.operationId);
    const conflict = deletion(3);
    dbMocks.applyPushOperations.mockResolvedValueOnce([
      { status: "accepted", version: 1, sequence: "1" },
      {
        status: "already_applied",
        version: 2,
        sequence: "2",
      },
      {
        status: "conflict",
        conflict: {
          operationId: conflict.operationId,
          entity: conflict.entity,
          entityId: conflict.entityId,
          baseVersion: conflict.baseVersion,
          serverVersion: 0,
          reason: "SCOPE_REJECTED",
        },
      },
    ]);

    const response = await postBatch([first, replay, conflict], AUTHORIZATION);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accepted: [{ operationId: first.operationId, version: 1, sequence: "1" }],
      alreadyApplied: [
        {
          operationId: replay.operationId,
          predecessorOperationId: first.operationId,
          version: 2,
          sequence: "2",
        },
      ],
      conflicts: [
        {
          operationId: conflict.operationId,
          entity: conflict.entity,
          entityId: conflict.entityId,
          baseVersion: conflict.baseVersion,
          serverVersion: 0,
          reason: "SCOPE_REJECTED",
        },
      ],
    });
    expect(dbMocks.applyPushOperations).toHaveBeenCalledTimes(1);
    expect(dbMocks.applyPushOperations).toHaveBeenCalledWith(
      expect.anything(),
      [first, replay, conflict],
      WORKSPACE_ID,
    );
  });

  it("replays a batch after a simulated database failure", async () => {
    const first = deletion(1);
    const second = deletion(2);
    let failOnce = true;

    dbMocks.applyPushOperations.mockImplementation(
      async (_db, _operations: SyncOperation[], _workspaceId: string) => {
        if (failOnce) {
          failOnce = false;
          throw new Error("simulated database failure");
        }
        return [
          { status: "already_applied", version: 1, sequence: "1" },
          { status: "accepted", version: 2, sequence: "2" },
        ];
      },
    );

    const failed = await postBatch([first, second], AUTHORIZATION);
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain("simulated database failure");

    // After a lost HTTP response the client must resend the same IDs; the
    // already-applied receipt is safe to ACK without duplicating a DB write.
    const retried = await postBatch([first, second], AUTHORIZATION);
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({
      accepted: [
        { operationId: second.operationId, version: 2, sequence: "2" },
      ],
      alreadyApplied: [
        { operationId: first.operationId, version: 1, sequence: "1" },
      ],
      conflicts: [],
    });
    expect(dbMocks.applyPushOperations).toHaveBeenCalledTimes(2);
  });
});
