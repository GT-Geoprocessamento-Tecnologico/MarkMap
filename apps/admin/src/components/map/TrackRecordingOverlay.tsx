// Desenvolvido por MtsFerreira. Overlay flutuante e HUD de gravação de trilhas GNSS (MM-AVZ-05).
import { useState, useId, type FormEvent } from "react";
import type { TrackRecorderStatus, TrackStats } from "@markmap/maps";
import { AppIcon } from "../AppIcon";

export interface TrackRecordingOverlayProps {
  status: TrackRecorderStatus;
  stats: TrackStats;
  currentAccuracyMeters: number | null;
  currentSpeedKmh?: number;
  currentElevationMeters?: number | null;
  hasDraft?: boolean;
  open: boolean;
  onStart: (name?: string) => void | Promise<unknown>;
  onPause: () => void;
  onResume: () => void;
  onSave: (trackName: string) => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
  onRestoreDraft?: () => void | Promise<void>;
  onClose: () => void;
  className?: string;
}

function formatTrackDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatDurationHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getSuggestedTrackName(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Trilha ${dateStr} ${timeStr}`;
}

export function TrackRecordingOverlay({
  status,
  stats,
  currentAccuracyMeters,
  currentSpeedKmh = 0,
  currentElevationMeters = null,
  hasDraft = false,
  open,
  onStart,
  onPause,
  onResume,
  onSave,
  onDiscard,
  onRestoreDraft,
  onClose,
  className = "",
}: TrackRecordingOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [trackName, setTrackName] = useState(getSuggestedTrackName);
  const nameInputId = useId();

  if (!open) return null;

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isIdle = status === "idle" || status === "stopped";
  const isAccuracyDegraded = currentAccuracyMeters !== null && currentAccuracyMeters > 15;

  const handleOpenSaveModal = () => {
    setTrackName(getSuggestedTrackName());
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = async (e: FormEvent) => {
    e.preventDefault();
    const finalName = trackName.trim() || getSuggestedTrackName();
    await onSave(finalName);
    setIsSaveModalOpen(false);
  };

  const handleConfirmDiscard = async () => {
    await onDiscard();
    setIsDiscardDialogOpen(false);
  };

  // --- Modo Minimizado (Pílula Compacta) ---
  if (isMinimized) {
    return (
      <aside
        role="region"
        aria-label="Gravador de trilha minimizado"
        className={`absolute top-3 left-3 right-3 sm:left-auto sm:right-4 z-20 flex items-center justify-between gap-3 px-4 py-2 rounded-full border border-outline-variant bg-surface-container/95 text-on-surface shadow-xl backdrop-blur-md transition-all ${className}`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
              REC
            </span>
          )}
          {isPaused && (
            <span className="text-amber-700 dark:text-amber-400 font-bold">
              PAUSA
            </span>
          )}
          <span className="font-mono text-on-surface">
            {formatDurationHms(stats.durationSeconds)}
          </span>
          <span className="text-on-surface-variant">·</span>
          <span className="font-mono text-on-surface">
            {formatTrackDistance(stats.distanceMeters)}
          </span>
          {currentAccuracyMeters !== null && (
            <>
              <span className="text-on-surface-variant">·</span>
              <span className={`text-[11px] font-mono ${isAccuracyDegraded ? "text-rose-700 dark:text-rose-400 font-bold" : "text-on-surface-variant"}`}>
                ±{Math.round(currentAccuracyMeters)}m
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isRecording && (
            <button
              type="button"
              onClick={onPause}
              aria-label="Pausar gravação da trilha"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-amber-700 dark:text-amber-400 hover:bg-surface-container-high transition-colors"
            >
              <AppIcon name="analytics" size="sm" />
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              aria-label="Retomar gravação da trilha"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-surface-container-high transition-colors"
            >
              <AppIcon name="location" size="sm" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Maximizar painel do gravador de trilha"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <AppIcon name="expand" size="sm" />
          </button>
        </div>
      </aside>
    );
  }

  // --- Modo Expandido (HUD Cockpit Completo) ---
  return (
    <>
      <section
        role="region"
        aria-label="Gravador de trilha GNSS"
        className={`absolute top-3 left-3 right-3 sm:left-auto sm:right-4 z-20 w-auto sm:w-[380px] rounded-2xl border border-outline-variant bg-surface-container/95 text-on-surface p-4 shadow-2xl backdrop-blur-xl transition-all space-y-3.5 ${className}`}
      >
        {/* Cabeçalho do HUD */}
        <header className="flex items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <AppIcon name="line" size="md" />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface truncate">
                Gravador de Trilha GNSS
              </h2>
              <div className="flex items-center gap-2 pt-0.5">
                {isRecording && (
                  <span
                    data-testid="status-recording-badge"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                    REC Ativo
                  </span>
                )}
                {isPaused && (
                  <span
                    data-testid="status-paused-badge"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider"
                  >
                    Pausado
                  </span>
                )}
                {isIdle && (
                  <span
                    data-testid="status-idle-badge"
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant text-on-surface-variant text-[10px] font-bold uppercase tracking-wider"
                  >
                    Pronto
                  </span>
                )}
                <span className="text-[11px] font-mono text-on-surface-variant">
                  {stats.pointsCount} pts
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              aria-label="Minimizar gravador de trilha"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <AppIcon name="collapse" size="sm" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel do gravador de trilha"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <AppIcon name="close" size="sm" />
            </button>
          </div>
        </header>

        {/* Indicador de Qualidade do Sinal GNSS & Alerta de Filtro > 15m */}
        <div
          role="status"
          aria-live="polite"
          data-testid="gps-quality-indicator"
          className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors ${
            isAccuracyDegraded
              ? "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300 font-medium"
              : currentAccuracyMeters !== null
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-surface-container-high border-outline-variant text-on-surface-variant"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AppIcon name="location" size="sm" className="shrink-0" />
            <span className="truncate">
              {currentAccuracyMeters === null
                ? "Aguardando sinal GNSS..."
                : isAccuracyDegraded
                ? `Acurácia ±${Math.round(currentAccuracyMeters)}m: Ruído descartado (>15m)`
                : `Acurácia ±${Math.round(currentAccuracyMeters)}m (Sinal GNSS confiável)`}
            </span>
          </div>
          {currentAccuracyMeters !== null && (
            <span className="text-[10px] font-mono font-bold shrink-0">
              {isAccuracyDegraded ? "FILTRANDO" : "OK"}
            </span>
          )}
        </div>

        {/* Grade de Telemetria Quádrupla */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Card 1: Distância */}
          <div className="p-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-high/60 space-y-0.5">
            <span className="text-[11px] text-on-surface-variant block font-medium">Distância</span>
            <div data-testid="telemetry-distance" className="text-lg font-bold font-mono text-on-surface">
              {formatTrackDistance(stats.distanceMeters)}
            </div>
          </div>

          {/* Card 2: Duração Ativa */}
          <div className="p-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-high/60 space-y-0.5">
            <span className="text-[11px] text-on-surface-variant block font-medium">Duração Ativa</span>
            <div data-testid="telemetry-duration" className="text-lg font-bold font-mono text-on-surface">
              {formatDurationHms(stats.durationSeconds)}
            </div>
          </div>

          {/* Card 3: Velocidade (Instantânea e Média) */}
          <div className="p-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-high/60 space-y-0.5">
            <span className="text-[11px] text-on-surface-variant block font-medium">Velocidade (Inst. / Méd.)</span>
            <div data-testid="telemetry-speed" className="text-sm font-bold font-mono text-on-surface">
              {currentSpeedKmh.toFixed(1)} km/h
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant block">
              méd. {stats.avgSpeedKmh.toFixed(1)} km/h
            </span>
          </div>

          {/* Card 4: Ganho de Elevação e Altitude */}
          <div className="p-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-high/60 space-y-0.5">
            <span className="text-[11px] text-on-surface-variant block font-medium">Ganho de Elevação</span>
            <div data-testid="telemetry-elevation-gain" className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
              +{Math.round(stats.elevationGainMeters)} m
            </div>
            <span className="text-[10px] font-mono text-on-surface-variant block">
              {currentElevationMeters !== null ? `alt. ${Math.round(currentElevationMeters)}m` : "sem cota Z"}
            </span>
          </div>
        </div>

        {/* Controles Flutuantes de Gravação (Touch-Friendly >= 44px) */}
        <div className="pt-1 flex flex-wrap items-center gap-2">
          {isIdle && (
            <>
              <button
                type="button"
                onClick={() => onStart()}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <AppIcon name="location" size="sm" />
                Iniciar Trilha
              </button>
              {hasDraft && onRestoreDraft && (
                <button
                  type="button"
                  onClick={onRestoreDraft}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-semibold text-xs hover:bg-cyan-500/20 transition-colors"
                >
                  Recuperar Rascunho
                </button>
              )}
            </>
          )}

          {isRecording && (
            <>
              <button
                type="button"
                onClick={onPause}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 font-bold text-sm hover:bg-amber-500/25 transition-colors flex items-center justify-center gap-1.5"
              >
                <AppIcon name="analytics" size="sm" />
                Pausar
              </button>
              <button
                type="button"
                onClick={handleOpenSaveModal}
                disabled={stats.pointsCount < 2}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <AppIcon name="download" size="sm" />
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setIsDiscardDialogOpen(true)}
                aria-label="Descartar trilha"
                className="min-h-[44px] min-w-[44px] p-2 rounded-xl border border-outline-variant hover:border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center"
              >
                <AppIcon name="delete" size="sm" />
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                type="button"
                onClick={onResume}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <AppIcon name="location" size="sm" />
                Retomar
              </button>
              <button
                type="button"
                onClick={handleOpenSaveModal}
                disabled={stats.pointsCount < 2}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <AppIcon name="download" size="sm" />
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setIsDiscardDialogOpen(true)}
                aria-label="Descartar trilha"
                className="min-h-[44px] min-w-[44px] p-2 rounded-xl border border-outline-variant hover:border-rose-500/40 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center"
              >
                <AppIcon name="delete" size="sm" />
              </button>
            </>
          )}
        </div>
      </section>

      {/* Modal Acessível: Salvar Trilha */}
      {isSaveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-track-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container text-on-surface p-5 shadow-2xl space-y-4">
            <header className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <h3 id="save-track-dialog-title" className="text-base font-bold text-on-surface flex items-center gap-2">
                <AppIcon name="download" size="md" />
                Salvar Trilha no Mapa
              </h3>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                aria-label="Cancelar salvamento da trilha"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <AppIcon name="close" size="sm" />
              </button>
            </header>

            <form onSubmit={handleConfirmSave} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor={nameInputId} className="text-xs font-semibold text-on-surface">
                  Nome da Trilha
                </label>
                <input
                  id={nameInputId}
                  type="text"
                  value={trackName}
                  onChange={(e) => setTrackName(e.target.value)}
                  required
                  autoFocus
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Vistoria Gleba Sul"
                />
              </div>

              {/* Sumário da Trilha */}
              <div className="p-3 rounded-xl border border-outline-variant/60 bg-surface-container-high/40 text-xs space-y-2">
                <span className="font-bold text-on-surface-variant block uppercase tracking-wider text-[10px]">
                  Resumo da Coleta
                </span>
                <div className="grid grid-cols-2 gap-2 text-on-surface">
                  <div>
                    <span className="text-on-surface-variant text-[11px] block">Distância Total</span>
                    <span className="font-mono font-bold">{formatTrackDistance(stats.distanceMeters)}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant text-[11px] block">Tempo Ativo</span>
                    <span className="font-mono font-bold">{formatDurationHms(stats.durationSeconds)}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant text-[11px] block">Velocidade Média</span>
                    <span className="font-mono font-bold">{stats.avgSpeedKmh.toFixed(1)} km/h</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant text-[11px] block">Ganho de Elevação</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">+{Math.round(stats.elevationGainMeters)} m</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high font-medium text-xs transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md transition-colors"
                >
                  Confirmar e Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmação: Descartar */}
      {isDiscardDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-track-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-outline-variant bg-surface-container text-on-surface p-5 shadow-2xl space-y-3">
            <h3 id="discard-track-dialog-title" className="text-base font-bold text-rose-700 dark:text-rose-400">
              Descartar Trilha?
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tem certeza que deseja descartar esta gravação? Todos os {stats.pointsCount} pontos coletados serão perdidos permanentemente.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDiscardDialogOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-container-high font-medium text-xs transition-colors"
              >
                Continuar Gravando
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                Descartar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
