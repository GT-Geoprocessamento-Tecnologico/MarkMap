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

function detectStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    navigatorWithStandalone.standalone === true
  );
}

function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(userAgent) &&
    /WebKit/.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS/.test(userAgent)
  );
}

let snapshot: PwaInstallSnapshot = {
  available: false,
  installed: detectStandalone(),
  iosSafari: detectIosSafari(),
};

function publish(next: PwaInstallSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function initializePwaInstall(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

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

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  installPrompt = null;

  publish({
    available: false,
    installed: choice.outcome === "accepted" || detectStandalone(),
    iosSafari: detectIosSafari(),
  });

  return choice.outcome;
}
