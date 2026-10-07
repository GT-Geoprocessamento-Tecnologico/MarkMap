import { useSyncExternalStore, type ReactNode } from "react";
import {
  getAppInstallSnapshot,
  requestAppInstall,
  subscribeAppInstall,
} from "../lib/app-install";

interface InstallAppButtonProps {
  className?: string;
  children?: ReactNode;
  onRequest?: () => void;
}

export function InstallAppButton({
  className = "",
  children,
  onRequest,
}: InstallAppButtonProps) {
  const installState = useSyncExternalStore(
    subscribeAppInstall,
    getAppInstallSnapshot,
    getAppInstallSnapshot,
  );

  const handleClick = async () => {
    onRequest?.();
    await requestAppInstall();
  };

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleClick()}
      aria-label={
        installState.installed
          ? "MarkMap já instalado"
          : "Baixar e instalar app MarkMap"
      }
    >
      {children ?? "Baixar app"}
    </button>
  );
}
