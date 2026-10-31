import { expect, test, type Page } from "@playwright/test";

/**
 * Simulate an already installed shell and a new worker. Unlike the retired
 * waiting-only fixture, this mock implements GET_SHELL_STATUS and starts with
 * a controller, exactly as the consent protocol requires. No production data.
 */
async function mockInstalledUpdate(page: Page, mode: "waiting" | "active") {
  await page.addInitScript(({ mode }) => {
    const events: string[] = [];
    const listeners = new Map<string, Set<() => void>>();
    const addEventListener = (event: string, fn: () => void) => {
      const set = listeners.get(event) || new Set<() => void>();
      set.add(fn);
      listeners.set(event, set);
    };
    const removeEventListener = (event: string, fn: () => void) => {
      listeners.get(event)?.delete(fn);
    };
    const dispatch = (event: string) => {
      for (const fn of listeners.get(event) || []) fn();
    };
    let approved = false;
    const status = () => ({
      type: "MARKMAP_SHELL_STATUS",
      protocol: 1,
      approvedShell: approved ? "markmap-cache-new" : "markmap-cache-old",
      approvedVersion: approved ? "0.5.19" : "0.5.18",
      availableShell: "markmap-cache-new",
      availableVersion: "0.5.19",
      updateAvailable: !approved,
      candidateReady: true,
    });
    const newWorker = {
      state: "installed",
      postMessage(message: { type?: string }, ports?: MessagePort[]) {
        events.push(message.type || "unknown");
        if (message.type === "GET_SHELL_STATUS") ports?.[0]?.postMessage(status());
        if (message.type === "CHECK_COMPATIBILITY") ports?.[0]?.postMessage({
          type: "MARKMAP_COMPATIBILITY", shellProtocolVersion: 1,
          localSchemaVersion: 1, regionPackageSchemaVersion: 2,
        });
        if (message.type === "SKIP_WAITING") {
          registration.waiting = null;
          registration.active = newWorker;
          container.controller = newWorker;
          dispatch("controllerchange");
        }
        if (message.type === "APPROVE_SHELL") {
          approved = true;
          window.localStorage.setItem("markmap-qa-upgrade-approved", "yes");
          ports?.[0]?.postMessage({ type: "MARKMAP_SHELL_APPROVAL", approved: true });
        }
      },
    };
    const oldWorker = { state: "activated", postMessage() {} };
    const registration = {
      scope: window.location.origin + "/",
      waiting: mode === "waiting" ? newWorker : null as typeof newWorker | null,
      installing: null,
      active: mode === "waiting" ? oldWorker : newWorker,
      update: async () => undefined,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const container = {
      ready: Promise.resolve(registration),
      controller: mode === "waiting" ? oldWorker : newWorker,
      register: async () => registration,
      addEventListener,
      removeEventListener,
    };
    (window as unknown as { __markmapPwaEvents: string[] }).__markmapPwaEvents = events;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true, value: container,
    });
  }, { mode });
  await page.goto("/");
}

test.describe("PWA — consentimento antes de atualizar", () => {
  test("exibe modal, preserva a versão após Depois e reabre manualmente", async ({ page }) => {
    await mockInstalledUpdate(page, "waiting");
    const dialog = page.getByRole("dialog", { name: /Nova versão do MarkMap/ });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toContainText("0.5.19");
    expect(await page.evaluate(() =>
      window.localStorage.getItem("markmap-qa-upgrade-approved"))).toBeNull();
    await dialog.getByRole("button", { name: "Depois" }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(dialog).not.toBeVisible();

    // Settings delegates to this exact app event. It can show the consent UI,
    // but must not call SKIP_WAITING or APPROVE_SHELL on its own.
    const result = await page.evaluate(() => new Promise<unknown>((resolve) => {
      window.dispatchEvent(new CustomEvent("markmap:pwa-update-request", {
        cancelable: true, detail: { respond: resolve },
      }));
    }));
    expect(result).toEqual({ status: "pending" });
    await expect(dialog).toBeVisible();
    const messages = await page.evaluate(() =>
      (window as unknown as { __markmapPwaEvents: string[] }).__markmapPwaEvents);
    expect(messages).not.toContain("APPROVE_SHELL");
    expect(messages).not.toContain("SKIP_WAITING");
  });

  test("só aplica a atualização após clicar Atualizar agora", async ({ page }) => {
    await mockInstalledUpdate(page, "waiting");
    const dialog = page.getByRole("dialog", { name: /Nova versão do MarkMap/ });
    await expect(dialog).toBeVisible();
    const before = await page.evaluate(() =>
      (window as unknown as { __markmapPwaEvents: string[] }).__markmapPwaEvents);
    expect(before).not.toContain("APPROVE_SHELL");
    await dialog.getByRole("button", { name: "Atualizar agora" }).click();
    await expect.poll(() => page.evaluate(() =>
      window.localStorage.getItem("markmap-qa-upgrade-approved"))).toBe("yes");
    expect(await page.evaluate(() =>
      window.localStorage.getItem("markmap-qa-upgrade-approved"))).toBe("yes");
  });

  test("worker já ativado naturalmente também exige aceite", async ({ page }) => {
    await mockInstalledUpdate(page, "active");
    const dialog = page.getByRole("dialog", { name: /Nova versão do MarkMap/ });
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() =>
      window.localStorage.getItem("markmap-qa-upgrade-approved"))).toBeNull();
    await dialog.getByRole("button", { name: "Depois" }).click();
    expect(await page.evaluate(() =>
      window.localStorage.getItem("markmap-qa-upgrade-approved"))).toBeNull();
  });
});
