import type { ReactNode } from "react";
import { siteConfig } from "../site-config";

interface InstallAppButtonProps {
  className?: string;
  children?: ReactNode;
  onRequest?: () => void;
}

/** Installation must start on the operational app origin, never the marketing site. */
export function InstallAppButton({
  className = "",
  children,
  onRequest,
}: InstallAppButtonProps) {
  return (
    <a
      href={siteConfig.appDownloadUrl}
      className={className}
      onClick={onRequest}
      aria-label="Abrir o aplicativo MarkMap para instalar"
    >
      {children ?? "Baixar app"}
    </a>
  );
}
