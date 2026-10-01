import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { generateGeoPdfFixture } from "../../../packages/geo/tests/pdf/fixtures/generate-geopdf";

const trianglePath = fileURLToPath(
  new URL("../src/test/fixtures/triangle.glb", import.meta.url),
);
const localGeoJSON = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Ponto local" },
      geometry: { type: "Point", coordinates: [-47.92, -15.78] },
    },
  ],
});

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname))
      await route.continue();
    else await route.abort();
  });
});

test("PWA mantém projeto editável após cold reload totalmente offline", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Service Worker offline acceptance runs in Chromium.");

  await page.goto("/projects");
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator))
      throw new Error("Service Worker indisponível");
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        });
      });
    }
  });

  await context.setOffline(true);
  await page.getByRole("button", { name: /Criar (Novo|Primeiro) Projeto/ }).first().click();
  await page.getByLabel("Nome do Projeto *").fill("Projeto Offline E2E");
  await page.getByLabel("Descrição do projeto").fill("Criado sem rede");
  await page.getByRole("button", { name: "Salvar Projeto" }).click();
  await expect(page.getByText("Projeto Offline E2E", { exact: true })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Projetos Cartográficos" }),
  ).toBeVisible();
  await expect(page.getByText("Projeto Offline E2E", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: /Offline|salvo neste aparelho/i }),
  ).toBeVisible();

  await page
    .getByRole("article")
    .filter({ hasText: "Projeto Offline E2E" })
    .getByRole("link", { name: "Abrir mapa" })
    .click();
  await expect(page.locator("[data-map-ready]")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByRole("button", { name: "Adicionar ponto" }).click();
  const mapSurface = page.getByTestId("map-canvas");
  const box = await mapSurface.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(
    box!.x + box!.width / 2,
    box!.y + box!.height / 2,
  );
  await expect(page.getByText("Feição salva", { exact: true })).toBeVisible();
  await expect(page.locator("[data-feature-count]")).toHaveAttribute(
    "data-feature-count",
    "1",
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-map-ready]")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect(page.locator("[data-feature-count]")).toHaveAttribute(
    "data-feature-count",
    "1",
  );

  await context.setOffline(false);
});

test("GeoPDF georreferenciado abre como mapa completamente offline", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "GeoPDF worker/map acceptance runs in Chromium.");

  await page.goto("/imports");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "mapa-georreferenciado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(generateGeoPdfFixture({ includeLgiDict: false })),
  });
  const pdfCard = page
    .getByRole("article")
    .filter({ hasText: "mapa-georreferenciado.pdf" });
  await expect(pdfCard).toBeVisible();
  await expect(
    pdfCard.getByText(/Mapa georreferenciado detectado/i),
  ).toBeVisible();

  await context.setOffline(true);
  await pdfCard.getByRole("link", { name: "Abrir no mapa" }).click();
  await expect(page).toHaveURL(/workspace\?pdfId=/);
  await expect(page.locator("[data-map-ready]")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect(page.locator("[data-geopdf-ready]")).toHaveAttribute(
    "data-geopdf-ready",
    "true",
  );
  await expect(page.getByText("Mapa PDF disponível offline.")).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-geopdf-ready]")).toHaveAttribute(
    "data-geopdf-ready",
    "true",
  );
  await context.setOffline(false);
});

test("GeoJSON local: importar, recarregar, visualizar, exportar e excluir", async ({
  page,
}) => {
  await page.goto("/imports");
  await page.locator("input[type=file]").setInputFiles({
    name: "levantamento.geojson",
    mimeType: "application/geo+json",
    buffer: Buffer.from(localGeoJSON),
  });
  const row = page.getByRole("row").filter({ hasText: "levantamento.geojson" });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(row).toBeVisible();
  const download = page.waitForEvent("download");
  await row.getByRole("button", { name: "Exportar GeoJSON" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("levantamento.geojson");
  expect(await readFile((await exported.path())!, "utf8")).toBe(localGeoJSON);
  await row.getByRole("link", { name: "Visualizar no mapa" }).click();
  await expect(page).toHaveURL(/workspace\?datasetId=/);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator("[data-map-ready]")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await expect(page.locator("[data-feature-count]")).toHaveAttribute(
    "data-feature-count",
    "1",
  );
  await page.goto("/imports");
  await row.getByRole("button", { name: "Excluir dataset" }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(row).toHaveCount(0);
});

test("malha GLB local: importar, restaurar controles e excluir", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Rendered WebGL acceptance is measured in Chromium; viewport/storage flows use all engines.",
  );
  await page.goto("/mesh");
  await expect(
    page.getByRole("heading", { name: "Estúdio de Malhas 3D" }),
  ).toBeVisible();
  await page.locator("input[type=file]").setInputFiles(trianglePath);
  await expect(
    page.locator('[aria-label="Visualização 3D da malha"] canvas'),
  ).toBeVisible();
  await expect(
    page.locator('[aria-label="Visualização 3D da malha"] canvas'),
  ).toHaveAttribute("data-mesh-ready", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({
    path: "../../docs/quality/screenshots/mesh-solid.png",
    fullPage: true,
  });
  await page.getByRole("checkbox", { name: "Wireframe" }).check();
  await page.getByRole("slider", { name: "Opacidade" }).focus();
  await page.keyboard.press("Home");
  for (let step = 0; step < 10; step++) await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("slider", { name: "Opacidade" })).toHaveValue(
    "0.5",
  );
  await page.locator("select").selectOption("front");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Visualização salva neste dispositivo" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Wireframe" })).toBeChecked();
  await expect(page.getByRole("slider", { name: "Opacidade" })).toHaveValue(
    "0.5",
  );
  await expect(page.locator("select")).toHaveValue("front");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({
    path: "../../docs/quality/screenshots/mesh-restored.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.reload();
  const mobileCanvas = page.locator(
    '[aria-label="Visualização 3D da malha"] canvas',
  );
  await expect(mobileCanvas).toHaveAttribute("data-mesh-ready", "true");
  const mobileBounds = await mobileCanvas.boundingBox();
  expect(mobileBounds).not.toBeNull();
  expect(mobileBounds!.y + mobileBounds!.height / 2).toBeLessThan(568);
  await expect(page.getByRole("slider", { name: "Opacidade" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../docs/quality/screenshots/mesh-320x568.png",
    fullPage: true,
  });
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalido.glb",
      mimeType: "model/gltf-binary",
      buffer: Buffer.from("invalid"),
    });
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: /^triangle.glb/ }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.locator('[aria-label="Visualização 3D da malha"] canvas'),
  ).toHaveAttribute("data-mesh-ready", "true");
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText("Nenhum GLB importado.")).toBeVisible();
});

