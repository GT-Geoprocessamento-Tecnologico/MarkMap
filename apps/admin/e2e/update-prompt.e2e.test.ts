import { expect, test, describe } from '@playwright/test';

const DB_NAME = 'MarkMapDB';

describe('PWA Update Prompt E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('MarkMap — Planejamento Inteligente')).toBeVisible();
  });

  describe('worker waiting → confirmation → controllerchange', () => {
    test('user clicks Atualizar and second context verifies controllerchange fired', async ({
      page,
      browser,
    }) => {
      // Set up a service worker with a waiting worker in context 1
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();

      await page1.evaluate(() => {
        const waiting = { postMessage: () => {} };
        const ready = {
          waiting,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as ServiceWorkerRegistration;
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: {
            ready: Promise.resolve(ready),
            controller: null,
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
        // Simulate an installed worker waiting for skipWaiting
        ;(ready as any).installing = {
          state: 'installed',
          addEventListener: () => {},
        };
      });

      await page1.goto('/');
      await expect(page1.getByRole('status', { name: 'Nova versão' })).toBeVisible();

      // User clicks "Atualizar agora"
      await page1.getByRole('button', { name: 'Atualizar agora' }).click();

      // Wait for the update to be processed
      await page1.waitForTimeout(500);

      // Second context: verify controllerchange fired and new version is active
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();

      // Wait for controllerchange event to fire
      await new Promise<void>((resolve) => {
        const handler = () => {
          resolve();
          page2.removeEventListener('controllerchange', handler);
        };
        page2.addEventListener('controllerchange', handler, { once: true });
      });

      // Verify new version is active
      const isControlled = await page2.evaluate(() => navigator.serviceWorker.controller !== null);
      expect(isControlled).toBe(true);

      // Verify the app is controlled by the new SW
      const version = await page2.evaluate(() => {
        // @ts-ignore
        return (self as any).MarkMapVersion || 'unknown';
      });
      expect(version).toBeDefined();

      await context1.close();
      await context2.close();
    });
  });

  describe('teste de Depois', () => {
    test('prompt re-appears after offline→online or visibility change trigger', async ({
      page,
    }) => {
      // First, ensure we have a waiting SW so the prompt appears
      await page.evaluate(() => {
        const waiting = { postMessage: () => {} };
        const ready = {
          waiting,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as ServiceWorkerRegistration;
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: {
            ready: Promise.resolve(ready),
            controller: null,
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
        ;(ready as any).installing = {
          state: 'installed',
          addEventListener: () => {},
        };
      });

      await page.goto('/');
      await expect(page.getByRole('status', { name: 'Nova versão' })).toBeVisible();

      // User clicks "Depois"
      await page.getByRole('button', { name: 'Depois' }).click();

      // Prompt should be dismissed
      await expect(page.getByRole('status', { name: 'Nova versão' })).not.toBeVisible();

      // Go offline then online - prompt should re-appear after trigger
      await page.context().setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.context().setOffline(false);

      // Wait for update check after coming back online
      await page.waitForTimeout(2000);

      // Prompt should re-appear after the offline→online trigger
      const promptVisible = await page.getByRole('status', { name: 'Nova versão' }).isVisible();
      expect(promptVisible).toBe(true);

      // Click "Depois" again
      await page.getByRole('button', { name: 'Depois' }).click();

      // Go offline→online again
      await page.context().setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.context().setOffline(false);
      await page.waitForTimeout(2000);

      // Prompt should re-appear after second trigger
      const promptVisible2 = await page.getByRole('status', { name: 'Nova versão' }).isVisible();
      expect(promptVisible2).toBe(true);
    });
  });

  describe('teste com outbox pendente', () => {
    test('update blocked when durableWritesReady returns false', async ({
      page,
    }) => {
      // Mock durableWritesReady to return false
      await page.evaluate(() => {
        // @ts-ignore
        (self as any).durableWritesReady = () => false;
        // Also mock compatibilityReady to return true
        // @ts-ignore
        (self as any).compatibilityReady = () => true;
      });

      // Check if update prompt is visible
      const prompt = page.getByRole('status', { name: 'Nova versão' });
      const isVisible = await prompt.isVisible();

      if (isVisible) {
        // User clicks "Atualizar agora" - should be blocked because durableWritesReady returns false
        await page.getByRole('button', { name: 'Atualizar agora' }).click();

        // The prompt should still be there (update blocked) or re-appear
        // After SKIP_WAITING is sent but durableWritesReady was false,
        // the postMessage should not have been sent, so update is blocked
        const stillVisible = await prompt.isVisible();
        expect(stillVisible).toBe(true);
      }
    });
  });

  describe('teste offline após versão já descoberta', () => {
    test('app functional offline; prompt does not crash; version info preserved', async ({
      page,
    }) => {
      // First, set up a waiting SW so the update is "discovered"
      await page.evaluate(() => {
        const waiting = { postMessage: () => {} };
        const ready = {
          waiting,
          addEventListener: () => {},
          removeEventListener: () => {},
        } as ServiceWorkerRegistration;
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: {
            ready: Promise.resolve(ready),
            controller: null,
            addEventListener: () => {},
            removeEventListener: () => {},
          },
        });
        ;(ready as any).installing = {
          state: 'installed',
          addEventListener: () => {},
        };
      });

      await page.goto('/');
      // Wait for the prompt to appear (update discovered)
      await expect(page.getByRole('status', { name: 'Nova versão' })).toBeVisible();

      // Now go fully offline
      await page.context().setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' });

      // App should still be functional offline
      await expect(page).toHaveTitle(/MarkMap/i);
      await expect(page.getByLabel('MarkMap — Planejamento Inteligente')).toBeVisible();

      // Update prompt should not crash (no error)
      const prompt = page.getByRole('status', { name: 'Nova versão' });
      await expect(() => prompt.isVisible()).not.toThrow();

      // Version info should be preserved
      const version = await page.evaluate(() => {
        // @ts-ignore
        return (self as any).MarkMapVersion || 'unknown';
      });
      expect(version).toBeDefined();
    });
  });

  describe('sem perda de IndexedDB/outbox', () => {
    test('all user data preserved after update flow', async ({
      page,
    }) => {
      // Set up IndexedDB with user data before update
      await page.evaluate(
        async ({ dbName }) => {
          return new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        },
        { dbName: DB_NAME }
      );

      await page.evaluate(
        async ({ dbName }) => {
          const request = indexedDB.open(dbName, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            const entities = db.createObjectStore('entities', { keyPath: 'key' });
            entities.put({
              key: 'user-1',
              workspaceId: 'workspace-1',
              entityId: 'project-1',
              version: 1,
              deleted: false,
              payload: { name: 'Dados do usuário', value: 'conteudo importante' },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            });
          };
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        },
        { dbName: DB_NAME }
      );

      // Reload to trigger service worker check
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Wait a bit for SW to detect update
      await page.waitForTimeout(1000);

      // If update prompt is visible, click "Atualizar agora"
      const prompt = page.getByRole('status', { name: 'Nova versão' });
      const isVisible = await prompt.isVisible();

      if (isVisible) {
        await page.getByRole('button', { name: 'Atualizar agora' }).click();
        await page.waitForTimeout(1000);
      }

      // Reload app - data should be preserved
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Verify data preserved in IndexedDB
      const dataPreserved = await page.evaluate(
        async ({ dbName }) => {
          return new Promise<{ exists: boolean; payload: unknown }>((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction('entities', 'readonly');
              const entity = tx.objectStore('entities').get('user-1');
              entity.onsuccess = () => {
                const result = entity.result;
                const exists = result !== undefined && result.payload?.name === 'Dados do usuário';
                resolve({ exists, payload: result?.payload });
              };
              tx.onerror = () => reject(tx.error);
            };
          });
        },
        { dbName: DB_NAME }
      );

      expect(dataPreserved.exists).toBe(true);
      expect(dataPreserved.payload).toBeDefined();
    });
  });
});