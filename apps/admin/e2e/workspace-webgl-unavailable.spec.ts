import { expect, test } from "./fixtures";

test("sem WebGL 2, o mapa não fica pronto, mas os arquivos locais continuam acessíveis", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/workspace");
  const warning = page.getByRole("alert").filter({ hasText: "não conseguiu iniciar o WebGL 2" });
  await expect(warning).toBeVisible();
  await expect(page.locator('[data-map-ready="false"]')).toHaveCount(1);
  await expect(warning.getByRole("button", { name: "Usar fundo simples offline" })).toHaveCount(0);
  await expect(warning.getByRole("button", { name: "Abrir projetos", exact: true })).toBeVisible();
  await warning.getByRole("button", { name: "Abrir arquivos locais", exact: true }).click();
  await expect(page).toHaveURL(/\/imports(?:[?#].*)?$/);
  await expect(page.getByRole("heading", { name: "Conjuntos de dados" })).toBeVisible();
});
