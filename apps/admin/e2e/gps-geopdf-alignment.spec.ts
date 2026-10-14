// Georeferenced PDF gets GPS priority only when the sensor is precise.
import { expect, test } from "@playwright/test";
import { generateGeoPdfFixture } from "../../../packages/geo/tests/pdf/fixtures/generate-geopdf";

async function openGeoPdf(page: import("@playwright/test").Page) {
  await page.goto("/imports");
  await page.getByLabel("Selecionar GeoJSON, GPX, KML, KMZ, PDF ou GLB").setInputFiles({
    name: "gps-location-geopdf.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(generateGeoPdfFixture({ includeLgiDict: false })),
  });
  await page.getByRole("link", { name: "Abrir no mapa" }).first().click();
  await expect(page.locator('[data-geopdf-ready="true"]')).toBeVisible();
}

test("a precise GPS position within GeoPDF is focused when opening the map", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 10.5, longitude: -69.5, accuracy: 12 });
  await openGeoPdf(page);
  await expect(page.getByText(/GPS ±12 m: sua posição está na área georreferenciada/)).toBeVisible();
  const deviation = await page.evaluate(() => {
    const marker = document.querySelector(".maplibregl-marker")?.getBoundingClientRect();
    const map = document.querySelector(".maplibregl-map")?.getBoundingClientRect();
    if (!marker || !map) return Infinity;
    return Math.hypot(marker.left + marker.width / 2 - map.left - map.width / 2,
      marker.top + marker.height / 2 - map.top - map.height / 2);
  });
  expect(deviation).toBeLessThan(40);
});

test("imprecise desktop geolocation leaves the map positioned by GeoPDF", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 10.5, longitude: -69.5, accuracy: 3200 });
  await openGeoPdf(page);
  await expect(page.getByText(/GPS aproximado \(±3200 m\)/)).toBeVisible();
  await expect(page.locator('[data-geopdf-ready="true"]')).toBeVisible();
});
