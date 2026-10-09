import { describe, expect, it, vi } from "vitest";
import {
  getPwaInstallSnapshot,
  initializePwaInstall,
  requestPwaInstall,
  shouldRedirectLegacyInstallPath,
} from "../lib/pwa-install";

describe("PWA install prompt lifecycle", () => {
  it("treats the old installer URL as a permanent redirect to app home", () => {
    expect(shouldRedirectLegacyInstallPath("/install")).toBe(true);
    expect(shouldRedirectLegacyInstallPath("/")).toBe(false);
    expect(shouldRedirectLegacyInstallPath("/settings")).toBe(false);
  });

  it("captures the browser install event and calls prompt after a user action", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & {
      prompt(): Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };

    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: {
        value: Promise.resolve({
          outcome: "accepted",
          platform: "web",
        }),
      },
    });

    initializePwaInstall();
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(getPwaInstallSnapshot().available).toBe(true);

    await expect(requestPwaInstall()).resolves.toBe("accepted");
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(getPwaInstallSnapshot().available).toBe(false);
    expect(getPwaInstallSnapshot().installed).toBe(false);
    window.dispatchEvent(new Event("appinstalled"));
    expect(getPwaInstallSnapshot().installed).toBe(true);
  });
});