import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("restores a partial encrypted workspace with its pending work in an isolated profile", async ({ page, browser }) => {
  const passphrase = "senha-sintetica-para-backup-2026";
  await page.addInitScript(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
  await page.goto("/workspace");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Backup & Restauração Cifrada" })).toBeVisible();

  // Both contexts are ephemeral Playwright profiles; no installed PWA data is touched.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("GeoNexoLocalFirstDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const pdf = new TextEncoder().encode("%PDF-1.4\nbackup-sintetico\n%%EOF");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", pdf)))
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const workspaceId = "11111111-1111-4111-8111-111111111111";
    const projectId = "44444444-4444-4444-8444-444444444444";
    const operationId = "22222222-2222-4222-8222-222222222222";
    const conflictId = "33333333-3333-4333-8333-333333333333";
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["meta", "entities", "originals", "outbox", "conflicts", "acks"], "readwrite");
      for (const name of ["entities", "originals", "outbox", "conflicts", "acks"]) tx.objectStore(name).clear();
      tx.objectStore("meta").put({ key: "workspaceId", value: workspaceId });
      tx.objectStore("meta").put({ key: "outboxSequence", value: 1 });
      tx.objectStore("entities").put({
        key: `${workspaceId}:project:${projectId}`, workspaceId, entity: "project", entityId: projectId,
        version: 0, deleted: false, updatedAt: "2026-01-01T00:00:00.000Z",
        payload: { entity: "project", data: {
          id: projectId, name: "Projeto sintético", status: "active",
          createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        } },
      });
      tx.objectStore("originals").put({ key: `${workspaceId}:pdf1`, workspaceId, blobId: "pdf1", bytes: pdf.byteLength, mediaType: "application/pdf", sha256: hash, originalBytes: pdf.buffer });
      tx.objectStore("outbox").put({ key: operationId, workspaceId, operationId, entity: "project", entityId: projectId, operation: "delete", baseVersion: null, createdAt: "2026-01-01T00:00:00.000Z", localSequence: 1, immutable: true });
      tx.objectStore("conflicts").put({ key: `${workspaceId}:${conflictId}`, workspaceId, operationId: conflictId, entity: "project", entityId: projectId, baseVersion: null, serverVersion: 1, reason: "VERSION_CONFLICT", createdAt: "2026-01-01T00:00:00.000Z" });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await expect(page.getByText(/Esta cópia é parcial/)).toBeVisible();
  await page.getByRole("button", { name: "Exportar Backup Cifrado" }).click();
  await page.getByLabel("Frase de proteção (mínimo 12 caracteres)").fill(passphrase);
  await page.getByLabel("Confirme a frase de proteção").fill(passphrase);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Gerar e Baixar" }).click();
  const archive = await readFile(await (await downloadPromise).path());

  const destination = await browser.newContext();
  try {
    await destination.addInitScript(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
    const target = await destination.newPage();
    await target.goto(new URL("/?restore=1", page.url()).href);
    await target.getByRole("button", { name: "Restaurar Backup" }).click();
    await target.getByLabel("Arquivo de Backup (.markmapbackup)").setInputFiles({ name: "teste.markmapbackup", mimeType: "application/octet-stream", buffer: archive });
    await target.getByLabel("Frase de proteção").fill(passphrase);
    await target.getByRole("button", { name: "Verificar" }).click();
    await expect(target.getByText("Integridade confirmada")).toBeVisible();
    await target.getByRole("dialog").getByRole("checkbox").check();
    await target.getByRole("button", { name: "Restaurar Dados" }).click();
    await expect(target.getByText("Backup restaurado com sucesso")).toBeVisible();
    await target.reload();

    const restored = await target.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("GeoNexoLocalFirstDB");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const result = await new Promise<Record<string, unknown[]>>((resolve, reject) => {
        const names = ["meta", "entities", "originals", "outbox", "conflicts"];
        const tx = db.transaction(names, "readonly");
        const rows: Record<string, unknown[]> = {};
        for (const name of names) {
          const request = tx.objectStore(name).getAll();
          request.onsuccess = () => { rows[name] = request.result; };
        }
        tx.oncomplete = () => resolve(rows);
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      const original = result.originals[0] as { originalBytes: ArrayBuffer };
      return { ...result, pdfBytes: Array.from(new Uint8Array(original.originalBytes)) };
    });
    expect(restored.outbox).toEqual(expect.arrayContaining([expect.objectContaining({ key: "22222222-2222-4222-8222-222222222222", localSequence: 1 })]));
    expect(restored.conflicts).toEqual(expect.arrayContaining([expect.objectContaining({ key: "11111111-1111-4111-8111-111111111111:33333333-3333-4333-8333-333333333333" })]));
    expect(restored.entities).toEqual(expect.arrayContaining([expect.objectContaining({ key: "11111111-1111-4111-8111-111111111111:project:44444444-4444-4444-8444-444444444444" })]));
    expect(restored.originals).toEqual(expect.arrayContaining([expect.objectContaining({ key: "11111111-1111-4111-8111-111111111111:pdf1" })]));
    expect(restored.pdfBytes).toEqual(Array.from(new TextEncoder().encode("%PDF-1.4\nbackup-sintetico\n%%EOF")));
    expect(restored.meta).toEqual(expect.arrayContaining([expect.objectContaining({ key: "outboxSequence", value: 1 })]));

    // Return to the app with the same isolated profile and the sync guard offline.
    expect(await target.evaluate(() => navigator.onLine)).toBe(false);
    await target.getByRole("link", { name: "Voltar ao aplicativo" }).click();
    await target.goto(new URL("/projects", page.url()).href);
    await expect(target.getByRole("heading", { name: "Projetos Cartográficos" })).toBeVisible();
    await expect(target.getByText("Projeto sintético", { exact: true })).toBeVisible();
    expect(await target.evaluate(() => navigator.onLine)).toBe(false);
  } finally {
    await destination.close();
  }
});

test("recovery screen respects the saved appearance and viewport", async ({ page }) => {
  await page.goto("/?restore=1");
  const backgrounds: string[] = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => localStorage.setItem("theme", value), theme);
    await page.reload();
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Recuperar backup" })).toBeVisible();
    backgrounds.push(await main.evaluate((element) => getComputedStyle(element).backgroundColor));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator("html").evaluate((element) => element.classList.contains("dark"))).toBe(theme === "dark");
  }
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
});
