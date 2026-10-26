import type { DrawingSession } from "@markmap/maps";
import { AppIcon } from "../AppIcon";

export interface MeasurePoint {
  lng: number;
  lat: number;
}

export function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
}

interface MapDrawingControlProps {
  drawingSession: DrawingSession | null;
  onUndoDrawing: () => void;
  onFinishDrawing: () => void;
  onResetDrawing: () => void;
  measuring: boolean;
  measurePoints: MeasurePoint[];
  totalDistance: number;
  onToggleMeasure: () => void;
}

export function MapDrawingControl({
  drawingSession,
  onUndoDrawing,
  onFinishDrawing,
  onResetDrawing,
  measuring,
  measurePoints,
  totalDistance,
  onToggleMeasure,
}: MapDrawingControlProps) {
  return (
    <>
      {drawingSession && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-2 rounded-2xl border border-cyan-400/40 bg-surface-container/95 px-3 py-2 text-xs font-semibold text-on-surface shadow-lg backdrop-blur">
          <span>
            {drawingSession.type === "Point"
              ? "Toque no mapa para salvar o ponto"
              : `${drawingSession.vertices.length} vértice${
                  drawingSession.vertices.length === 1 ? "" : "s"
                }`}
          </span>
          {drawingSession.type !== "Point" && (
            <>
              <button
                type="button"
                onClick={onUndoDrawing}
                disabled={drawingSession.undoStack.length === 0}
                className="min-h-[44px] rounded-lg px-3 text-cyan-500 disabled:opacity-40"
              >
                Desfazer
              </button>
              <button
                type="button"
                onClick={onFinishDrawing}
                className="min-h-[44px] rounded-lg bg-secondary px-3 font-bold text-[#07131f] hover:brightness-110"
              >
                Concluir
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onResetDrawing}
            className="min-h-[44px] rounded-lg px-3 text-red-400"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Indicador de medição ativo ── */}
      {measuring && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <AppIcon name="measure" size="sm" />
          {measurePoints.length === 0
            ? "Clique no mapa para iniciar a medição"
            : `${measurePoints.length} ponto${
                measurePoints.length > 1 ? "s" : ""
              } · ${formatDistance(totalDistance)}`}
          <button
            onClick={onToggleMeasure}
            className="ml-1 text-amber-600 hover:text-amber-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
