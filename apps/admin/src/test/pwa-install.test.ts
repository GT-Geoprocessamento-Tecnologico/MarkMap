import { describe, expect, it, vi } from "vitest";
import {
  getPwaInstallSnapshot,
  initializePwaInstall,
  requestPwaInstall,
} from "../lib/pwa-install";

describe("PWA install prompt lifecycle", () => {
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
    expect(getPwaInstallSnapshot().installed).toBe(true);
  });
});