test("camada real do projeto: enquadramento, popup, visibilidade e filtro", async ({
  page,
}) => {
  const projectId = "00000000-0000-4000-8000-000000000011";
  const layerId = "00000000-0000-4000-8000-000000000012";
  const timestamp = "2026-09-30T00:00:00.000Z";
  await page.addInitScript(
    ({ projectId, layerId, timestamp }) =>
      localStorage.setItem(
        "geonexo.admin.mock.v1",
        JSON.stringify({
          version: 1,
          projects: [
            {
              id: projectId,
              name: "Projeto de teste",
              description: "Projeto para verificar o mapa",
              status: "active",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
          layers: [
            {
              id: layerId,
              projectId,
              name: "Pontos do projeto",
              description: null,
              kind: "point",
              geometryType: "Point",
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
          features: [
            {
              id: "00000000-0000-4000-8000-000000000013",
              layerId,
              geometry: { type: "Point", coordinates: [-68, -30] },
              properties: { name: "Ponto do projeto" },
              version: 1,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        }),
      ),
    { projectId, layerId, timestamp },
  );
  await page.goto(`/projects/${projectId}/map`);
  const map = page.locator("[data-map-ready]");
  await expect(map).toHaveAttribute("data-map-ready", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-feature-count", "1");
  await page.locator(".maplibregl-canvas").click();
  await expect(
    page.locator(".maplibregl-popup").getByText("Ponto do projeto"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Camadas", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Selecionar dataset local" }),
  ).toHaveValue("none");
  const toggle = page.getByRole("button", {
    name: "Alternar camada Pontos do projeto",
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(map).toHaveAttribute("data-feature-count", "0");
  await toggle.click();
  await expect(map).toHaveAttribute("data-feature-count", "1");
  await page.getByRole("button", { name: "Fechar painel do mapa" }).click();
  await page.getByRole("button", { name: "Filtros", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar nas propriedades das feições" })
    .fill("inexistente");
  await expect(map).toHaveAttribute("data-feature-count", "0");
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(map).toHaveAttribute("data-feature-count", "1");
});

test("CRS persistido e tema efetivo após recarregar", async ({ page }) => {
  await page.goto("/coordinate-systems");
  await page.getByRole("button", { name: /Novo CRS/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Código do CRS" }),
  ).toBeFocused();
  await page.getByRole("textbox", { name: "Código do CRS" }).fill("EPSG:12345");
  await page
    .getByRole("textbox", { name: "Nome do CRS" })
    .fill("Referência local");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Referência local", { exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await expect(
    page.getByRole("checkbox", { name: "Tema escuro" }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Tema escuro" }).uncheck();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("gravação abortada não confirma importação nem deixa registro", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      const request = put.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort(), {
        once: true,
      });
      return request;
    };
  });
  await page.goto("/imports");
  await page.locator("input[type=file]").setInputFiles({
    name: "abortado.geojson",
    mimeType: "application/geo+json",
    buffer: Buffer.from(localGeoJSON),
  });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /abortada|gravar|gravação/i })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "abortado.geojson" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "abortado.geojson" }),
  ).toHaveCount(0);
});

for (const [width, height] of [
  [320, 568],
  [375, 812],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
  [667, 320],
] as const) {
  test(`rotas e menu acessíveis em ${width}x${height}`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    for (const [path, heading] of [
      ["/", "Projetos"],
      ["/projects", "Projetos Cartográficos"],
      ["/imports", "Conjuntos de dados"],
      ["/mesh", "Estúdio de Malhas 3D"],
      ["/settings", "Configurações do Aplicativo & Dispositivo"],
      ["/analytics", "Análises e Métricas"],
      ["/coordinate-systems", "Sistemas de Coordenadas"],
      ["/telemetry", "Telemetria do dispositivo"],
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
        `${width}x${height} ${path}; page errors: ${errors.join("; ")}`,
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (width < 768) {
        await page.getByRole("button", { name: "Abrir menu" }).click();
        await expect(
          page
            .getByRole("navigation", { name: "Navegação principal" })
            .getByRole("link", { name: /Estúdio de Malhas 3D/ }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Fechar menu" }).click();
        await expect(
          page.getByRole("navigation", { name: "Navegação principal" }),
        ).not.toBeInViewport();
      }
    }
    if (browserName === "chromium")
      await page.screenshot({
        path: `../../docs/quality/screenshots/frontend-${width}x${height}.png`,
        fullPage: true,
      });
    expect(errors).toEqual([]);
  });
}
