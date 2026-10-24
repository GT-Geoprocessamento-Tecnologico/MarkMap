// Desenvolvido por MtsFerreira. Real-device layout and location regressions.
import { expect, test } from "@playwright/test";
import { generateGeoPdfFixture } from "../../../packages/geo/tests/pdf/fixtures/generate-geopdf";

const regions = { version: 1, regions: [
  { id: "brasil", label: "Brasil", area: "Brasil",
    manifestUrl: "https://maps.example.org/brasil/manifest.json",
    bounds: [-74, -34, -34, 6], sizeBytes: 10_000_000, attribution: "Fonte de teste" },
  { id: "araguaina", label: "Araguaína", area: "Tocantins",
    manifestUrl: "https://maps.example.org/araguaina/manifest.json",
    bounds: [-48.4, -7.5, -48.0, -7.0], sizeBytes: 3_000_000, attribution: "Fonte de teste" },
] };

test("GPS granted suggests the smallest published area without downloading", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -7.19, longitude: -48.21, accuracy: 20 });
  let manifestRequests = 0;
  await page.route("**/maps/catalog.json", route => route.fulfill({ json: regions }));
  await page.route("**/manifest.json", route => {
    manifestRequests++;
    return route.abort();
  });
  await page.goto("/settings");
  await expect(page.getByText(/Mapa sugerido pelo GPS: Araguaína/)).toBeVisible();
  await expect(page.getByText("Perto de você")).toBeVisible();
  expect(manifestRequests).toBe(0);
});

test("GPS denied never automatically requests a new permission", async ({ page, context }) => {
  await context.clearPermissions();
  await page.route("**/maps/catalog.json", route => route.fulfill({ json: regions }));
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Encontrar mapa da minha localização" })).toBeVisible();
  await expect(page.getByText("Perto de você")).toHaveCount(0);
});

test("PDF previews fit narrow device screens while retaining an inspect zoom", async ({ page }) => {
  await page.goto("/imports");
  await page.getByLabel("Selecionar GeoJSON, GPX, KML, KMZ, PDF ou GLB").setInputFiles({
    name: "carta-georreferenciada.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(generateGeoPdfFixture({ includeLgiDict: false })),
  });
  const preview = page.getByLabel("Visualização ajustável do GeoPDF");
  const canvas = preview.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate(el => (el as HTMLCanvasElement).width > 1)).toBe(true);
  const start = await canvas.boundingBox();
  expect(start).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(start!.width).toBeLessThanOrEqual(viewport.width + 2);
  expect(start!.height).toBeLessThanOrEqual(viewport.height * .65 + 5);
  await page.getByRole("button", { name: "Ampliar para ler" }).click();
  const zoomed = await canvas.boundingBox();
  expect(zoomed!.height).toBeGreaterThanOrEqual(start!.height);
  await page.getByRole("button", { name: "Ajustar à tela" }).click();
  const fitted = await canvas.boundingBox();
  expect(fitted!.width).toBeCloseTo(start!.width, 0);
});

test("offline map search remains available without an online geocoder", async ({ page }) => {
  await page.goto("/workspace");
  await page.getByRole("toolbar", { name: "Atalhos do mapa" })
    .getByRole("button", { name: "Buscar locais neste mapa" }).click();
  const panel = page.getByRole("region", { name: "Buscar locais neste mapa" });
  await expect(panel.getByRole("searchbox", { name: "Pesquisar feições offline" })).toBeVisible();
  await expect(panel.getByText(/Busca offline disponível/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Buscar endereço na internet" })).toHaveCount(0);
});
