import { describe, expect, it } from "vitest";
import type { SyncConflict } from "@geonexo/contracts";
import { MemoryLocalDb } from "../local-db/memory";
import { LocalRepository } from "./index";

const project = (id: string, name: string) => ({
  entity: "project" as const,
  data: { id, name, status: "active", createdAt: "2026-09-30T00:00:00.000Z", updatedAt: "2026-09-30T00:00:00.000Z" },
});
const id = "11111111-1111-4111-8111-111111111111";

describe("local-first repository", () => {
  it("commits entity and immutable outbox atomically", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    db.failNextTransaction = true;
    await expect(repo.mutate({ entity: "project", entityId: id, payload: project(id, "Falha"), operation: "upsert", baseVersion: null })).rejects.toThrow();
    expect(await repo.getEntity(await repo.workspaceId(), "project", id)).toBeUndefined();
    expect(await repo.listOutbox()).toEqual([]);
    const op = await repo.mutate({ entity: "project", entityId: id, payload: project(id, "Local"), operation: "upsert", baseVersion: null });
    expect((await repo.getEntity(await repo.workspaceId(), "project", id))?.payload).toEqual(project(id, "Local"));
    expect((await repo.listOutbox()).map((entry) => entry.operationId)).toEqual([op.operationId]);
  });

  it("keeps unsynced work across a new repository instance and has stable workspace id", async () => {
    const db = new MemoryLocalDb();
    const first = new LocalRepository(db);
    const workspaceId = await first.workspaceId();
    await first.mutate({ entity: "project", entityId: id, payload: project(id, "Reload"), operation: "upsert", baseVersion: null });
    const second = new LocalRepository(db);
    expect(await second.workspaceId()).toBe(workspaceId);
    expect((await second.listOutbox())).toHaveLength(1);
  });

  it("lists active entities by workspace and type in deterministic updated order", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const workspaceId = await repo.workspaceId();
    const olderId = "33333333-3333-4333-8333-333333333333";
    const newerId = "44444444-4444-4444-8444-444444444444";
    await repo.mutate({ entity: "project", entityId: olderId, payload: project(olderId, "Older"), operation: "upsert", baseVersion: null });
    await repo.mutate({ entity: "project", entityId: newerId, payload: project(newerId, "Newer"), operation: "upsert", baseVersion: null });
    await repo.mutate({ entity: "project", entityId: id, payload: project(id, "Deleted"), operation: "upsert", baseVersion: null });
    await repo.mutate({ entity: "project", entityId: id, operation: "delete", baseVersion: 0 });
    const older = await repo.getEntity(workspaceId, "project", olderId);
    const newer = await repo.getEntity(workspaceId, "project", newerId);
    await db.transact(["entities"], "readwrite", (tx) => {
      if (older) tx.store("entities").put({ ...older, updatedAt: "2026-09-30T00:00:00.000Z" });
      if (newer) tx.store("entities").put({ ...newer, updatedAt: "2026-09-30T00:00:01.000Z" });
      tx.store("entities").put({
        key: `${workspaceId}:map:other-workspace-map`, workspaceId, entity: "map", entityId: "other-workspace-map",
        version: 1, deleted: false, updatedAt: "9999-01-01T00:00:00.000Z",
      });
      tx.store("entities").put({
        key: "other-workspace:project:foreign", workspaceId: "other-workspace", entity: "project", entityId: "foreign",
        version: 1, deleted: false, payload: project("foreign", "Foreign"), updatedAt: "9999-01-01T00:00:00.000Z",
      });
    });

    const rows = await repo.listEntities("project", workspaceId);
    expect(rows.map((row) => row.entityId)).toEqual([newerId, olderId]);
    expect(rows.every((row) => row.workspaceId === workspaceId && row.entity === "project" && !row.deleted)).toBe(true);
  });

  it("does not let a stale acknowledgement overwrite a newer predecessor and handles duplicate ack", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const first = await repo.mutate({ entity: "project", entityId: id, payload: project(id, "Um"), operation: "upsert", baseVersion: null });
    const second = await repo.mutate({ entity: "project", entityId: id, payload: project(id, "Dois"), operation: "upsert", baseVersion: 0, predecessorOperationId: first.operationId });
    expect(await repo.acknowledge(first.operationId, 1, "1")).toBe(false);
    expect(await repo.acknowledge(second.operationId, 2, "2")).toBe(true);
    expect(await repo.acknowledge(second.operationId, 2, "2")).toBe(true);
    expect(await repo.acknowledge(second.operationId, 1, "1")).toBe(false);
    expect(await repo.acknowledge(second.operationId, 3, "1")).toBe(false);
    expect((await repo.listOutbox()).map((entry) => entry.operationId)).toEqual([first.operationId]);
    expect((await repo.getEntity(await repo.workspaceId(), "project", id))?.version).toBe(2);
  });

  it("preserves originals as exportable blobs and retains conflicts", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const blob = new Blob(["original pdf"], { type: "application/pdf" });
    const digest = await crypto.subtle.digest("SHA-256", await new Response(blob).arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    await repo.saveOriginal({ blobId: "blob-1", blob, mediaType: "application/pdf", bytes: blob.size, sha256 });
    await repo.saveOriginal({ blobId: "blob-1", blob, mediaType: "application/pdf", bytes: blob.size, sha256 });
    const different = new Blob(["different"], { type: "application/pdf" });
    const differentDigest = await crypto.subtle.digest("SHA-256", await new Response(different).arrayBuffer());
    const differentHash = [...new Uint8Array(differentDigest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    await expect(repo.saveOriginal({ blobId: "blob-1", blob: different, mediaType: "application/pdf", bytes: different.size, sha256: differentHash })).rejects.toThrow(/conflitantes/);
    const stored = await repo.getOriginal("blob-1");
    expect(stored?.blob).toBeInstanceOf(Blob);
    expect(stored?.mediaType).toBe("application/pdf");
    expect(stored?.bytes).toBe(blob.size);
    const conflict: SyncConflict = { operationId: "22222222-2222-4222-8222-222222222222", entity: "project", entityId: id, baseVersion: 0, serverVersion: 1, reason: "VERSION_CONFLICT", localPayload: project(id, "local"), serverPayload: project(id, "server") };
    await repo.saveConflict(conflict);
    expect(await repo.listConflicts()).toEqual([conflict]);
  });

  it("resolves a version conflict by rebasing the latest local state", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const operation = await repo.mutate({
      entity: "project",
      entityId: id,
      payload: project(id, "Minha versão"),
      operation: "upsert",
      baseVersion: null,
    });
    await repo.saveConflict({
      operationId: operation.operationId,
      entity: "project",
      entityId: id,
      baseVersion: null,
      serverVersion: 3,
      reason: "VERSION_CONFLICT",
      localPayload: project(id, "Minha versão"),
      serverPayload: project(id, "Servidor"),
    });

    await repo.resolveConflict(operation.operationId, "keep-local");

    expect(await repo.listConflicts()).toEqual([]);
    const outbox = await repo.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      entity: "project",
      entityId: id,
      operation: "upsert",
      baseVersion: 3,
      payload: project(id, "Minha versão"),
    });
    expect(outbox[0]?.operationId).not.toBe(operation.operationId);
    expect(
      (await repo.getEntity(await repo.workspaceId(), "project", id))?.version,
    ).toBe(3);
  });

  it("resolves a version conflict by accepting the server state", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const operation = await repo.mutate({
      entity: "project",
      entityId: id,
      payload: project(id, "Minha versão"),
      operation: "upsert",
      baseVersion: null,
    });
    const server = project(id, "Servidor");
    await repo.saveConflict({
      operationId: operation.operationId,
      entity: "project",
      entityId: id,
      baseVersion: null,
      serverVersion: 4,
      reason: "VERSION_CONFLICT",
      localPayload: project(id, "Minha versão"),
      serverPayload: server,
    });

    await repo.resolveConflict(operation.operationId, "use-server");

    expect(await repo.listConflicts()).toEqual([]);
    expect(await repo.listOutbox()).toEqual([]);
    expect(
      await repo.getEntity(await repo.workspaceId(), "project", id),
    ).toMatchObject({
      version: 4,
      deleted: false,
      payload: server,
    });
  });

  it("leaves data intact when quota rejects the transaction", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    db.quotaBytes = 1;
    await expect(repo.mutate({ entity: "project", entityId: id, payload: project(id, "quota"), operation: "upsert", baseVersion: null })).rejects.toThrow(/Quota/);
    db.quotaBytes = undefined;
    expect(await repo.listOutbox()).toEqual([]);
    expect(await repo.getEntity(await repo.workspaceId(), "project", id)).toBeUndefined();
  });

  it("rejects invalid acknowledgement cursors and unverifiable originals", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const op = await repo.mutate({ entity: "project", entityId: id, payload: project(id, "valid"), operation: "upsert", baseVersion: null });
    await expect(repo.acknowledge(op.operationId, 0, "1")).rejects.toThrow(/versão/);
    await expect(repo.acknowledge(op.operationId, 1, "0")).rejects.toThrow(/sequência/);
    const blob = new Blob(["not a pdf"], { type: "text/plain" });
    await expect(repo.saveOriginal({ blobId: "bad", blob, mediaType: "text/plain", bytes: blob.size, sha256: "0".repeat(64) })).rejects.toThrow(/PDF/);
  });

  it("does not commit when a transaction callback fails synchronously or asynchronously", async () => {
    const db = new MemoryLocalDb();
    await expect(db.transact(["meta"], "readwrite", () => { throw new Error("sync failure"); })).rejects.toThrow("sync failure");
    await expect(db.transact(["meta"], "readwrite", async () => { throw new Error("async failure"); })).rejects.toThrow("async failure");
    const repo = new LocalRepository(db);
    expect(await repo.workspaceId()).toBeDefined();
  });
});
