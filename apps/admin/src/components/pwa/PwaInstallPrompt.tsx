import { useState, useSyncExternalStore } from "react";
import {
  getPwaInstallSnapshot,
  requestPwaInstall,
  subscribePwaInstall,
} from "../../lib/pwa-install";

export function PwaInstallPrompt() {
  const installState = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (window.location.pathname === "/install") return null;
  if (installState.installed || dismissed) return null;

  const install = async () => {
    if (!installState.available || busy) return;

    setBusy(true);
    try {
      const outcome = await requestPwaInstall();
      if (outcome !== "accepted") setDismissed(true);
    } finally {
      setBusy(false);
    }
  };

  if (installState.available) {
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

  if (installState.iosSafari) {
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
