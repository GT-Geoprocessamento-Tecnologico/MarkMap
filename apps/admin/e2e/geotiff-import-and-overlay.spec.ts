import { expect, test } from "./fixtures";
import { Buffer } from "buffer";
import { createHash } from "node:crypto";

// Note: admin e2e runtime doesn’t depend on `geotiff`.
// We embed tiny GeoTIFF fixtures as base64 strings.
const GEO_TIFF_4326_BASE64 =
  "TU0AKgAAAAgAEAEAAAMAAAABAAEAAAEBAAMAAAABAAEAAAECAAMAAAABAAgAAAEDAAMAAAABAAEAAAEGAAMAAAABAAEAAAERAAQAAAABAAAD6AEVAAMAAAABAAEAAAEWAAQAAAABAAAAAQEXAAQAAAABAAAACAEcAAMAAAABAAEAAAExAAIAAAALAAAAzgFSAAMAAAAAAAAAAAFTAAMAAAABAAEAAIMOAAwAAAADAAAA2oSCAAwAAAAGAAAA8oevAAMAAAAIAAABIgAAAABnZW90aWZmLmpzAAA/8AAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAAAAQgAAAAAARDmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAA";

const GEO_TIFF_PROJECTED_BASE64 =
  "TU0AKgAAAAgAEAEAAAMAAAABAAEAAAEBAAMAAAABAAEAAAECAAMAAAABAAgAAAEDAAMAAAABAAEAAAEGAAMAAAABAAEAAAERAAQAAAABAAAD6AEVAAMAAAABAAEAAAEWAAQAAAABAAAAAQEXAAQAAAABAAAACAEcAAMAAAABAAEAAAExAAIAAAALAAAAzgFSAAMAAAAAAAAAAAFTAAMAAAABAAEAAIMOAAwAAAADAAAA2oSCAAwAAAAGAAAA8oevAAMAAAAIAAABIgAAAABnZW90aWZmLmpzAAA/8AAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAAAAQwAAAAAAXzvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAA";

function geoTiffFixture4326() {
  return Buffer.from(GEO_TIFF_4326_BASE64, "base64");
}

function geoTiffFixtureProjected() {
  return Buffer.from(GEO_TIFF_PROJECTED_BASE64, "base64");
}

async function importGeoTiffAndOpenWorkspace(
  page: import("@playwright/test").Page,
  bytes: Uint8Array,
  fileName: string,
) {
  await page.goto("/imports", { waitUntil: "domcontentloaded" });

  await page
    .getByLabel("Selecionar GeoJSON, GPX, KML, KMZ, GeoTIFF, PDF ou GLB")
    .setInputFiles({
      name: fileName,
      mimeType: "image/tiff",
      buffer: Buffer.from(bytes),
    });

  // ImportsPage renders a GeoTIFF row/card with an aria-label "Visualizar GeoTIFF".
  const geoTiffContainer = page.locator("div").filter({ hasText: fileName }).first();
  const openLink = geoTiffContainer.getByRole("link", { name: /Visualizar GeoTIFF/i });

  await expect(openLink).toBeVisible();
  await openLink.click();

  await expect(page).toHaveURL(/\/workspace\?geotiffId=/);
  return page;
}

test("GeoTIFF local import restores its MapLibre raster overlay after page reload", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    const e = err as { message?: string };
    consoleErrors.push(String(e.message ?? err));
  });

  await context.setOffline(false);

  const bytes = geoTiffFixture4326();
  await importGeoTiffAndOpenWorkspace(page, bytes, "map.tif");

  await expect(page.locator("[data-map-ready=\"true\"]")).toBeVisible();
  await expect(page.locator("[data-geotiff-ready=\"true\"]")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();

  // data-geotiff-ready is set only after ensureOfflineSourceLayers installs
  // the image source and its raster layer; private MapLibre canvas fields are not public.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-map-ready=\"true\"]")).toBeVisible();
  await expect(page.locator("[data-geotiff-ready=\"true\"]")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();

  await page.goto("/imports", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  expect(consoleErrors).toEqual([]);
});

test("restores an imported GeoTIFF offline after reload and in a new tab", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Offline service-worker reopening is checked in Chromium.",
  );
  test.setTimeout(120000);

  const bytes = geoTiffFixture4326();
  const expectedId = createHash("sha256").update(bytes).digest("hex");
  await importGeoTiffAndOpenWorkspace(page, bytes, "offline-map.tif");
  const expectedUrl = new URL("/workspace?geotiffId=" + expectedId, page.url()).href;
  await expect(page).toHaveURL(expectedUrl);
  await expect(page.locator('[data-geotiff-ready="true"]')).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker?.controller?.state ?? null),
    { message: "The installed worker must control the app before going offline" },
  ).toBe("activated");

  async function assertOfflineRaster(
    view: import("@playwright/test").Page,
    response: import("@playwright/test").Response | null,
  ) {
    expect(response?.status()).toBe(200);
    expect(response?.fromServiceWorker()).toBe(true);
    await expect(view).toHaveURL(expectedUrl);
    expect(await view.evaluate(() => navigator.onLine)).toBe(false);
    await expect(view.locator('[data-map-ready="true"]')).toBeVisible();
    await expect(view.locator('[data-geotiff-ready="true"]')).toBeVisible();
    await expect(view.locator(".maplibregl-canvas")).toBeVisible();
  }

  let reopened: import("@playwright/test").Page | undefined;
  try {
    await context.setOffline(true);
    await assertOfflineRaster(page, await page.reload({ waitUntil: "domcontentloaded" }));
    reopened = await context.newPage();
    await assertOfflineRaster(
      reopened,
      await reopened.goto(expectedUrl, { waitUntil: "domcontentloaded" }),
    );
  } finally {
    try {
      await context.setOffline(false);
    } finally {
      await reopened?.close();
    }
  }
});

test("GeoTIFF with projected CRS is rejected and shows an error state", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    const e = err as { message?: string };
    consoleErrors.push(String(e.message ?? err));
  });

  await context.setOffline(false);

  const bytes = geoTiffFixtureProjected();
  await importGeoTiffAndOpenWorkspace(page, bytes, "projected.tif");

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/cartografia|carregar|fundo simples/i);

  await expect(page.locator("[data-geotiff-ready=\"true\"]")).toHaveCount(0);

  expect(consoleErrors).toEqual([]);
});
