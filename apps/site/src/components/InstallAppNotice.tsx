import { useSyncExternalStore } from "react";
import {
  dismissAppInstallNotice,
  getAppInstallSnapshot,
  subscribeAppInstall,
} from "../lib/app-install";

export function InstallAppNotice() {
  const installState = useSyncExternalStore(
    subscribeAppInstall,
    getAppInstallSnapshot,
    getAppInstallSnapshot,
  );

  if (!installState.notice) return null;

  return (
    <aside
      className="app-install-notice"
      role="status"
      aria-live="polite"
      aria-label="Instalação do MarkMap"
    >
      <div>
        <strong>Instalar MarkMap</strong>
        <span>{installState.notice}</span>
      </div>
      <button
        type="button"
        onClick={dismissAppInstallNotice}
        aria-label="Fechar aviso de instalação"
      >
        Fechar
      </button>
    </aside>
  );
}
