import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UpdatePrompt from "../components/pwa/UpdatePrompt";

function installServiceWorkerStub() {
  const waiting = {
    state: "installed" as ServiceWorkerState,
    postMessage: vi.fn((message: { type?: string }, ports?: MessagePort[]) => {
      if (message.type === "CHECK_COMPATIBILITY") {
        ports?.[0]?.postMessage({
          type: "MARKMAP_COMPATIBILITY",
          shellProtocolVersion: 1,
          localSchemaVersion: 1,
          regionPackageSchemaVersion: 2,
        });
      }
    }),
  };
  const ready = new EventTarget() as ServiceWorkerRegistration;
  Object.defineProperty(ready, "waiting", {
    configurable: true,
    value: waiting,
  });
  Object.defineProperty(ready, "scope", {
    configurable: true,
    value: window.location.origin + "/",
  });
  Object.defineProperty(ready, "update", {
    configurable: true,
    value: vi.fn(async () => undefined),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve(ready),
      controller: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  return waiting;
}

describe("PWA update handshake", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fails closed when readiness callbacks are absent", async () => {
    const waiting = installServiceWorkerStub();
    render(<UpdatePrompt />);
    expect(
      await screen.findByRole("button", { name: "Atualizar agora" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar agora" }));
    await waitFor(() =>
      expect(waiting.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "SKIP_WAITING" }),
      ),
    );
  });

  it("waits for both callbacks before accepting the update", async () => {
    const waiting = installServiceWorkerStub();
    render(
      <UpdatePrompt
        durableWritesReady={() => true}
        compatibilityReady={() => true}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Atualizar agora" }),
    );
    await waitFor(() =>
      expect(waiting.postMessage).toHaveBeenCalledWith({
        type: "SKIP_WAITING",
        durableWritesReady: true,
        compatibilityVersion: 1,
      }),
    );
  });

  it("does not accept while either callback reports unsafe state", async () => {
    const waiting = installServiceWorkerStub();
    render(
      <UpdatePrompt
        durableWritesReady={() => true}
        compatibilityReady={() => false}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Atualizar agora" }),
    );
    await waitFor(() =>
      expect(waiting.postMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "SKIP_WAITING" }),
      ),
    );
  });
});
