import { expect, test } from "@playwright/test";
import { Buffer } from "buffer";

// Note: admin e2e runtime doesn’t depend on `geotiff`.
// We embed tiny GeoTIFF fixtures as base64 strings.
const GEO_TIFF_4326_BASE64 =
  "TU0AKgAAAAgAEAEAAAMAAAABAAEAAAEBAAMAAAABAAEAAAECAAMAAAABAAgAAAEDAAMAAAABAAEAAAEGAAMAAAABAAEAAAERAAQAAAABAAAD6AEVAAMAAAABAAEAAAEWAAQAAAABAAAAAQEXAAQAAAABAAAACAEcAAMAAAABAAEAAAExAAIAAAALAAAAzgFSAAMAAAAAAAAAAAFTAAMAAAABAAEAAIMOAAwAAAADAAAA2oSCAAwAAAAGAAAA8oevAAMAAAAIAAABIgAAAABnZW90aWZmLmpzAAA/8AAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAAAAQgAAAAAARDmAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAA";

const GEO_TIFF_PROJECTED_BASE64 =
  "TU0AKgAAAAgAEAEAAAMAAAABAAEAAAEBAAMAAAABAAEAAAECAAMAAAABAAgAAAEDAAMAAAABAAEAAAEGAAMAAAABAAEAAAERAAQAAAABAAAD6AEVAAMAAAABAAEAAAEWAAQAAAABAAAAAQEXAAQAAAABAAAACAEcAAMAAAABAAEAAAExAAIAAAALAAAAzgFSAAMAAAAAAAAAAAFTAAMAAAABAAEAAIMOAAwAAAADAAAA2oSCAAwAAAAGAAAA8oevAAMAAAAIAAABIgAAAABnZW90aWZmLmpzAAA/8AAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQABAAAAAQwAAAAAAXzvAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAA";

function geoTiffFixture4326() {
  return Buffer.from(GEO_TIFF_4326_BASE64, "base64").buffer;
}

function geoTiffFixtureProjected() {
  return Buffer.from(GEO_TIFF_PROJECTED_BASE64, "base64").buffer;
}

async function importGeoTiffAndOpenWorkspace(
  page: import("@playwright/test").Page,
  bytes: ArrayBuffer,
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

async function readGeoTiffOverlayLayerInfo(
  page: import("@playwright/test").Page,
) {
  return page.evaluate(() => {
    const canvasEl = document.querySelector(".maplibregl-canvas");
    const canvas = canvasEl as unknown as {
      _map?: unknown;
      __map?: unknown;
      map?: unknown;
      __maplibregl?: unknown;
      parentElement?: { _map?: unknown; __map?: unknown } | null;
      __mapInstance?: unknown;
      maplibreMap?: unknown;
    } | null;
    if (!canvas) return { foundMap: false };

    const candidates: unknown[] = [
      canvas._map,
      canvas.__map,
      canvas.map,
      canvas.__maplibregl,
      canvas.parentElement?._map,
      canvas.parentElement?.__map,
      canvas.__mapInstance,
      canvas.maplibreMap,
    ].filter((v): v is unknown => Boolean(v));

    const map = candidates.find(
      (m) => m && typeof m.getLayer === "function" && typeof m.getSource === "function",
    );
    if (!map) return { foundMap: false };

    const layer = map.getLayer?.("geotiff-overlay");
    const source = map.getSource?.("geotiff-overlay");

    let opacity: unknown = null;
    try {
      opacity = map.getPaintProperty?.("geotiff-overlay", "raster-opacity");
    } catch {}

    let visibility: unknown = null;
    try {
      visibility = map.getLayoutProperty?.("geotiff-overlay", "visibility");
    } catch {}

    let sourceLoaded: unknown = null;
    try {
      sourceLoaded = map.isSourceLoaded?.("geotiff-overlay");
    } catch {}

    return {
      foundMap: true,
      layerExists: Boolean(layer),
      layerType: layer?.type,
      opacity,
      visibility,
      sourceExists: Boolean(source),
      sourceType: source?.type ?? source?._type ?? source?._sourceType,
      sourceLoaded,
    };
  });
}

test("GeoTIFF local import renders as a MapLibre raster overlay (geotiff-overlay)", async ({
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

  const overlayInfo = await readGeoTiffOverlayLayerInfo(page);
  expect(overlayInfo.foundMap).toBe(true);
  expect(overlayInfo.layerExists).toBe(true);
  expect(overlayInfo.layerType).toBe("raster");
  expect(overlayInfo.sourceExists).toBe(true);

  if (typeof overlayInfo.opacity === "number") expect(overlayInfo.opacity).toBeGreaterThan(0);
  if (overlayInfo.visibility) expect(overlayInfo.visibility).not.toBe("none");

  await page.goto("/imports", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  expect(consoleErrors).toEqual([]);
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

  const overlayInfo = await readGeoTiffOverlayLayerInfo(page);
  if (overlayInfo.foundMap) expect(overlayInfo.layerExists).toBe(false);

  expect(consoleErrors).toEqual([]);
});
