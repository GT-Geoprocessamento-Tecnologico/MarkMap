import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as NavigatorWithStandalone).standalone)
  );
}

function isIosSafari(): boolean {
  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(userAgent);
  const isWebKit = /WebKit/.test(userAgent);
  const isCriOS = /CriOS/.test(userAgent);
  const isFxiOS = /FxiOS/.test(userAgent);
  return isIos && isWebKit && !isCriOS && !isFxiOS;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    setIosSafari(isIosSafari());

    const onBeforeInstallPrompt = (event: Event) => {
      const installPromptEvent = event as BeforeInstallPromptEvent;
      installPromptEvent.preventDefault();
      setInstallEvent(installPromptEvent);
      setDismissed(false);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;

  const install = async () => {
    if (!installEvent || busy) return;

    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      if (choice.outcome === "accepted") {
        setInstalled(true);
      } else {
        setDismissed(true);
      }
    } finally {
      setBusy(false);
    }
  };

  if (installEvent) {
    return (
      <aside
        className="pwa-install-prompt"
        role="status"
        aria-live="polite"
        aria-label="Instalar MarkMap"
      >
        <div className="pwa-install-prompt__copy">
          <strong>Instalar MarkMap</strong>
          <span>Use como aplicativo e mantenha o acesso offline.</span>
        </div>
        <div className="pwa-install-prompt__actions">
          <button
            type="button"
            className="pwa-install-prompt__secondary"
            onClick={() => setDismissed(true)}
          >
            Agora não
          </button>
          <button
            type="button"
            className="pwa-install-prompt__primary"
            onClick={() => void install()}
            disabled={busy}
          >
            {busy ? "Abrindo…" : "Instalar"}
          </button>
        </div>
      </aside>
    );
  }

  if (iosSafari) {
    return (
      <aside
        className="pwa-install-prompt"
        role="status"
        aria-live="polite"
        aria-label="Adicionar MarkMap à Tela de Início"
      >
        <div className="pwa-install-prompt__copy">
          <strong>Instalar MarkMap</strong>
          <span>No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</span>
        </div>
        <button
          type="button"
          className="pwa-install-prompt__secondary"
          onClick={() => setDismissed(true)}
        >
          Entendi
        </button>
      </aside>
    );
  }

  return null;
}
