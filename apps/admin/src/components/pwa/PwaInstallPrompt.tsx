import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  getPwaInstallSnapshot,
  isPwaStandalone,
  requestPwaInstall,
  subscribePwaInstall,
} from "../../lib/pwa-install";

type InstallPhase = "idle" | "accepted" | "dismissed" | "failed";

export function PwaInstallPrompt({ fullScreen = false }: { fullScreen?: boolean }) {
  const installState = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallSnapshot,
  );
  const [phase, setPhase] = useState<InstallPhase>("idle");
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const showFullScreen = fullScreen || phase === "accepted";
  if (isPwaStandalone() || (!fullScreen && dismissed && phase !== "accepted")) return null;
  if (installState.installed && phase !== "accepted" && !fullScreen) return null;

  // The native browser prompt must be called from this exact click gesture.
  const install = async () => {
    if (!installState.available || busy) return;
    setBusy(true);
    try {
      const outcome = await requestPwaInstall();
      setPhase(outcome === "accepted" ? "accepted" : "dismissed");
      if (!fullScreen && outcome !== "accepted") setDismissed(true);
    } catch {
      setPhase("failed");
    } finally {
      setBusy(false);
    }
  };

  const panel = (title: string, description: string, actions?: ReactNode) => {
    const content = (
      <section
        className={`pwa-install-prompt${showFullScreen ? " pwa-install-prompt--dialog" : ""}`}
        role={showFullScreen ? "dialog" : "status"}
        aria-modal={showFullScreen ? true : undefined}
        aria-labelledby="markmap-install-title"
      >
        {showFullScreen && (
          <img className="pwa-install-prompt__icon" src="/icons/icon-192x192-cf74c7b0.png" alt="" />
        )}
        <div className="pwa-install-prompt__copy">
          <strong id="markmap-install-title">{title}</strong>
          <span>{description}</span>
        </div>
        {actions && <div className="pwa-install-prompt__actions">{actions}</div>}
      </section>
    );
    return showFullScreen ? <main className="pwa-install-gate">{content}</main> : content;
  };

  if (phase === "accepted" || (fullScreen && installState.installed)) {
    return panel(
      installState.installed ? "MarkMap instalado" : "Instalação autorizada",
      "Quando o ícone do MarkMap aparecer no dispositivo, abra por ele. O aplicativo iniciará em janela própria, sem a interface do navegador. Você pode fechar esta aba.",
    );
  }

  if (phase === "dismissed" || phase === "failed") {
    if (!fullScreen) return null;
    return panel(
      phase === "dismissed" ? "Instalação cancelada" : "Não foi possível solicitar a instalação",
      "Use a opção “Instalar aplicativo” no menu do navegador. Se já estiver instalado, abra o MarkMap pelo ícone do dispositivo.",
    );
  }

  if (installState.available) {
    return panel(
      "Instalar aplicativo MarkMap",
      "Selecione Instalar para abrir a confirmação de instalação do navegador.",
      <>
        {!fullScreen && (
          <button
            type="button"
            className="pwa-install-prompt__secondary"
            onClick={() => setDismissed(true)}
          >
            Agora não
          </button>
        )}
        <button
          type="button"
          className="pwa-install-prompt__primary"
          onClick={() => void install()}
          disabled={busy}
        >
          {busy ? "Aguardando autorização…" : "Instalar aplicativo"}
        </button>
      </>,
    );
  }

  if (installState.iosSafari) {
    return panel(
      "Instalar MarkMap",
      "No iPhone ou iPad, use Compartilhar e selecione “Adicionar à Tela de Início”. Depois abra pelo ícone do MarkMap.",
      !fullScreen ? (
        <button
          type="button"
          className="pwa-install-prompt__secondary"
          onClick={() => setDismissed(true)}
        >
          Entendi
        </button>
      ) : undefined,
    );
  }

  if (fullScreen) {
    return panel(
      "Instalar MarkMap",
      "Aguardando disponibilidade da instalação. Caso o navegador não mostre o botão, use “Instalar aplicativo” no menu. Depois, abra o MarkMap pelo ícone do dispositivo.",
    );
  }

  return null;
}
