import { test as base } from "@playwright/test";
export { expect } from "@playwright/test";
export type { Page, BrowserContext, Route } from "@playwright/test";

// An iOS Safari tab displays a dismissible install banner, even when
// testing ordinary app flows. Click its real user-facing action before
// interacting with controls it would otherwise cover.
export const test = base.extend({
  page: async ({ page }, providePage, testInfo) => {
    if (testInfo.project.name === "iphone-13" && !testInfo.file.endsWith("/update-prompt.e2e.test.ts")) {
      const banner = page.locator("section.pwa-install-prompt").filter({
        has: page.getByRole("button", { name: "Entendi", exact: true }),
      });
      await page.addLocatorHandler(banner, async (visibleBanner) => {
        await visibleBanner.getByRole("button", { name: "Entendi", exact: true }).click();
      });
    }
    await providePage(page);
  },
});
