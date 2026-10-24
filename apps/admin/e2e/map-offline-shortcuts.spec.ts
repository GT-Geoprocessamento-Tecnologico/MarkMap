// Desenvolvido por MtsFerreira. Offline services stay mounted; only panels toggle.
import { expect, test } from "@playwright/test";

const offlineTools = [
  "Buscar locais neste mapa",
  "Lugares e transporte offline",
  "Altitude",
  "Navegação GPS offline",
] as const;

test("offline shortcuts reuse the map toolbar without orphan panels", async ({ page }) => {
  await page.goto("/workspace");
  const toolbar = page.getByRole("toolbar", { name: "Atalhos do mapa" });
  await expect(toolbar).toBeVisible();
  for (const name of offlineTools) {
    const shortcut = toolbar.getByRole("button", { name, exact: true });
    const panel = page.getByRole("region", { name, exact: true });
    await expect(shortcut).toHaveCount(1);
    await expect(panel).toHaveCount(0);
    await shortcut.click();
    await expect(panel).toBeVisible();
    await expect(shortcut).toHaveAttribute("aria-pressed", "true");
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      const panelBounds = await panel.boundingBox();
      const toolbarBounds = await toolbar.boundingBox();
      expect(panelBounds).not.toBeNull();
      expect(toolbarBounds).not.toBeNull();
      // On mobile the sheet must stay above, not on top of, the shortcut bar.
      expect(panelBounds!.y + panelBounds!.height).toBeLessThanOrEqual(toolbarBounds!.y + 4);
    }
    await panel.getByRole("button", { name: "Fechar " + name }).click();
    await expect(panel).toHaveCount(0);
    await expect(shortcut).toHaveAttribute("aria-pressed", "false");
  }
  await toolbar.getByRole("button", { name: "Telemetria" }).click();
  await expect(page.getByRole("button", { name: "Fechar painel do mapa" })).toBeVisible();
  await toolbar.getByRole("button", { name: "Navegação GPS offline" }).click();
  await expect(page.getByRole("button", { name: "Fechar painel do mapa" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Navegação GPS offline" })
    .getByRole("button", { name: "Destino no mapa" })).toBeVisible();
});
