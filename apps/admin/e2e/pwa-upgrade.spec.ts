import { expect, test } from "./fixtures";

const DB_NAME = "GeoNexoLocalFirstDB";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const ENTITY_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const CREATED_AT = "2026-10-03T00:00:00.000Z";

test.describe("PWA installability and local-data upgrade", () => {
  test("serves an installable manifest, active service worker and offline shell", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "PWA lifecycle acceptance runs once in desktop Chromium.",
    );

    await page.goto("/");
    const runtime = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator))
        throw new Error("Service Worker indisponível");
      const registration = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          );
        });
      }
      const manifestLink = document.querySelector<HTMLLinkElement>(
        'link[rel="manifest"]',
      );
      if (!manifestLink) throw new Error("Manifest não está linkado");
      const response = await fetch(manifestLink.href);
      const manifest = (await response.json()) as {
        display: string;
        icons: Array<{ src: string; sizes: string; purpose?: string }>;
      };
      const iconStatuses = await Promise.all(
        manifest.icons.map(async (icon) => ({
          src: icon.src,
          status: (await fetch(icon.src)).status,
        })),
      );
      return {
        display: manifest.display,
        controlled: navigator.serviceWorker.controller !== null,
        active: registration.active?.state,
        iconStatuses,
      };
    });

    expect(runtime.display).toBe("standalone");
    expect(runtime.controlled).toBe(true);
    expect(runtime.active).toBe("activated");
    expect(runtime.iconStatuses.every((icon) => icon.status === 200)).toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/MarkMap/i);
    await expect(page.getByLabel("MarkMap — Planejamento Inteligente").first()).toBeVisible();
    await context.setOffline(false);
  });

  test("upgrades IndexedDB v1 to the current schema without losing entity or outbox", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "IndexedDB migration acceptance runs once in desktop Chromium.",
    );

    await page.goto("/manifest.json");

    await page.evaluate(
      async ({ dbName, workspaceId, entityId, operationId, createdAt }) => {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(dbName);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () =>
            reject(new Error("IndexedDB anterior permaneceu aberto"));
        });

        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open(dbName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            const meta = db.createObjectStore("meta", { keyPath: "key" });
            const entities = db.createObjectStore("entities", {
              keyPath: "key",
            });
            entities.createIndex("workspace", "workspaceId", { unique: false });
            entities.createIndex(
              "entity",
              ["workspaceId", "entity", "entityId"],
              { unique: true },
            );
            const originals = db.createObjectStore("originals", {
              keyPath: "key",
            });
            originals.createIndex("workspace", "workspaceId", {
              unique: false,
            });
            const outbox = db.createObjectStore("outbox", { keyPath: "key" });
            outbox.createIndex("workspace", "workspaceId", { unique: false });
            outbox.createIndex(
              "entity",
              ["workspaceId", "entity", "entityId"],
              { unique: false },
            );
            const conflicts = db.createObjectStore("conflicts", {
              keyPath: "key",
            });
            conflicts.createIndex("workspace", "workspaceId", {
              unique: false,
            });
            void meta;
          };
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(
              ["meta", "entities", "outbox"],
              "readwrite",
            );
            const payload = {
              entity: "project",
              data: {
                id: entityId,
                name: "Projeto preservado no upgrade",
                status: "active",
                createdAt,
                updatedAt: createdAt,
              },
            };
            tx.objectStore("meta").put({ key: "workspaceId", value: workspaceId });
            tx.objectStore("meta").put({ key: "outboxSequence", value: 1 });
            tx.objectStore("entities").put({
              key: `${workspaceId}:project:${entityId}`,
              workspaceId,
              entity: "project",
              entityId,
              version: 0,
              deleted: false,
              payload,
              updatedAt: createdAt,
              predecessorOperationId: operationId,
            });
            tx.objectStore("outbox").put({
              key: operationId,
              immutable: true,
              localSequence: 1,
              operationId,
              workspaceId,
              entity: "project",
              entityId,
              operation: "upsert",
              baseVersion: null,
              createdAt,
              payload,
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          };
        });
      },
      {
        dbName: DB_NAME,
        workspaceId: WORKSPACE_ID,
        entityId: ENTITY_ID,
        operationId: OPERATION_ID,
        createdAt: CREATED_AT,
      },
    );

    await page.goto("/projects");
    await expect(
      page.getByText("Projeto preservado no upgrade", { exact: true }),
    ).toBeVisible();

    const upgraded = await page.evaluate(
      async ({ dbName, workspaceId, entityId, operationId }) =>
        new Promise<{
          version: number;
          stores: string[];
          indexes: string[];
          workspaceId: string | null;
          entityPresent: boolean;
          outboxPresent: boolean;
        }>((resolve, reject) => {
          const request = indexedDB.open(dbName);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(
              ["meta", "entities", "outbox"],
              "readonly",
            );
            const meta = tx.objectStore("meta").get("workspaceId");
            const entity = tx
              .objectStore("entities")
              .get(`${workspaceId}:project:${entityId}`);
            const outboxStore = tx.objectStore("outbox");
            const outbox = outboxStore.get(operationId);
            tx.oncomplete = () => {
              const result = {
                version: db.version,
                stores: Array.from(db.objectStoreNames),
                indexes: Array.from(outboxStore.indexNames),
                workspaceId:
                  (meta.result as { value?: string } | undefined)?.value ?? null,
                entityPresent: entity.result !== undefined,
                outboxPresent: outbox.result !== undefined,
              };
              db.close();
              resolve(result);
            };
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          };
        }),
      {
        dbName: DB_NAME,
        workspaceId: WORKSPACE_ID,
        entityId: ENTITY_ID,
        operationId: OPERATION_ID,
      },
    );

    expect(upgraded.version).toBe(2);
    expect(upgraded.stores).toEqual(
      expect.arrayContaining([
        "meta",
        "entities",
        "originals",
        "outbox",
        "conflicts",
        "acks",
      ]),
    );
    expect(upgraded.indexes).toContain("workspaceSequence");
    expect(upgraded.workspaceId).toBe(WORKSPACE_ID);
    expect(upgraded.entityPresent).toBe(true);
    expect(upgraded.outboxPresent).toBe(true);
  });
});
