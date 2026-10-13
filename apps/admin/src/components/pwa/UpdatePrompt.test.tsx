import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpdatePrompt from "./UpdatePrompt";

type NavigatorWithServiceWorker = Omit<Navigator, "serviceWorker"> & {
  serviceWorker?: unknown;
};

type WaitingMock = { state: 'installed'; postMessage: ReturnType<typeof vi.fn> };

interface MockRegistration {
  scope: string;
  waiting: WaitingMock | null;
  controller: unknown;
  installing: null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
}

beforeEach(() => {
  delete (navigator as NavigatorWithServiceWorker).serviceWorker;
  vi.restoreAllMocks();
  // jsdom does not consistently provide MessageChannel; emulate the real handshake.
  class TestMessageChannel {
    port1 = { onmessage: null as ((event: MessageEvent) => void) | null, close() {} };
    port2 = {
      postMessage: (data: unknown) => this.port1.onmessage?.({ data } as MessageEvent),
      close() {},
    };
  }
  vi.stubGlobal('MessageChannel', TestMessageChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const createServiceWorkerMock = (overrides: {
  waiting: { postMessage: (message: unknown) => void } | null;
  controller: unknown;
}) => {
  const readyObj: MockRegistration = {
    scope: `${window.location.origin}/`,
    waiting: overrides.waiting ? {
      state: 'installed',
      postMessage: vi.fn((message: unknown, ports?: Array<{ postMessage: (data: unknown) => void }>) => {
        if ((message as { type?: string })?.type === 'CHECK_COMPATIBILITY') {
          ports?.[0]?.postMessage({
            type: 'MARKMAP_COMPATIBILITY', shellProtocolVersion: 1,
            localSchemaVersion: 1, regionPackageSchemaVersion: 2,
          });
        }
        overrides.waiting?.postMessage(message);
      }),
    } : null,
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
    expect(screen.getByText("MarkMap tem novidades")).toBeInTheDocument();
    expect(screen.getByText(/dados locais antes de atualizar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar agora" })).toHaveClass("pwa-update-prompt__primary");
    expect(screen.getByRole("button", { name: "Depois" })).toHaveClass("pwa-update-prompt__secondary");
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
      />
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
    // Compatibility handshake may post a message, but activation must not.
    expect(readyObj.waiting?.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "SKIP_WAITING" })
    );
  });

  it("ignores a waiting worker outside the active service-worker scope", async () => {
    const { readyObj } = createServiceWorkerMock({
      waiting: { postMessage: vi.fn() },
      controller: {},
    });
    readyObj.scope = "https://unrelated.example/";
    render(<UpdatePrompt />);
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
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