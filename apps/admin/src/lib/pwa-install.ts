export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform?: string;
  }>;
}

export interface PwaInstallSnapshot {
  available: boolean;
  installed: boolean;
  iosSafari: boolean;
}

const listeners = new Set<() => void>();
let installPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    navigatorWithStandalone.standalone === true
  );
}

/**
 * Detect the Safari install flow without treating desktop Safari as iPadOS.
 * iPadOS desktop browsing deliberately sends a macOS-like user agent, so the
 * touch-capable MacIntel combination is the only additional iPad signal used.
 */
export function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  const navigatorWithTouch = navigator as Navigator & {
    maxTouchPoints?: number;
  };
  const classicIos = /iPad|iPhone|iPod/.test(userAgent);
  const desktopModeIpad =
    navigator.platform === "MacIntel" &&
    (navigatorWithTouch.maxTouchPoints ?? 0) > 1;
  return (
    (classicIos || desktopModeIpad) &&
    /WebKit/.test(userAgent) &&
    /Safari\//.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent)
  );
}

let snapshot: PwaInstallSnapshot = {
  available: false,
  installed: isPwaStandalone(),
  iosSafari: detectIosSafari(),
};

function publish(next: PwaInstallSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

async function preserveLocalStorageBestEffort(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistência é otimização; nunca bloqueia instalação nem trabalho local.
  }
}

/** Dedicated install route: never render the workspace in a browser install tab. */
export function shouldShowPwaInstallFlow(
  search: string,
  standalone: boolean,
): boolean {
  return !standalone && new URLSearchParams(search).get("install") === "1";
}

export function shouldRedirectLegacyInstallPath(pathname: string): boolean {
  return pathname === "/install";
}

export function initializePwaInstall(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (shouldRedirectLegacyInstallPath(window.location.pathname)) {
    window.location.replace("/");
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    const promptEvent = event as BeforeInstallPromptEvent;
    promptEvent.preventDefault();
    installPrompt = promptEvent;
    publish({
      available: true,
      installed: false,
      iosSafari: detectIosSafari(),
    });
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    publish({
      available: false,
      installed: true,
      iosSafari: detectIosSafari(),
    });
    void preserveLocalStorageBestEffort();
  });
}

export function subscribePwaInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  return snapshot;
}

export async function requestPwaInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const promptEvent = installPrompt;
  if (!promptEvent) return "unavailable";

  // prompt() must be invoked synchronously inside the user's click handler.
  // This one-use event cannot be reused after cancellation or failure.
  installPrompt = null;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    // appinstalled may fire BEFORE userChoice finishes. Never undo that event.
    const installed = snapshot.installed || isPwaStandalone();
    publish({
      available: false,
      installed,
      iosSafari: detectIosSafari(),
    });
    if (installed) void preserveLocalStorageBestEffort();
    return choice.outcome;
  } catch (error) {
    publish({
      available: false,
      installed: snapshot.installed || isPwaStandalone(),
      iosSafari: detectIosSafari(),
    });
    throw error;
  }
}
