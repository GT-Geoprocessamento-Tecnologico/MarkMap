// Desenvolvido por MtsFerreira — regression for light/dark PWA surfaces.
import { expect, test, type Page } from "@playwright/test";
const surfaces = async (page: Page) => {
  // Reload can finish before React mounts the shell, particularly in WebKit.
  for (const selector of [".markmap-shell-header", ".markmap-shell-sidebar", ".markmap-app-main"]) {
    await expect(page.locator(selector)).toBeAttached();
  }
  return page.evaluate(() => {
    const color = (selector: string) =>
      getComputedStyle(document.querySelector(selector)!).backgroundColor;
    return {
      header: color(".markmap-shell-header"),
      sidebarInk: getComputedStyle(document.querySelector(".markmap-shell-sidebar")!)
        .getPropertyValue("--text-primary").trim(),
      sidebarBackground: getComputedStyle(document.querySelector(".markmap-shell-sidebar")!)
        .backgroundImage,
      main: color(".markmap-app-main"),
      dark: document.documentElement.classList.contains("dark"),
    };
  });
};
test("theme changes header, sidebar, content and persists on reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  const dark = await surfaces(page);
  expect(dark.dark).toBe(true);
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  const light = await surfaces(page);
  expect(light.dark).toBe(false);
  expect(light.header).not.toBe(dark.header);
  expect(light.sidebarInk).not.toBe(dark.sidebarInk);
  expect(light.sidebarBackground).not.toBe(dark.sidebarBackground);
  expect(light.main).not.toBe(dark.main);
  await page.reload();
  expect((await surfaces(page)).dark).toBe(false);
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  expect((await surfaces(page)).dark).toBe(true);
});
test("map controls and offline canvas respect the current appearance", async ({ page }) => {
  await page.goto("/workspace");
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  const map = page.locator(".markmap-workspace");
  await expect(map).toBeVisible();
  const dark = await map.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  const light = await map.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(light).not.toBe(dark);
  await expect(map).toHaveCSS("color-scheme", "light");
});
test("standalone install guide uses the saved light theme", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.goto("/?install=1");
  const gate = page.locator(".pwa-install-gate");
  await expect(gate).toBeVisible();
  expect(await gate.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe("rgb(6, 19, 26)");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
