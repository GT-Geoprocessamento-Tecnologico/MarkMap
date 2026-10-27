// Desenvolvido por MtsFerreira. Banner de alerta de proximidade e limites de propriedade (M5).
import { useState, useEffect } from "react";
import { AppIcon } from "../AppIcon";

export type BoundaryAlertStatus = "inactive" | "safe" | "approaching" | "breach";

export interface BoundaryAlertBannerProps {
  /** Estado de limite calculado pelo BoundaryGuard */
  status: BoundaryAlertStatus;
  /** Menor distância métrica até a divisa física */
  distanceMeters: number | null;
  /** Nome identificador do imóvel ou polígono mais próximo */
  polygonName?: string | null;
  /** Indica se os alertas sonoros estão silenciados */
  isMuted: boolean;
  /** Alterna o modo silenciado/ativo de áudio */
  onToggleMute: () => void;
  /** Callback opcional quando o usuário fecha/dispensa o banner */
  onDismiss?: () => void;
  /** Classe CSS customizável para posicionamento no mapa */
  className?: string;
}

/**
 * Formata distância de aproximação de forma legível em campo
 */
export function formatBoundaryDistance(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters)) return "divisa";
  if (meters < 1000) {
    return `${Math.max(0, Math.round(meters))} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function BoundaryAlertBanner({
  status,
  distanceMeters,
  polygonName,
  isMuted,
  onToggleMute,
  onDismiss,
  className = "",
}: BoundaryAlertBannerProps) {
  // Controle de dispensamento temporário pelo usuário
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastDismissedStatus, setLastDismissedStatus] = useState<BoundaryAlertStatus | null>(null);

  // Se o status evoluir para violação (breach), quebra o dismiss anterior por segurança
  useEffect(() => {
    if (status === "breach" && lastDismissedStatus === "approaching") {
      setIsDismissed(false);
      setLastDismissedStatus(null);
    }
  }, [status, lastDismissedStatus]);

  // Se o status voltar para seguro ou inativo, reseta o dismiss para o próximo ciclo
  useEffect(() => {
    if (status === "safe" || status === "inactive") {
      setIsDismissed(false);
      setLastDismissedStatus(null);
    }
  }, [status]);

  // Não renderiza quando seguro, inativo ou dispensado pelo usuário
  if (status !== "approaching" && status !== "breach") {
    return null;
  }

  if (isDismissed) {
    return null;
  }

  const isBreach = status === "breach";
  const formattedDist = formatBoundaryDistance(distanceMeters);
  const targetLabel = polygonName ? `de ${polygonName}` : "da propriedade";

  const handleDismiss = () => {
    setIsDismissed(true);
    setLastDismissedStatus(status);
    onDismiss?.();
  };

  return (
    <aside
      role={isBreach ? "alert" : "status"}
      aria-live={isBreach ? "assertive" : "polite"}
      aria-atomic="true"
      data-testid="boundary-alert-banner"
      data-status={status}
      className={`absolute top-4 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:min-w-[340px] sm:max-w-lg z-30 flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all ${
        isBreach
          ? "bg-rose-50/95 border-rose-300 text-rose-950 dark:bg-[#2c0911]/95 dark:border-rose-700/80 dark:text-rose-100"
          : "bg-amber-50/95 border-amber-300 text-amber-950 dark:bg-[#251404]/95 dark:border-amber-700/80 dark:text-amber-100"
      } ${className}`}
    >
      {/* Lado Esquerdo: Ícone + Textos de Alerta */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          data-testid="boundary-alert-icon-container"
          className={`p-2 rounded-xl flex-shrink-0 ${
            isBreach
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
              : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
          }`}
        >
          <AppIcon
            name={isBreach ? "polygon" : "notifications"}
            size="md"
            className="shrink-0"
          />
        </span>

        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              data-testid="boundary-status-badge"
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isBreach
                  ? "bg-rose-600 text-white border-rose-700 dark:bg-rose-700 dark:border-rose-600"
                  : "bg-amber-600 text-white border-amber-700 dark:bg-amber-600 dark:border-amber-500"
              }`}
            >
              {isBreach ? "Fora dos Limites" : "Atenção: Divisa Próxima"}
            </span>
          </div>

          <p
            data-testid="boundary-alert-message"
            className={`text-xs leading-snug truncate font-medium ${
              isBreach
                ? "text-rose-900 dark:text-rose-200"
                : "text-amber-900 dark:text-amber-200"
            }`}
            title={
              isBreach
                ? `Alerta: Fora dos limites ${targetLabel}`
                : `A ${formattedDist} da divisa ${targetLabel}`
            }
          >
            {isBreach ? (
              <>
                Alerta: Fora dos limites <span className="font-bold">{targetLabel}</span>
              </>
            ) : (
              <>
                A <span className="font-bold font-mono">{formattedDist}</span> da divisa{" "}
                <span className="font-semibold">{targetLabel}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Lado Direito: Ações (Mute/Unmute e Fechar) com Touch Target >= 44x44px */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={
            isMuted
              ? "Ativar alertas sonoros de divisa"
              : "Silenciar alertas sonoros de divisa"
          }
          aria-pressed={!isMuted}
          title={
            isMuted
              ? "Alertas sonoros silenciados (toque para ativar)"
              : "Alertas sonoros ativos (toque para silenciar)"
          }
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 ${
            isBreach
              ? "text-rose-800 hover:bg-rose-200/50 dark:text-rose-200 dark:hover:bg-rose-900/40 focus-visible:ring-rose-500"
              : "text-amber-800 hover:bg-amber-200/50 dark:text-amber-200 dark:hover:bg-amber-900/40 focus-visible:ring-amber-500"
          }`}
        >
          <AppIcon
            name={isMuted ? "notificationsOff" : "notifications"}
            size="sm"
          />
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dispensar alerta de divisa"
          title="Fechar alerta temporariamente"
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 ${
            isBreach
              ? "text-rose-800 hover:bg-rose-200/50 dark:text-rose-200 dark:hover:bg-rose-900/40 focus-visible:ring-rose-500"
              : "text-amber-800 hover:bg-amber-200/50 dark:text-amber-200 dark:hover:bg-amber-900/40 focus-visible:ring-amber-500"
          }`}
        >
          <AppIcon name="close" size="sm" />
        </button>
      </div>
    </aside>
  );
}
