import { describe, expect, it } from "vitest";
import type { SyncConflict } from "@markmap/contracts";
import { MemoryLocalDb } from "../local-db/memory";
import { LocalRepository } from "./index";
import { readBlobBytes } from "../blob-bytes";
import { originalKey, requestValue } from "../local-db";

const project = (id: string, name: string) => ({
  entity: "project" as const,
  data: { id, name, status: "active", createdAt: "2026-09-30T00:00:00.000Z", updatedAt: "2026-09-30T00:00:00.000Z" },
});
const id = "11111111-1111-4111-8111-111111111111";

describe("local-first repository", () => {
  it("persists PDF bytes without serializing a Blob and restores the exact original after reopening", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const source = new TextEncoder().encode('%PDF-1.4\noriginal bytes\n%%EOF');
    const blob = new Blob([source], { type: 'application/pdf' });
    const digest = await crypto.subtle.digest('SHA-256', source);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const input = { blobId: 'ios-pdf', blob, mediaType: 'application/pdf', bytes: blob.size, sha256, originalName: 'ios-original.pdf' };
    await repo.saveOriginal(input);
    const key = originalKey(await repo.workspaceId(), input.blobId);
    const raw = await db.transact(['originals'], 'readonly', tx => requestValue(tx.store('originals').get(key)));
    expect(raw.blob).toBeUndefined();
    expect(Array.from(new Uint8Array(raw.originalBytes))).toEqual(Array.from(source));
    const reopened = new LocalRepository(db);
    const restored = await reopened.getOriginal(input.blobId);
    expect(restored).toMatchObject({ sha256, originalName: input.originalName, bytes: source.length });
    expect(Array.from(new Uint8Array(await readBlobBytes(restored!.blob)))).toEqual(Array.from(source));
    expect((await reopened.listOriginals())[0]?.blob).toBeInstanceOf(Blob);
    await reopened.saveOriginal(input);
    expect(await reopened.listOriginals()).toHaveLength(1);
  });

  it("saves photos only for live project points, retains bytes offline and deletes only with matching link", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const workspaceId = await repo.workspaceId();
    const link = {
      projectId: id,
      layerId: "33333333-3333-4333-8333-333333333333",
      featureId: "22222222-2222-4222-8222-222222222222",
    };
    const jpeg = new Uint8Array([255, 216, 255, 224, 1, 2, 3]);
    const blob = new Blob([jpeg], { type: "image/jpeg" });
    const digest = await crypto.subtle.digest("SHA-256", jpeg);
    const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const input = { blobId: "foto-1", blob, mediaType: "image/jpeg", bytes: jpeg.length, sha256, pointPhoto: link };

    await expect(repo.saveOriginal(input)).rejects.toThrow(/não pertence/);
    await db.transact(["entities"], "readwrite", (tx) => {
      tx.store("entities").put({
        key: `${workspaceId}:feature:${link.featureId}`, workspaceId,
        entity: "feature", entityId: link.featureId, deleted: false,
        payload: { entity: "feature", data: { id: link.featureId, layerId: link.layerId } },
      });
      tx.store("entities").put({
        key: `${workspaceId}:layer:${link.layerId}`, workspaceId,
        entity: "layer", entityId: link.layerId, deleted: false,
        payload: { entity: "layer", data: { id: link.layerId, projectId: link.projectId } },
      });
    });
    await repo.saveOriginal(input);
    const stored = await repo.getOriginal(input.blobId);
    expect(stored?.pointPhoto).toEqual(link);
    expect(new Uint8Array(await readBlobBytes(stored!.blob))).toEqual(jpeg);
    expect(await repo.listOutbox()).toHaveLength(0); // Binary images never leak into the feature sync payload.
    await expect(repo.deletePointPhoto(input.blobId, { ...link, projectId: "44444444-4444-4444-8444-444444444444" }))
      .rejects.toThrow(/não pertence/);
    expect(await repo.getOriginal(input.blobId)).not.toBeNull();
    await repo.deletePointPhoto(input.blobId, link);
    expect(await repo.getOriginal(input.blobId)).toBeNull();
  });

  it("enforces maximum photos per point inside the originals transaction", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const workspaceId = await repo.workspaceId();
    const link = {
      projectId: id, layerId: "33333333-3333-4333-8333-333333333333",
      featureId: "22222222-2222-4222-8222-222222222222",
    };
    await db.transact(["entities"], "readwrite", (tx) => {
      tx.store("entities").put({ key: `${workspaceId}:feature:${link.featureId}`,
        workspaceId, entity: "feature", entityId: link.featureId, deleted: false,
        payload: { entity: "feature", data: { layerId: link.layerId } } });
      tx.store("entities").put({ key: `${workspaceId}:layer:${link.layerId}`,
        workspaceId, entity: "layer", entityId: link.layerId, deleted: false,
        payload: { entity: "layer", data: { projectId: link.projectId } } });
    });
    const jpeg = new Uint8Array([255, 216, 255, 224, 1]);
    const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", jpeg))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const blob = new Blob([jpeg], { type: "image/jpeg" });
    for (let i = 0; i < 5; i++) {
      await repo.saveOriginal({ blobId: `p-${i}`, blob, mediaType: "image/jpeg",
        bytes: jpeg.length, sha256: sha, pointPhoto: link });
    }
    await expect(repo.saveOriginal({ blobId: "p-5", blob, mediaType: "image/jpeg",
      bytes: jpeg.length, sha256: sha, pointPhoto: link })).rejects.toThrow(/máxima/);
    expect((await repo.listOriginals()).filter((row) => row.pointPhoto?.featureId === link.featureId)).toHaveLength(5);
  });

  it("persists and restores a GeoTIFF original through the same local store", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const source = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 1, 2, 3, 4]);
    const blob = new Blob([source], { type: 'image/tiff' });
    const digest = await crypto.subtle.digest('SHA-256', source);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    await repo.saveOriginal({ blobId: 'local-tiff', blob, mediaType: 'image/tiff', bytes: blob.size, sha256, originalName: 'local.tif' });
    const restored = await repo.getOriginal('local-tiff');
    expect(restored).toMatchObject({ mediaType: 'image/tiff', originalName: 'local.tif', bytes: source.length });
    expect(Array.from(new Uint8Array(await readBlobBytes(restored!.blob)))).toEqual(Array.from(source));
  });

  it("keeps legacy PDF Blob records readable without rewriting them", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const workspaceId = await repo.workspaceId();
    const blob = new Blob(['legacy PDF'], { type: 'application/pdf' });
    const record = { key: originalKey(workspaceId, 'legacy'), workspaceId, blobId: 'legacy', blob, mediaType: 'application/pdf', bytes: blob.size, sha256: 'a'.repeat(64), originalName: 'legacy.pdf', createdAt: '2026-10-19T00:00:00Z' };
    await db.transact(['originals'], 'readwrite', tx => { tx.store('originals').add(record); });
    expect((await repo.getOriginal('legacy'))?.blob).toBe(blob);
    expect((await repo.listOriginals())[0]?.blob).toBe(blob);
    const raw = await db.transact(['originals'], 'readonly', tx => requestValue(tx.store('originals').get(record.key)));
    expect(raw.originalBytes).toBeUndefined();
  });

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
    expect(await repo.acknowledge(first.operationId, 1, "1")).toBe(true);
    expect(await repo.acknowledge(second.operationId, 2, "2")).toBe(true);
    expect(await repo.acknowledge(second.operationId, 2, "2")).toBe(true);
    expect(await repo.acknowledge(second.operationId, 1, "1")).toBe(false);
    expect(await repo.acknowledge(second.operationId, 3, "1")).toBe(false);
    expect(await repo.listOutbox()).toEqual([]);
    expect((await repo.getEntity(await repo.workspaceId(), "project", id))?.version).toBe(2);
  });

  it("preserves originals as exportable blobs and retains conflicts", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const blob = new Blob(["original pdf"], { type: "application/pdf" });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("original pdf"),
    );
    const sha256 = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    await repo.saveOriginal({ blobId: "blob-1", blob, mediaType: "application/pdf", bytes: blob.size, sha256 });
    await repo.saveOriginal({ blobId: "blob-1", blob, mediaType: "application/pdf", bytes: blob.size, sha256 });
    const different = new Blob(["different"], { type: "application/pdf" });
    const differentDigest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("different"),
    );
    const differentHash = [...new Uint8Array(differentDigest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    await expect(repo.saveOriginal({ blobId: "blob-1", blob: different, mediaType: "application/pdf", bytes: different.size, sha256: differentHash })).rejects.toThrow(/conflitantes/);
    const stored = await repo.getOriginal("blob-1");
    expect(stored?.blob).toBeInstanceOf(Blob);
    expect(stored?.mediaType).toBe("application/pdf");
    expect(stored?.bytes).toBe(blob.size);
    const pending = await repo.mutate({
      entity: "project",
      entityId: id,
      payload: project(id, "local"),
      operation: "upsert",
      baseVersion: null,
    });
    const conflict: SyncConflict = { operationId: pending.operationId, entity: "project", entityId: id, baseVersion: null, serverVersion: 1, reason: "VERSION_CONFLICT", localPayload: project(id, "local"), serverPayload: project(id, "server") };
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

describe("ciclo de vida local GeoPDF/GeoTIFF", () => {
  const source = new TextEncoder().encode("%PDF-1.4\noriginal\n%%EOF");
  const blob = new Blob([source], { type: "application/pdf" });
  const sha256Promise = crypto.subtle.digest("SHA-256", source).then((result) =>
    [...new Uint8Array(result)].map((b) => b.toString(16).padStart(2, "0")).join(""));

  it("renomeia sem mudar bytes, hash, workspace ou associação", async () => {
    const repo = new LocalRepository(new MemoryLocalDb());
    const sha256 = await sha256Promise;
    await repo.saveOriginal({ blobId: "pdf-renomear", blob, mediaType: "application/pdf",
      bytes: blob.size, sha256, originalName: "Antigo.pdf" });
    await repo.renameImportedOriginal("pdf-renomear", "Novo", "Antigo.pdf");
    const after = (await repo.getOriginal("pdf-renomear"))!;
    expect(after.originalName).toBe("Novo.pdf");
    expect(after.sha256).toBe(sha256);
    expect(Array.from(new Uint8Array(await readBlobBytes(after.blob)))).toEqual(Array.from(source));
    await expect(repo.renameImportedOriginal("pdf-renomear", "Erro", "Antigo.pdf"))
      .rejects.toThrow(/outra aba/);
  });

  it("exclui bytes e meta legados atomica e idempotentemente, sem remover outros arquivos", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const sha256 = await sha256Promise;
    const record = (blobId: string) => ({ blobId, blob, mediaType: "application/pdf",
      bytes: blob.size, sha256, originalName: `${blobId}.pdf` });
    await repo.saveOriginal(record("pdf-excluir"));
    await repo.saveOriginal(record("pdf-preservar"));
    await repo.setMeta("pdfGeoref:pdf-excluir", { method: "manual" });
    await repo.setMeta("pdfGeorefSource:pdf-excluir", { method: "manual" });
    const expected = (await repo.getOriginal("pdf-excluir"))!;
    db.failNextTransaction = true;
    await expect(repo.deleteImportedOriginal("pdf-excluir", expected)).rejects.toThrow(/abortada/);
    expect(await repo.getOriginal("pdf-excluir")).not.toBeNull();
    expect(await repo.deleteImportedOriginal("pdf-excluir", expected)).toBe(true);
    expect(await repo.deleteImportedOriginal("pdf-excluir", expected)).toBe(false);
    expect(await repo.getOriginal("pdf-excluir")).toBeNull();
    expect(await repo.getMeta("pdfGeoref:pdf-excluir")).toBeUndefined();
    expect(await repo.getMeta("pdfGeorefSource:pdf-excluir")).toBeUndefined();
    // A delayed preview calibration may not recreate orphaned metadata.
    await expect(repo.setMeta("pdfGeoref:pdf-excluir", { method: "manual" }))
      .rejects.toThrow(/excluído/);
    expect(await repo.getMeta("pdfGeoref:pdf-excluir")).toBeUndefined();
    expect(await repo.getOriginal("pdf-preservar")).not.toBeNull();
  });

  it("bloqueia exclusao com dados desatualizados ou tipo de foto", async () => {
    const repo = new LocalRepository(new MemoryLocalDb());
    const sha256 = await sha256Promise;
    await repo.saveOriginal({ blobId: "pdf-stale", blob, mediaType: "application/pdf",
      bytes: blob.size, sha256, originalName: "Atual.pdf" });
    const current = (await repo.getOriginal("pdf-stale"))!;
    await expect(repo.deleteImportedOriginal("pdf-stale", { ...current, originalName: "Anterior.pdf" }))
      .rejects.toThrow(/outra aba/);
    expect(await repo.getOriginal("pdf-stale")).not.toBeNull();
  });
});

describe("GeoPDF vinculado ao projeto no IndexedDB", () => {
  it("associa GeoPDF e troca a seleção sem alterar os bytes ou outros projetos", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const workspaceId = await repo.workspaceId();
    const otherProject = "44444444-4444-4444-8444-444444444444";
    await db.transact(["entities"], "readwrite", (tx) => {
      for (const projectId of [id, otherProject]) {
        tx.store("entities").put({
          key: `${workspaceId}:project:${projectId}`, workspaceId,
          entity: "project", entityId: projectId, deleted: false,
          payload: { entity: "project", data: { id: projectId, name: "Projeto" } },
        });
      }
    });
    const bytes = new TextEncoder().encode("%PDF-1.4\nGeoPDF sintético\n%%EOF");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const pdf = (blobId: string) => ({
      blobId, mediaType: "application/pdf", blob: new Blob([bytes], { type: "application/pdf" }),
      bytes: bytes.byteLength, sha256: hash, originalName: `${blobId}.pdf`,
    });
    await repo.saveOriginal(pdf("a"));
    await repo.saveOriginal(pdf("b"));
    await repo.assignProjectGeoPdf(id, "a");
    await repo.assignProjectGeoPdf(otherProject, "a");
    expect((await repo.getProjectGeoPdf(id))?.blobId).toBe("a");
    await repo.assignProjectGeoPdf(id, "b");
    expect((await repo.getProjectGeoPdf(id))?.blobId).toBe("b");
    expect((await repo.getProjectGeoPdf(otherProject))?.blobId).toBe("a");
    expect(Array.from(new Uint8Array(await readBlobBytes((await repo.getOriginal("a"))!.blob)))).toEqual(Array.from(bytes));
    await repo.assignProjectGeoPdf(id, null);
    expect(await repo.getProjectGeoPdf(id)).toBeNull();
    expect((await repo.getProjectGeoPdf(otherProject))?.blobId).toBe("a");
    await expect(repo.assignProjectGeoPdf(id, "sem-pdf")).rejects.toThrow(/não encontrado/);
    await expect(repo.assignProjectGeoPdf("sem-projeto", "a")).rejects.toThrow();
  });

  it("lê GeoPDF associado mesmo quando um GeoTIFF não relacionado está sem bytes", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const workspaceId = await repo.workspaceId();
    await db.transact(["entities"], "readwrite", (tx) => {
      tx.store("entities").put({
        key: `${workspaceId}:project:${id}`, workspaceId,
        entity: "project", entityId: id, deleted: false,
        payload: { entity: "project", data: { id, name: "Campo" } },
      });
    });
    const bytes = new TextEncoder().encode("%PDF-1.4\\n%%EOF");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((n) => n.toString(16).padStart(2, "0")).join("");
    await repo.saveOriginal({
      blobId: "valid-pdf", mediaType: "application/pdf",
      blob: new Blob([bytes], { type: "application/pdf" }),
      bytes: bytes.length, sha256: hash,
    });
    await repo.assignProjectGeoPdf(id, "valid-pdf");
    await db.transact(["originals"], "readwrite", (tx) => {
      tx.store("originals").put({
        key: `${workspaceId}:corrupt-tiff`, workspaceId,
        blobId: "corrupt-tiff", mediaType: "image/tiff", bytes: 50,
        sha256: "0".repeat(64), createdAt: new Date().toISOString(),
      });
    });
    await expect(repo.listOriginals()).rejects.toThrow(/bytes/);
    expect((await repo.getProjectGeoPdf(id))?.blobId).toBe("valid-pdf");
  });

  it("mantém o vínculo após reimportação idempotente do PDF original", async () => {
    const db = new MemoryLocalDb();
    const repo = new LocalRepository(db);
    const workspaceId = await repo.workspaceId();
    await db.transact(["entities"], "readwrite", (tx) => {
      tx.store("entities").put({
        key: `${workspaceId}:project:${id}`, workspaceId,
        entity: "project", entityId: id, deleted: false,
        payload: { entity: "project", data: { id, name: "Campo" } },
      });
    });
    const bytes = new TextEncoder().encode("%PDF-1.4\n%%EOF");
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((n) => n.toString(16).padStart(2, "0")).join("");
    const input = {
      blobId: "pdf-original", mediaType: "application/pdf",
      blob: new Blob([bytes], { type: "application/pdf" }),
      bytes: bytes.length, sha256,
    };
    await repo.saveOriginal(input);
    await repo.assignProjectGeoPdf(id, input.blobId);
    await repo.saveOriginal(input);
    const reopened = new LocalRepository(db);
    expect((await reopened.getProjectGeoPdf(id))?.projectGeoPdfIds).toEqual([id]);
    const raw = await db.transact(["originals"], "readonly", (tx) =>
      requestValue(tx.store("originals").get(originalKey(workspaceId, input.blobId))));
    expect(raw.projectGeoPdfIds).toEqual([id]);
  });
});
