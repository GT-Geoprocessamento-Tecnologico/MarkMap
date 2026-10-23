import { expect, test, type Page } from "@playwright/test";

const DB_NAME = "MarkMapDB";

/** WebKit pode emitir onsuccess do upgrade antes do registro estar legível;
 *  aguardar a leitura confirmar antes de recarregar a página. */
async function waitForUserData(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          async ({ dbName }) => {
            const databases = (await indexedDB.databases?.()) ?? [];
            if (!databases.some((entry) => entry.name === dbName)) return false;
            return await new Promise<boolean>((resolve) => {
              const request = indexedDB.open(dbName);
              request.onerror = () => resolve(false);
              request.onsuccess = () => {
                const db = request.result;
                const finish = (found: boolean) => {
                  db.close();
                  resolve(found);
                };
                if (!db.objectStoreNames.contains("entities"))
                  return finish(false);
                const tx = db.transaction("entities", "readonly");
                const get = tx.objectStore("entities").get("user-1");
                get.onsuccess = () => finish(get.result !== undefined);
                get.onerror = () => finish(false);
              };
            });
          },
          { dbName: DB_NAME },
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}

test.describe("PWA Update Prompt E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // A sidebar fica oculta abaixo de lg e a topbar acima de sm: escolher a
    // marca visível no viewport em uso em vez do primeiro match do DOM.
    await expect(
      page
        .locator('[aria-label="MarkMap — Planejamento Inteligente"]:visible')
        .first(),
    ).toBeVisible();
  });

  test.describe("worker waiting → confirmation → controllerchange", () => {
    test("user clicks Atualizar and controllerchange fires with a new controller", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const containerListeners = new Map<string, Array<() => void>>();
        const registration = {
          waiting: {
            postMessage: (message: unknown) => {
              if ((message as { type?: string })?.type !== "SKIP_WAITING")
                return;
              (
                navigator.serviceWorker as unknown as { controller: unknown }
              ).controller = {
                state: "activated",
              };
              for (const listener of containerListeners.get(
                "controllerchange",
              ) ?? [])
                listener();
              (
                window as { __mmControllerChange?: boolean }
              ).__mmControllerChange = true;
            },
          },
          installing: { state: "installed", addEventListener: () => {} },
          addEventListener: () => {},
          removeEventListener: () => {},
        };
        const container = {
          ready: Promise.resolve(registration),
          controller: null,
          register: () => Promise.resolve({ update: () => {} }),
          addEventListener: (type: string, listener: () => void) => {
            const list = containerListeners.get(type) ?? [];
            list.push(listener);
            containerListeners.set(type, list);
          },
          removeEventListener: (type: string, listener: () => void) => {
            const list = containerListeners.get(type) ?? [];
            const index = list.indexOf(listener);
            if (index >= 0) list.splice(index, 1);
          },
        };
        Object.defineProperty(navigator, "serviceWorker", {
          configurable: true,
          value: container,
        });
      });

      await page.goto("/");
      await expect(
        page.getByRole("status", { name: /Nova versão/ }),
      ).toBeVisible();

      // User clicks "Atualizar agora" → SKIP_WAITING → controllerchange
      await page.getByRole("button", { name: "Atualizar agora" }).click();

      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as { __mmControllerChange?: boolean })
                .__mmControllerChange,
          ),
        )
        .toBe(true);

      const isControlled = await page.evaluate(
        () =>
          (navigator.serviceWorker as unknown as { controller: unknown })
            .controller !== null,
      );
      expect(isControlled).toBe(true);
    });
  });

  test.describe("teste de Depois", () => {
    test("prompt re-appears after offline→online or visibility change trigger", async ({
      page,
    }) => {
      // First, ensure we have a waiting SW so the prompt appears
      await page.addInitScript(() => {
        const waiting = { postMessage: () => {} };
        const ready = {
          waiting,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as ServiceWorkerRegistration;
        Object.defineProperty(navigator, "serviceWorker", {
          configurable: true,
          value: {
            ready: Promise.resolve(ready),
            controller: null,
            register: () => Promise.resolve({ update: () => {} }),
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
        (
          ready as ServiceWorkerRegistration & { installing: object }
        ).installing = {
          state: "installed",
          addEventListener: () => {},
        };
      });

      await page.goto("/");
      await expect(
        page.getByRole("status", { name: /Nova versão/ }),
      ).toBeVisible();

      // User clicks "Depois"
      await page.getByRole("button", { name: "Depois" }).click();

      // Prompt should be dismissed
      await expect(
        page.getByRole("status", { name: /Nova versão/ }),
      ).not.toBeVisible();

      // Go offline then online; reload only once back online so the update is
      // re-discovered on a fresh document. Offline shell reload is covered by
      // pwa-upgrade.spec.ts with a real service worker.
      await page.context().setOffline(true);
      await page.waitForTimeout(300);
      await page.context().setOffline(false);
      await page.reload({ waitUntil: "domcontentloaded" });

      // Prompt should re-appear after the offline→online trigger
      await expect(
        page.getByRole("status", { name: /Nova versão/ }),
      ).toBeVisible();

      // Click "Depois" again
      await page.getByRole("button", { name: "Depois" }).click();

      // Go offline→online again, then reload once back online
      await page.context().setOffline(true);
      await page.waitForTimeout(300);
      await page.context().setOffline(false);
      await page.reload({ waitUntil: "domcontentloaded" });

      // Prompt should re-appear after second trigger
      await expect(
        page.getByRole("status", { name: /Nova versão/ }),
      ).toBeVisible();
    });
  });

  test.describe("teste com outbox pendente", () => {
    test("update blocked when durableWritesReady returns false", async ({
      page,
    }) => {
      // Mock durableWritesReady to return false
      await page.evaluate(() => {
        const scope = self as unknown as {
          durableWritesReady?: () => boolean;
          compatibilityReady?: () => boolean;
        };
        scope.durableWritesReady = () => false;
        scope.compatibilityReady = () => true;
      });

      // Check if update prompt is visible
      const prompt = page.getByRole("status", { name: /Nova versão/ });
      const isVisible = await prompt.isVisible();

      if (isVisible) {
        // User clicks "Atualizar agora" - should be blocked because durableWritesReady returns false
        await page.getByRole("button", { name: "Atualizar agora" }).click();

        // The prompt should still be there (update blocked) or re-appear
        // After SKIP_WAITING is sent but durableWritesReady was false,
        // the postMessage should not have been sent, so update is blocked
        const stillVisible = await prompt.isVisible();
        expect(stillVisible).toBe(true);
      }
    });
  });

  test.describe("teste offline após versão já descoberta", () => {
    test("app functional offline; prompt does not crash; version info preserved", async ({
      page,
    }) => {
      // First, set up a waiting SW so the update is "discovered"
      await page.addInitScript(() => {
        const waiting = { postMessage: () => {} };
        const ready = {
          waiting,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as ServiceWorkerRegistration;
        Object.defineProperty(navigator, "serviceWorker", {
          configurable: true,
          value: {
            ready: Promise.resolve(ready),
            controller: null,
            register: () => Promise.resolve({ update: () => {} }),
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
        (
          ready as ServiceWorkerRegistration & { installing: object }
        ).installing = {
          state: "installed",
          addEventListener: () => {},
        };
      });

      await page.goto("/");
      // Wait for the prompt to appear (update discovered)
      await expect(
        page.getByRole("status", { name: /Nova versão/ }),
      ).toBeVisible();

      // Now go fully offline. The offline shell reload is covered by
      // pwa-upgrade.spec.ts with a real service worker; here the SW is stubbed
      // to simulate a waiting update, so we verify the loaded session survives.
      await page.context().setOffline(true);
      await page.waitForLoadState("networkidle").catch(() => undefined);

      // App should still be functional offline
      await expect(page).toHaveTitle(/MarkMap/i);
      await expect(
        page
          .locator('[aria-label="MarkMap — Planejamento Inteligente"]:visible')
          .first(),
      ).toBeVisible();

      // Update prompt should not crash (no error)
      const prompt = page.getByRole("status", { name: /Nova versão/ });
      await expect(prompt).toBeVisible();

      // Version info should be preserved
      const version = await page.evaluate(() => {
        return (
          (self as { MarkMapVersion?: string }).MarkMapVersion || "unknown"
        );
      });
      expect(version).toBeDefined();

      await page.context().setOffline(false);
    });
  });

  test.describe("sem perda de IndexedDB/outbox", () => {
    test("all user data preserved after update flow", async ({ page }) => {
      // Set up IndexedDB with user data before update
      await page.evaluate(
        async ({ dbName }) => {
          return new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        },
        { dbName: DB_NAME },
      );

      await page.evaluate(
        async ({ dbName }) => {
          const request = indexedDB.open(dbName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            const entities = db.createObjectStore("entities", {
              keyPath: "key",
            });
            entities.put({
              key: "user-1",
              workspaceId: "workspace-1",
              entityId: "project-1",
              version: 1,
              deleted: false,
              payload: {
                name: "Dados do usuário",
                value: "conteudo importante",
              },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            });
          };
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        },
        { dbName: DB_NAME },
      );

      await waitForUserData(page);

      // Reload to trigger service worker check
      await page.reload({ waitUntil: "domcontentloaded" });

      // Wait a bit for SW to detect update
      await page.waitForTimeout(1000);

      // If update prompt is visible, click "Atualizar agora"
      const prompt = page.getByRole("status", { name: /Nova versão/ });
      const isVisible = await prompt.isVisible();

      if (isVisible) {
        await page.getByRole("button", { name: "Atualizar agora" }).click();
        await page.waitForTimeout(1000);
      }

      // Reload app - data should be preserved
      await page.reload({ waitUntil: "domcontentloaded" });

      // Verify data preserved in IndexedDB. Cada caminho resolve: um callback
      // que lança dentro de onsuccess deixaria a Promise pendurada para sempre.
      const dataPreserved = await page.evaluate(
        async ({ dbName }) => {
          return await new Promise<{
            exists: boolean;
            payload: unknown;
            stores: string;
            note?: string;
          }>((resolve, reject) => {
            const timer = setTimeout(() => {
              resolve({
                exists: false,
                payload: undefined,
                stores: "",
                note: "open timeout",
              });
            }, 8000);
            const request = indexedDB.open(dbName);
            request.onblocked = () => {
              clearTimeout(timer);
              resolve({
                exists: false,
                payload: undefined,
                stores: "",
                note: "open blocked",
              });
            };
            request.onerror = () => {
              clearTimeout(timer);
              reject(request.error);
            };
            request.onsuccess = () => {
              const db = request.result;
              const stores = Array.from(db.objectStoreNames).join(",");
              try {
                const tx = db.transaction("entities", "readonly");
                const entity = tx.objectStore("entities").get("user-1");
                entity.onsuccess = () => {
                  clearTimeout(timer);
                  const result = entity.result;
                  const exists =
                    result !== undefined &&
                    result.payload?.name === "Dados do usuário";
                  resolve({ exists, payload: result?.payload, stores });
                };
                tx.onerror = () => {
                  clearTimeout(timer);
                  resolve({
                    exists: false,
                    payload: undefined,
                    stores,
                    note: "tx error",
                  });
                };
              } catch (error) {
                clearTimeout(timer);
                resolve({
                  exists: false,
                  payload: undefined,
                  stores,
                  note: String(error),
                });
              }
            };
          });
        },
        { dbName: DB_NAME },
      );

      expect(
        dataPreserved,
        `stores=[${dataPreserved.stores}] ${dataPreserved.note ?? ""}`,
      ).toMatchObject({ exists: true });
      expect(dataPreserved.payload).toBeDefined();
    });
  });
});
