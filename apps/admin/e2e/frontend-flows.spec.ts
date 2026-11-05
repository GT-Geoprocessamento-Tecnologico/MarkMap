import { expect, test, type Page } from "./fixtures";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { generateGeoPdfFixture } from "../../../packages/geo/tests/pdf/fixtures/generate-geopdf";

/** No Safari o prompt de instalação fica fixo sobre o conteúdo e intercepta cliques. */
async function dismissInstallPrompt(page: Page): Promise<void> {
  const prompt = page.locator("section.pwa-install-prompt");
  try {
    await prompt.waitFor({ state: "visible", timeout: 3_000 });
  } catch {
    return;
  }
  await prompt.getByRole("button", { name: "Entendi" }).click();
  await expect(prompt).toHaveCount(0);
}

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
  // O aplicativo é local-first: ficar offline é o caminho normal, então o banner
  // de conectividade é esperado. O que não pode aparecer é um status de erro ou
  // de sincronização pendente, porque o projeto acabou de ser criado e nada foi
  // perdido.
  await expect(
    page.getByRole("status").filter({ hasText: /erro|falha|pendente|sincroniza/i }),
  ).toHaveCount(0);
  await expect(page.getByText(/Erro|Falha|não foi possível/i)).toHaveCount(0);

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
  // startDrawing é assíncrono: aguardar o modo ativo antes de clicar no mapa,
  // senão o clique é engolido quando a máquina está sob carga.
  await expect(page.getByText("Toque no mapa para salvar o ponto")).toBeVisible();
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
  await expect(
    page.getByText(
      "GeoPDF disponível offline. Para ver ruas ao redor, conecte-se à internet.",
      { exact: true },
    ),
  ).toBeVisible();

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
  expect(JSON.parse(await readFile((await exported.path())!, "utf8"))).toEqual(
    JSON.parse(localGeoJSON),
  );
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
  await row.getByRole("button", { name: "Excluir levantamento.geojson" }).click();
  await expect(row.getByText(/A cópia local, geometria e visualização serão removidas/)).toBeVisible();
  await row.getByRole("button", { name: "Confirmar exclusão de levantamento.geojson" }).click();
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

test("camada real do projeto: enquadramento, seleção de ponto, visibilidade e filtro", async ({
  page,
}) => {
  const projectId = "00000000-0000-4000-8000-000000000011";
  const layerId = "00000000-0000-4000-8000-000000000012";
  const timestamp = "2026-09-30T00:00:00.000Z";
  // The app owns projects, layers and features in IndexedDB (not the legacy mock localStorage).
  // Seed only this disposable browser context, following the backup E2E IDB fixture shape.
  await page.goto("/projects");
  await expect(page.getByText("Nenhum projeto encontrado")).toBeVisible();
  await page.evaluate(async ({ projectId, layerId, timestamp }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("GeoNexoLocalFirstDB");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const workspaceId = await new Promise<string>((resolve, reject) => {
        const request = db.transaction("meta", "readonly").objectStore("meta").get("workspaceId");
        request.onsuccess = () => {
          if (typeof request.result?.value === "string") resolve(request.result.value);
          else reject(new Error("Workspace local não inicializado."));
        };
        request.onerror = () => reject(request.error);
      });
      const entities = [
        { entity: "project", id: projectId, data: {
          id: projectId, name: "Projeto de teste",
          description: "Projeto para verificar o mapa", status: "active",
          createdAt: timestamp, updatedAt: timestamp,
        } },
        { entity: "layer", id: layerId, data: {
          id: layerId, projectId, name: "Pontos do projeto", description: null,
          kind: "point", geometryType: "Point", srid: 4674, style: {},
          metadata: {}, visibleByDefault: true, sortOrder: 0,
          createdAt: timestamp, updatedAt: timestamp,
        } },
        { entity: "feature", id: "00000000-0000-4000-8000-000000000013", data: {
          id: "00000000-0000-4000-8000-000000000013", layerId,
          geometry: { type: "Point", coordinates: [-68, -30] },
          properties: { name: "Ponto do projeto" }, version: 1,
          createdAt: timestamp, updatedAt: timestamp,
        } },
      ] as const;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("entities", "readwrite");
        const store = tx.objectStore("entities");
        for (const item of entities) {
          store.put({
            key: `${workspaceId}:${item.entity}:${item.id}`, workspaceId,
            entity: item.entity, entityId: item.id, version: 0, deleted: false,
            updatedAt: timestamp, payload: { entity: item.entity, data: item.data },
          });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, { projectId, layerId, timestamp });
  await page.goto(`/projects/${projectId}/map`);
  await expect(page.getByTestId("active-project-indicator")).toContainText("Projeto de teste");
  const map = page.locator("[data-map-ready]");
  await expect(map).toHaveAttribute("data-map-ready", "true");
  await dismissInstallPrompt(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-feature-count", "1");
  await page.locator(".maplibregl-canvas").click();
  // Project-owned points open their editable point panel, not a dataset popup.
  const pointPanel = page.getByRole("region", { name: "Gerenciar pontos do projeto" });
  await expect(pointPanel).toBeVisible();
  await expect(pointPanel.getByRole("textbox", { name: "Nome do ponto" })).toHaveValue("Ponto do projeto");
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

test("GPS do dispositivo funciona e mantém a experiência local-first", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Geolocation acceptance runs in Chromium.");

  await page.goto("/settings");
  const origin = new URL(page.url()).origin;
  await context.grantPermissions(["geolocation"], {
    origin,
  });
  await context.setGeolocation({
    latitude: -7.191,
    longitude: -48.207,
    accuracy: 8,
  });

  await page.getByRole("button", { name: "Solicitar localização" }).click();

  await expect(page.getByText("Permissão concedida", { exact: true })).toBeVisible();
  await expect(page.getByText("Localização obtida", { exact: true })).toBeVisible();
  await expect(page.getByText(/-7\.19100, -48\.20700 \(precisão 8 m\)/)).toBeVisible();
});

test("CRS persistido e tema efetivo após recarregar", async ({ page }) => {
  await page.goto("/coordinate-systems");
  await dismissInstallPrompt(page);
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
  const themeToggle = page.getByRole("button", { name: "Ativar tema claro" });
  await expect(themeToggle).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await themeToggle.click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Ativar tema escuro" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Ativar tema escuro" }),
  ).toBeVisible();
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
      ["/telemetry", "Telemetria indisponível"],
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
            .getByRole("navigation", { name: "Navegação principal", exact: true })
            .getByRole("link", { name: /Estúdio de Malhas 3D/ }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Fechar menu" }).click();
        await expect(
          page.getByRole("navigation", { name: "Navegação principal", exact: true }),
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
