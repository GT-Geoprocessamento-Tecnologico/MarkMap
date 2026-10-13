// Desenvolvido por MtsFerreira. Map downloads must be usable without technical URLs.
import { expect, test } from "@playwright/test";

const published = {
  version: 1,
  regions: [{
    id: "regiao-teste", label: "Região de teste", area: "Brasil",
    bounds: [-49, -8, -47, -6], sizeBytes: 3_000_000,
    attribution: "Fonte de teste licenciada",
    manifestUrl: "https://maps.example.org/test/manifest.json",
  }],
};

test("settings shows simple map discovery before advanced file import", async ({ page }) => {
  await page.route("**/maps/catalog.json", route => route.fulfill({ json: published }));
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Mapas offline" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Buscar mapas disponíveis" })).toBeVisible();
  await expect(page.getByText("Região de teste")).toBeVisible();
  await expect(page.getByRole("button", { name: "Baixar mapa" })).toBeVisible();
  await expect(page.getByLabel("Selecionar pasta do pacote de mapa offline")).toBeHidden();
  await page.getByText("Opções avançadas — importar um pacote manualmente").click();
  await expect(page.getByLabel("Selecionar pasta do pacote de mapa offline")).toBeAttached();
  await expect(page.getByLabel("Instalar por URL HTTPS de pacote regional")).toBeVisible();
});

test("map shortcut lists regions, filters by name, and closes cleanly", async ({ page }) => {
  await page.route("**/maps/catalog.json", route => route.fulfill({ json: published }));
  await page.goto("/workspace");
  const toolbar = page.getByRole("toolbar", { name: "Atalhos do mapa" });
  const button = toolbar.getByRole("button", { name: "Baixar mapas" });
  await button.click();
  const panel = page.getByRole("region", { name: "Baixar mapas" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Região de teste")).toBeVisible();
  await panel.getByRole("searchbox", { name: "Buscar mapas disponíveis" }).fill("inexistente");
  await expect(panel.getByText("Não encontramos uma região com esse nome.")).toBeVisible();
  await panel.getByRole("searchbox", { name: "Buscar mapas disponíveis" }).fill("região");
  await expect(panel.getByRole("button", { name: "Baixar mapa" })).toBeVisible();
  await panel.getByRole("button", { name: "Fechar Baixar mapas" }).click();
  await expect(panel).toHaveCount(0);
  await expect(button).toHaveAttribute("aria-pressed", "false");
});

test("empty catalog is honest and the installed map UI stays available", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText(/Ainda não há mapas regionais publicados para download/)).toBeVisible();
  await expect(page.getByText("Nenhum pacote offline instalado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gerenciar mapas no aparelho" })).toBeVisible();
});
