export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform?: string;
  }>;
}

export interface AppInstallSnapshot {
  available: boolean;
  installed: boolean;
  iosSafari: boolean;
  notice: string | null;
}

const listeners = new Set<() => void>();
let installPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;

function detectInstalled(): boolean {
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

let snapshot: AppInstallSnapshot = {
  available: false,
  installed: detectInstalled(),
  iosSafari: detectIosSafari(),
  notice: null,
};

function publish(next: Partial<AppInstallSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

export function initializeAppInstall(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    const promptEvent = event as BeforeInstallPromptEvent;
    promptEvent.preventDefault();
    installPrompt = promptEvent;
    publish({ available: true, installed: false });
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    publish({
      available: false,
      installed: true,
      notice: "MarkMap instalado com sucesso.",
    });
  });
}

export function subscribeAppInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAppInstallSnapshot(): AppInstallSnapshot {
  return snapshot;
}

export function dismissAppInstallNotice(): void {
  publish({ notice: null });
}

export async function requestAppInstall(): Promise<void> {
  if (snapshot.installed) {
    publish({ notice: "O app MarkMap já está instalado neste dispositivo." });
    return;
  }

  if (installPrompt) {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    publish({
      available: false,
      installed: choice.outcome === "accepted",
      notice:
        choice.outcome === "accepted"
          ? "Instalação solicitada. O MarkMap será adicionado ao dispositivo."
          : "Instalação cancelada.",
    });
    return;
  }

  if (snapshot.iosSafari) {
    publish({
      notice:
        "No iPhone ou iPad, toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
    });
    return;
  }

  publish({
    notice:
      "A instalação não está disponível neste momento. Aguarde alguns segundos ou use a opção “Instalar app” do navegador.",
  });
}
