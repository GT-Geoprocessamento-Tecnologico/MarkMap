import type { SyncOperation } from "@markmap/contracts";
import { describe, expect, it, vi } from "vitest";

import { applyPushOperations } from "../../src/queries/sync.js";

describe("sync push operation batching performance rationale & unit verification", () => {
  it("batches transactions so db.transaction is called exactly once for a batch", async () => {
    let transactionCount = 0;
    const fakeTx = {
      execute: vi.fn(async () => [{ id: "workspace-1", next_sequence: 1n }]),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(async () => []),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    };

    const mockDb = {
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        transactionCount++;
        return cb(fakeTx);
      }),
    } as unknown as Parameters<typeof applyPushOperations>[0];

    const operations: SyncOperation[] = Array.from({ length: 50 }, (_, i) => ({
      operationId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      workspaceId: "workspace-1",
      entity: "project",
      entityId: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
      operation: "upsert",
      baseVersion: null,
      createdAt: new Date().toISOString(),
      payload: {
        entity: "project",
        data: {
          id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
          name: `Project ${i + 1}`,
          description: undefined,
          status: "active" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    }));

    const results = await applyPushOperations(
      mockDb,
      operations,
      "workspace-1",
    );

    expect(results).toHaveLength(50);
    // Crucial performance verification: exactly 1 database transaction for 50 operations
    expect(transactionCount).toBe(1);
  });
});
