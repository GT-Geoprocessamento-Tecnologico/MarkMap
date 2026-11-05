import { expect, test, type Page } from "@playwright/test";
import { deflateRawSync } from "node:zlib";
import { readFile } from "node:fs/promises";

const pickerLabel = "Selecionar GeoJSON, GPX, KML, KMZ, GeoTIFF, PDF ou GLB";

// Synthetic coordinates/properties model the structure of the reported KML
// while keeping this regression fixture independent of the private user file.
const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Schema name="survey" id="survey"><SimpleField name="code" type="string" /><SimpleField name="area" type="string" /><SimpleField name="owner" type="string" /></Schema>
  <Placemark id="survey.1"><name>Área sintética</name>
    <ExtendedData><SchemaData schemaUrl="#survey"><SimpleData name="code">S-01</SimpleData><SimpleData name="area">12.5 ha</SimpleData><SimpleData name="owner">QA</SimpleData></SchemaData></ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>-40.020,-20.010,0 -39.980,-20.010,0 -39.980,-19.990,0 -40.020,-19.990,0 -40.020,-20.010,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
  </Placemark></Document></kml>`;
const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Trilha sintética</name><trkseg><trkpt lat="-20.01" lon="-40.02"><ele>100</ele></trkpt><trkpt lat="-19.99" lon="-39.98"><ele>110</ele></trkpt></trkseg></trk></gpx>`;
const geojson = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { code: "G-01" }, geometry: { type: "Point", coordinates: [-40, -20] } }] });

async function dismissInstallPrompt(page: Page) {
  const prompt = page.locator("section.pwa-install-prompt");
  try { await prompt.waitFor({ state: "visible", timeout: 2_000 }); }
  catch { return; }
  await prompt.getByRole("button", { name: "Entendi" }).click();
  await expect(prompt).toHaveCount(0);
}

function crc32(data: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of data) { value ^= byte; for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}

function kmz(contents: string): Buffer {
  const filename = Buffer.from("doc.kml");
  const data = Buffer.from(contents);
  const compressed = deflateRawSync(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(filename.length, 28);
  const centralOffset = local.length + filename.length + compressed.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(central.length + filename.length, 12); end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, filename, compressed, central, filename, end]);
}

async function importAndOpen(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, expectedFeatures: number) {
  await page.goto("/imports", { waitUntil: "domcontentloaded" });
  const input = page.getByLabel(pickerLabel);
  // The product intentionally leaves the primary picker unrestricted so OS
  // file pickers expose KML/KMZ; parser extension/MIME/size guards remain the
  // enforcement boundary. setInputFiles does not exercise the native picker.
  await input.setInputFiles(file);
  const row = page.getByRole("row").filter({ hasText: file.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText(String(expectedFeatures));
  await row.getByRole("link", { name: "Visualizar no mapa" }).click();
  await expect(page).toHaveURL(/workspace\?datasetId=/);
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible();
  await expect(page.locator("[data-feature-count]")).toHaveAttribute("data-feature-count", String(expectedFeatures));
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  return row;
}

async function expectCameraNearSyntheticArea(page: Page) {
  await page.getByRole("button", { name: "Telemetria", exact: true }).click();
  const panel = page.getByText("Posição do mapa").locator("..");
  const text = await panel.innerText();
  const latitude = Number(text.match(/Latitude\s+(-?\d+\.\d+)/)?.[1]);
  const longitude = Number(text.match(/Longitude\s+(-?\d+\.\d+)/)?.[1]);
  expect(latitude).toBeCloseTo(-20, 1);
  expect(longitude).toBeCloseTo(-40, 1);
}

test("KML with attributed Placemark imports, fits the rendered overlay, and opens its properties", async ({ page, browserName }, testInfo) => {
  test.skip(browserName === "firefox", "Run this KML regression on Chromium/WebKit device projects.");
  await importAndOpen(page, { name: "area-sintetica.kml", mimeType: "application/vnd.google-earth.kml+xml", buffer: Buffer.from(kml) }, 1);
  await dismissInstallPrompt(page);
  await expectCameraNearSyntheticArea(page);
  await page.getByRole("button", { name: "Fechar painel do mapa" }).click();
  const canvas = page.locator(".maplibregl-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  const popup = page.locator(".maplibregl-popup");
  await expect(popup).toContainText("Área sintética");
  await expect(popup).toContainText("Área: 12.5 ha");
  await expect(popup).toContainText("Proprietário: QA");
  await page.screenshot({ path: testInfo.outputPath(`kml-rendered-${browserName}.png`), fullPage: true });
  await page.goto("/imports", { waitUntil: "domcontentloaded" });
  const row = page.getByRole("row").filter({ hasText: "area-sintetica.kml" });
  const downloadPromise = page.waitForEvent("download");
  await row.getByRole("button", { name: "Exportar GeoJSON" }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.features[0]?.properties).toMatchObject({ name: "Área sintética", code: "S-01" });
});

test("KML dataset survives an offline reload", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Offline Service Worker reload is covered in Chromium; WebKit import/render is covered above.");
  await importAndOpen(page, { name: "area-sintetica.kml", mimeType: "application/vnd.google-earth.kml+xml", buffer: Buffer.from(kml) }, 1);
  await dismissInstallPrompt(page);
  await expectCameraNearSyntheticArea(page);
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service Worker indisponível");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible();
  await expect(page.locator("[data-feature-count]")).toHaveAttribute("data-feature-count", "1");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await context.setOffline(false);
});

test("GPX, KMZ, and GeoJSON representative imports create map datasets", async ({ page, browserName }) => {
  test.skip(browserName === "firefox", "Run this import regression on Chromium/WebKit device projects.");
  const cases = [
    { name: "trilha-sintetica.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(gpx) },
    { name: "trilha-sintetica.kmz", mimeType: "application/vnd.google-earth.kmz", buffer: kmz(kml) },
    { name: "ponto-sintetico.geojson", mimeType: "application/geo+json", buffer: Buffer.from(geojson) },
  ];
  for (const file of cases) {
    await importAndOpen(page, file, 1);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  }
});
