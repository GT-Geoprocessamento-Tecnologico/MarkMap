import { describe, expect, it, vi } from "vitest";
import {
  getPwaInstallSnapshot,
  detectIosSafari,
  shouldShowPwaInstallFlow,
  initializePwaInstall,
  requestPwaInstall,
  shouldRedirectLegacyInstallPath,
} from "../lib/pwa-install";

describe("PWA install prompt lifecycle", () => {
  function setNavigatorIdentity({
    userAgent,
    platform,
    maxTouchPoints,
  }: {
    userAgent: string;
    platform: string;
    maxTouchPoints: number;
  }): void {
    Object.defineProperties(navigator, {
      userAgent: { configurable: true, value: userAgent },
      platform: { configurable: true, value: platform },
      maxTouchPoints: { configurable: true, value: maxTouchPoints },
    });
  }

  it.each([
    [
      "classic iPhone Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "iPhone",
      5,
      true,
    ],
    [
      "classic iPad Safari",
      "Mozilla/5.0 (iPad; CPU OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "iPad",
      5,
      true,
    ],
    [
      "desktop-mode iPad Safari",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
      "MacIntel",
      5,
      true,
    ],
    [
      "macOS Safari",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
      "MacIntel",
      0,
      false,
    ],
    [
      "iPad Chrome",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Safari/605.1.15",
      "MacIntel",
      5,
      false,
    ],
  ])(
    "recognizes %s correctly",
    (_label, userAgent, platform, maxTouchPoints, expected) => {
      setNavigatorIdentity({ userAgent, platform, maxTouchPoints });
      expect(detectIosSafari()).toBe(expected);
    },
  );

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
  it("opens the dedicated installer only for install=1 outside standalone", () => {
    expect(shouldShowPwaInstallFlow("?install=1", false)).toBe(true);
    expect(shouldShowPwaInstallFlow("?foo=bar&install=1", false)).toBe(true);
    expect(shouldShowPwaInstallFlow("?install=1", true)).toBe(false);
    expect(shouldShowPwaInstallFlow("", false)).toBe(false);
    expect(shouldShowPwaInstallFlow("?install=0", false)).toBe(false);
  });

  it("does not reverse an appinstalled event that arrives before userChoice", async () => {
    const prompt = vi.fn(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    const event = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & {
      prompt(): Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: {
        value: Promise.resolve({ outcome: "accepted", platform: "web" }),
      },
    });
    window.dispatchEvent(event);
    await expect(requestPwaInstall()).resolves.toBe("accepted");
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(getPwaInstallSnapshot().installed).toBe(true);
  });
});
