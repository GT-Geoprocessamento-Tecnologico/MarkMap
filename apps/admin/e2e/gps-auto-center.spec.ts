// Desenvolvido por MtsFerreira. GPS is from the device; only consent stays in IndexedDB.
import { expect, test } from "./fixtures";

test.describe("GPS on map startup", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Chromium PWA/Android regression");

  test("restores current position without reprompting, including offline restart", async ({ context, page }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -7.191333, longitude: -48.202555, accuracy: 18 });
    await page.goto("/workspace");

    const marker = page.locator(".maplibregl-marker").first();
    await expect(marker).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("GeoNexoLocalEngineDB", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return new Promise<unknown>((resolve) => {
        const row = db.transaction("store", "readonly").objectStore("store").get("permissions:gps");
        row.onsuccess = () => resolve(row.result?.payload ?? null);
        row.onerror = () => resolve(null);
      });
    })).toEqual({ status: "granted", autoCenter: true });

    const centered = async () => page.evaluate(() => {
      const marker = document.querySelector(".maplibregl-marker")!.getBoundingClientRect();
      const map = document.querySelector(".maplibregl-map")!.getBoundingClientRect();
      return Math.hypot(
        marker.left + marker.width / 2 - map.left - map.width / 2,
        marker.top + marker.height / 2 - map.top - map.height / 2,
      );
    });
    expect(await centered()).toBeLessThan(40);

    // Wait for the PWA shell to own this page before simulating a disconnected restart.
    await page.evaluate(() => navigator.serviceWorker.ready);
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
      await page.reload();
    }
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(marker).toBeVisible();
    expect(await centered()).toBeLessThan(40);
  });

  test("does not request GPS automatically when authorization is missing", async ({ context, page }) => {
    await context.clearPermissions();
    await page.addInitScript(() => {
      const measured = window as Window & { gpsRequestCount?: number };
      measured.gpsRequestCount = 0;
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
        configurable: true,
        value: (...args: Parameters<Geolocation["getCurrentPosition"]>) => {
          measured.gpsRequestCount! += 1;
          return original(...args);
        },
      });
    });
    await page.goto("/workspace");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => (window as Window & { gpsRequestCount?: number }).gpsRequestCount)).toBe(0);
  });
});
