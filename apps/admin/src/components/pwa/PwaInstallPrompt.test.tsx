import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaInstallPrompt } from "./PwaInstallPrompt";
import { initializePwaInstall } from "../../lib/pwa-install";

function installEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome, platform: "web" }) },
  });
  act(() => window.dispatchEvent(event));
  return { event, prompt };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PWA native install consent flow", () => {
  it("shows an installation-only screen while the browser has no install prompt", () => {
    render(<PwaInstallPrompt fullScreen />);
    expect(
      screen.getByRole("dialog", { name: "Instalar MarkMap" }),
    ).toBeTruthy();
    expect(screen.queryByText("Projetos carregados")).toBeNull();
  });

  it("opens browser native consent exactly once from a click, then stays on install completion", async () => {
    initializePwaInstall();
    const { event, prompt } = installEvent();
    expect(event.defaultPrevented).toBe(true);
    render(<PwaInstallPrompt fullScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Instalar aplicativo" }),
    );
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("dialog", { name: "Instalação autorizada" }),
    ).toBeTruthy();
    expect(screen.getByText(/abra por ele/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Instalar aplicativo" }),
    ).toBeNull();
  });

  it("respects cancelled consent without claiming the app is installed", async () => {
    initializePwaInstall();
    const { prompt } = installEvent("dismissed");
    render(<PwaInstallPrompt fullScreen />);
    fireEvent.click(
      screen.getByRole("button", { name: "Instalar aplicativo" }),
    );
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByRole("dialog", { name: "Instalação cancelada" }),
    ).toBeTruthy();
    expect(screen.queryByText("MarkMap instalado")).toBeNull();
  });

  it("keeps the regular app install banner available outside the dedicated install flow", async () => {
    initializePwaInstall();
    installEvent("dismissed");
    render(<PwaInstallPrompt />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agora não" })).toBeTruthy();
  });
});
