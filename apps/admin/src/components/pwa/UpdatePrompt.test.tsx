import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdatePrompt from "./UpdatePrompt";

type NavigatorWithServiceWorker = Omit<Navigator, "serviceWorker"> & {
  serviceWorker?: unknown;
};

interface MockRegistration {
  waiting: { postMessage: (message: unknown) => void } | null;
  controller: unknown;
  installing: null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  delete (navigator as NavigatorWithServiceWorker).serviceWorker;
  vi.restoreAllMocks();
});

const createServiceWorkerMock = (overrides: {
  waiting: { postMessage: (message: unknown) => void } | null;
  controller: unknown;
}) => {
  const readyObj: MockRegistration = {
    waiting: overrides.waiting ?? null,
    controller: overrides.controller ?? null,
    installing: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  const listeners = new Map<string, Set<EventListener>>();

  const sw = {
    ready: Promise.resolve(readyObj),
    addEventListener: (type: string, handler: EventListener) => {
      const handlers = listeners.get(type) ?? new Set<EventListener>();
      handlers.add(handler);
      listeners.set(type, handlers);
    },
    removeEventListener: (type: string, handler: EventListener) => {
      listeners.get(type)?.delete(handler);
    },
    dispatch: (type: string) => {
      for (const handler of listeners.get(type) ?? []) handler(new Event(type));
    },
    controller: overrides.controller ?? null,
    oncontrollerchange: null,
    postMessage: null,
  };

  Object.defineProperty(navigator, "serviceWorker", {
    value: sw,
    configurable: true,
    writable: true,
  });
  return { readyObj, sw };
};

describe("UpdatePrompt", () => {
  it("should show prompt when waiting registration exists", async () => {
    createServiceWorkerMock({
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

    render(
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

  it("should not send SKIP_WAITING when durableWritesReady fails", async () => {
    const { readyObj } = createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: true,
    });

    render(
      <UpdatePrompt
        durableWritesReady={() => false}
        compatibilityReady={() => true}
      />
    );

    const button = await screen.findByRole("button", { name: "Atualizar agora" });
    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    // Falha fechada: o fluxo termina sem nunca acionar o skip-waiting
    await waitFor(() => expect(button).toBeEnabled());
    expect(readyObj.waiting?.postMessage).not.toHaveBeenCalled();
  });

  it("should handle controllerchange and reload", async () => {
    const { sw } = createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: {},
    });

    const reloadMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, reload: reloadMock } as Location,
    });

    try {
      render(<UpdatePrompt />);

      // O efeito registra o listener no serviceWorker durante o mount
      sw.dispatch("controllerchange");

      expect(reloadMock).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });

  it("should persist version check across focus/online events", async () => {
    createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: true,
    });

    render(<UpdatePrompt />);

    window.dispatchEvent(new Event("online"));

    const prompt = await screen.findByRole("status");
    expect(prompt).toBeInTheDocument();
  });
});