import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdatePrompt from "./UpdatePrompt";

beforeEach(() => {
  delete (navigator as any).serviceWorker;
  vi.restoreAllMocks();
});

const createServiceWorkerMock = (overrides: {
  waiting: { postMessage: any } | null;
  controller: boolean | null;
}) => {
  const readyObj: any = {
    waiting: overrides.waiting ?? null,
    controller: overrides.controller ?? null,
    installing: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  const sw: any = {
    ready: Promise.resolve(readyObj),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    controller: overrides.controller ?? null,
    oncontrollerchange: null,
    postMessage: null,
  };

  (navigator as any).serviceWorker = sw;
  return { readyObj, sw };
};

describe("UpdatePrompt", () => {
  it("should show prompt when waiting registration exists", async () => {
    const { readyObj } = createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: null,
    });

    render(<UpdatePrompt />);

    await waitFor(() =>
      expect(screen.getByRole("status")).toBeInTheDocument()
    );
  });

  it("should not show prompt when no waiting registration", () => {
    createServiceWorkerMock({
      waiting: null,
      controller: null,
    });

    const result = render(<UpdatePrompt />);
    expect(result.container.querySelector(".pwa-update-prompt")).toBeNull();
  });

  it("should enable Atualizar when both durableWritesReady and compatibilityReady pass", async () => {
    const { readyObj } = createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: true,
    });

    const { rerender } = render(
      <UpdatePrompt
        durableWritesReady={() => true}
        compatibilityReady={() => true}
      >
      </UpdatePrompt>
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Atualizar agora" })).not.toBeDisabled()
    );

    const button = screen.getByRole("button", { name: "Atualizar agora" });
    await userEvent.click(button);

    expect(readyObj.waiting?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SKIP_WAITING",
        durableWritesReady: true,
        compatibilityVersion: 1,
      })
    );
  });

  it("should disable Atualizar when durableWritesReady fails", async () => {
    const { readyObj } = createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: true,
    });

    const { unmount } = render(
      <UpdatePrompt
        durableWritesReady={() => false}
        compatibilityReady={() => true}
      >
      </UpdatePrompt>
    );

    const button = screen.getByRole("button", { name: "Atualizar agora" });
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    await waitFor(() =>
      expect(button).toBeDisabled()
    );

    expect(screen.getByText("Verificando…")).toBeInTheDocument();

    unmount();
  });

  it("should handle controllerchange and reload", () => {
    createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: null,
    });

    const reloadMock = vi.fn();
    Object.defineProperty(window.location, "reload", {
      value: reloadMock,
      writable: true,
      configurable: true,
    });

    render(<UpdatePrompt />);

    window.dispatchEvent(new Event("controllerchange"));

    expect(reloadMock).toHaveBeenCalled();
  });

  it("should persist version check across focus/online events", () => {
    createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: true,
    });

    render(<UpdatePrompt />);

    window.dispatchEvent(new Event("online"));

    const prompt = screen.getByRole("status");
    expect(prompt).toBeInTheDocument();
  });
});