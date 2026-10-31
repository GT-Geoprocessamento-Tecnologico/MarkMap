import { describe, expect, it } from "vitest";
import { MemoryLocalDb } from "../local-db/memory";
import { LocalRepository } from "./index";
import { originalKey } from "../local-db";

const projectId = "11111111-1111-4111-8111-111111111111";
const otherProject = "22222222-2222-4222-8222-222222222222";
const layerId = "33333333-3333-4333-8333-333333333333";
const featureId = "44444444-4444-4444-8444-444444444444";
const mapId = "55555555-5555-4555-8555-555555555555";
const importId = "66666666-6666-4666-8666-666666666666";

async function seeded() {
  const db = new MemoryLocalDb();
  const repo = new LocalRepository(db);
  const workspaceId = await repo.workspaceId();
  const rows = [
    { entity: "project", entityId: projectId, data: { id: projectId, name: "Projeto de campo" } },
    { entity: "project", entityId: otherProject, data: { id: otherProject, name: "Não apagar" } },
    { entity: "layer", entityId: layerId, data: { id: layerId, projectId, name: "Medições" } },
    { entity: "feature", entityId: featureId, data: { id: featureId, layerId } },
    { entity: "map", entityId: mapId, data: { id: mapId, projectId } },
    { entity: "import", entityId: importId, data: { id: importId, projectId } },
  ] as const;
  await db.transact(["entities", "originals"], "readwrite", (tx) => {
    for (const row of rows) tx.store("entities").put({
      key: `${workspaceId}:${row.entity}:${row.entityId}`,
      workspaceId, entity: row.entity, entityId: row.entityId, deleted: false,
      version: 0, updatedAt: new Date().toISOString(),
      payload: { entity: row.entity, data: row.data },
    });
    const bytes = new Blob(["%PDF-1.4\n%%EOF"], { type: "application/pdf" });
    tx.store("originals").put({
      key: originalKey(workspaceId, "pdf-shared"), workspaceId, blobId: "pdf-shared", blob: bytes,
      mediaType: "application/pdf", bytes: bytes.size, sha256: "a".repeat(64),
      projectGeoPdfIds: [projectId, otherProject], createdAt: new Date().toISOString(),
    });
    const jpeg = new Blob([new Uint8Array([255, 216, 255, 224, 1, 2, 3])], { type: "image/jpeg" });
    tx.store("originals").put({
      key: originalKey(workspaceId, "photo-point"), workspaceId, blobId: "photo-point", blob: jpeg,
      mediaType: "image/jpeg", bytes: jpeg.size, sha256: "b".repeat(64),
      pointPhoto: { projectId, layerId, featureId }, createdAt: new Date().toISOString(),
    });
  });
  return { db, repo, workspaceId };
}

describe("exclusão de projetos e camadas offline-first", () => {
  it("exclui projeto, filhos e fotos em uma transação e preserva PDF compartilhado/outro projeto", async () => {
    const { repo, workspaceId } = await seeded();
    const summary = await repo.deleteOwnedTree({ kind: "project", id: projectId, expectedName: "Projeto de campo" });
    expect(summary).toMatchObject({ deleted: true, projectId, layers: 1, features: 1, photos: 1, pdfLinks: 1 });
    for (const [entity, entityId] of [
      ["project", projectId], ["layer", layerId], ["feature", featureId],
      ["map", mapId], ["import", importId],
    ] as const) {
      expect((await repo.getEntity(workspaceId, entity, entityId))?.deleted).toBe(true);
    }
    expect((await repo.getEntity(workspaceId, "project", otherProject))?.deleted).toBe(false);
    expect(await repo.getOriginal("photo-point")).toBeNull();
    expect((await repo.getOriginal("pdf-shared"))?.projectGeoPdfIds).toEqual([otherProject]);
    const ops = await repo.listOutbox();
    expect(ops).toHaveLength(5);
    expect(ops.every((op) => op.operation === "delete")).toBe(true);
    expect(ops.map((op) => op.entity)).toEqual(["feature", "map", "import", "layer", "project"]);
    expect(await repo.pendingProjectMeshCleanupIds()).toEqual([projectId]);
    await repo.completeProjectMeshCleanup(projectId);
    expect(await repo.pendingProjectMeshCleanupIds()).toEqual([]);
    expect((await repo.deleteOwnedTree({ kind: "project", id: projectId, expectedName: "Projeto de campo" })).deleted).toBe(false);
    expect(await repo.listOutbox()).toHaveLength(5);
  });

  it("exclui somente camada e suas feições/fotos; preserva projeto, GeoPDF e demais entidades", async () => {
    const { repo, workspaceId } = await seeded();
    const summary = await repo.deleteOwnedTree({ kind: "layer", id: layerId, expectedName: "Medições" });
    expect(summary).toMatchObject({ deleted: true, layers: 1, features: 1, photos: 1, pdfLinks: 0 });
    expect((await repo.getEntity(workspaceId, "project", projectId))?.deleted).toBe(false);
    expect((await repo.getEntity(workspaceId, "map", mapId))?.deleted).toBe(false);
    expect((await repo.getOriginal("pdf-shared"))?.projectGeoPdfIds).toEqual([projectId, otherProject]);
    expect(await repo.getOriginal("photo-point")).toBeNull();
    expect((await repo.listOutbox()).map((op) => op.entity)).toEqual(["feature", "layer"]);
  });

  it("rejeita nome desatualizado e transação abortada sem perder dados/outbox", async () => {
    const { repo, db, workspaceId } = await seeded();
    await expect(repo.deleteOwnedTree({ kind: "project", id: projectId, expectedName: "Antigo" }))
      .rejects.toThrow(/outra aba/);
    db.failNextTransaction = true;
    await expect(repo.deleteOwnedTree({ kind: "project", id: projectId, expectedName: "Projeto de campo" }))
      .rejects.toThrow(/abortada/);
    expect((await repo.getEntity(workspaceId, "project", projectId))?.deleted).toBe(false);
    expect(await repo.getOriginal("photo-point")).not.toBeNull();
    expect((await repo.getOriginal("pdf-shared"))?.projectGeoPdfIds).toEqual([projectId, otherProject]);
    expect(await repo.listOutbox()).toEqual([]);
    expect(await repo.pendingProjectMeshCleanupIds()).toEqual([]);
  });
});
