import { describe, expect, it } from "vitest";
import { MemoryLocalDb } from "../local-db/memory";
import { LocalRepository } from "../local-repositories";
import { readBlobBytes } from "../blob-bytes";
import {
  exportFullPointPhotoBackup, inspectFullPointPhotoBackup,
  restoreFullPointPhotoBackup,
} from "./photo-backup";

const ID = "11111111-1111-4111-8111-111111111111";
const LAYER = "33333333-3333-4333-8333-333333333333";
const POINT = "22222222-2222-4222-8222-222222222222";
const PASSWORD = "FraseDeProtecao123456789";
const BYTES = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4]);

async function fixture() {
  const db = new MemoryLocalDb();
  const repository = new LocalRepository(db);
  const workspaceId = await repository.workspaceId();
  await db.transact(["entities"], "readwrite", (tx) => {
    tx.store("entities").put({
      key: `${workspaceId}:project:${ID}`, workspaceId, entity: "project",
      entityId: ID, deleted: false, payload: { entity: "project", data: { id: ID, name: "Campo" } },
    });
    tx.store("entities").put({
      key: `${workspaceId}:layer:${LAYER}`, workspaceId, entity: "layer",
      entityId: LAYER, deleted: false, payload: { entity: "layer", data: { id: LAYER, projectId: ID } },
    });
    tx.store("entities").put({
      key: `${workspaceId}:feature:${POINT}`, workspaceId, entity: "feature",
      entityId: POINT, deleted: false, payload: { entity: "feature", data: { id: POINT, layerId: LAYER } },
    });
  });
  const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", BYTES))]
    .map((v) => v.toString(16).padStart(2, "0")).join("");
  const link = { projectId: ID, layerId: LAYER, featureId: POINT };
  const photo = {
    blobId: "photo-1", blob: new Blob([BYTES], { type: "image/jpeg" }),
    mediaType: "image/jpeg", bytes: BYTES.byteLength, sha256,
    pointPhoto: link, originalName: "marco.jpg",
  };
  await repository.saveOriginal(photo);
  return { db, repository, workspaceId, photo, link };
}

describe("backup integral de fotos por workspace", () => {
  it("inclui cada foto, descriptografa com senha e restaura sem perder outbox", async () => {
    const { repository, link } = await fixture();
    const exported = await exportFullPointPhotoBackup(PASSWORD, repository);
    expect(exported.photoCount).toBe(1);
    const preview = await inspectFullPointPhotoBackup(exported.bytes, PASSWORD);
    expect(preview.count).toBe(1);
    expect(preview.originals[0]?.pointPhoto).toEqual(link);
    expect(new Uint8Array(await readBlobBytes(preview.originals[0]!.blob))).toEqual(BYTES);
    await repository.deletePointPhoto("photo-1", link);
    expect(await repository.getOriginal("photo-1")).toBeNull();
    const restored = await restoreFullPointPhotoBackup(exported.bytes, PASSWORD, repository);
    expect(restored).toMatchObject({ added: 1, unchanged: 0, count: 1 });
    expect((await repository.getOriginal("photo-1"))?.sha256).toBe(preview.originals[0]?.sha256);
    expect((await repository.listOutbox())).toHaveLength(0);
    expect(await restoreFullPointPhotoBackup(exported.bytes, PASSWORD, repository))
      .toMatchObject({ added: 0, unchanged: 1, count: 1 });
  });

  it("não restaura com senha incorreta, corrupção ou outro workspace", async () => {
    const { repository } = await fixture();
    const exported = await exportFullPointPhotoBackup(PASSWORD, repository);
    await expect(inspectFullPointPhotoBackup(exported.bytes, "SenhaDiferente123456"))
      .rejects.toThrow();
    const corrupted = exported.bytes.slice();
    corrupted[corrupted.length - 8] = corrupted[corrupted.length - 8] === 65 ? 66 : 65;
    await expect(inspectFullPointPhotoBackup(corrupted, PASSWORD)).rejects.toThrow();
    await expect(restoreFullPointPhotoBackup(exported.bytes, PASSWORD,
      new LocalRepository(new MemoryLocalDb()))).rejects.toThrow(/Workspace/);
  });

  it("recusa imagem local com mesmos metadados mas bytes divergentes, sem sobrescrever", async () => {
    const { db, repository, workspaceId } = await fixture();
    const exported = await exportFullPointPhotoBackup(PASSWORD, repository);
    await db.transact(["originals"], "readwrite", (tx) => {
      const store = tx.store("originals");
      const key = `${workspaceId}:photo-1`;
      const request = store.get(key);
      request.onsuccess = () => {
        const record = request.result as Record<string, unknown>;
        store.put({ ...record, originalBytes: new Uint8Array([255, 216, 255, 224, 9, 8, 7, 6]).buffer });
      };
    });
    await expect(restoreFullPointPhotoBackup(exported.bytes, PASSWORD, repository))
      .rejects.toThrow(/bytes diferentes/);
  });

  it("preserva a foto como órfã quando o ponto foi excluído, sem reatribuir vínculo", async () => {
    const { db, repository, workspaceId, link } = await fixture();
    const exported = await exportFullPointPhotoBackup(PASSWORD, repository);
    await repository.deletePointPhoto("photo-1", link);
    await db.transact(["entities"], "readwrite", (tx) => {
      tx.store("entities").delete(`${workspaceId}:feature:${POINT}`);
    });
    const outcome = await restoreFullPointPhotoBackup(exported.bytes, PASSWORD, repository);
    expect(outcome).toMatchObject({ added: 1, unchanged: 0, orphaned: 1, count: 1 });
    expect((await repository.getOriginal("photo-1"))?.pointPhoto).toEqual(link);
  });

  it("mantém nomes opcionais compatíveis com backup parcial sem serializar undefined", async () => {
    const { db, repository, photo } = await fixture();
    await repository.deletePointPhoto("photo-1", photo.pointPhoto);
    await repository.saveOriginal({ ...photo, originalName: undefined });
    const exported = await exportFullPointPhotoBackup(PASSWORD, repository);
    await repository.deletePointPhoto("photo-1", photo.pointPhoto);
    await restoreFullPointPhotoBackup(exported.bytes, PASSWORD, repository);
    const workspaceId = await repository.workspaceId();
    const row = await db.transact(["originals"], "readonly", (tx) =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const req = tx.store("originals").get(`${workspaceId}:photo-1`);
        req.onsuccess = () => resolve(req.result as Record<string, unknown>);
        req.onerror = () => reject(req.error);
      }));
    expect(Object.hasOwn(row ?? {}, "originalName")).toBe(false);
  });
});
