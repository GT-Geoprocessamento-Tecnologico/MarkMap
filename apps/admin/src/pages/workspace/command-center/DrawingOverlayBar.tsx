import React from "react";
import type { DrawingSession } from "@markmap/maps";

interface DrawingOverlayBarProps {
  drawingSession: DrawingSession | null;
  onUndo: () => void;
  onFinish: () => void;
  onReset: () => void;
}

export function DrawingOverlayBar({
  drawingSession,
  onUndo,
  onFinish,
  onReset,
}: DrawingOverlayBarProps) {
  if (!drawingSession) return null;

  return (
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
            onClick={onUndo}
            disabled={drawingSession.undoStack.length === 0}
            className="min-h-[44px] rounded-lg px-3 text-cyan-500 disabled:opacity-40"
          >
            Desfazer
          </button>
          <button
            type="button"
            onClick={onFinish}
            className="min-h-[44px] rounded-lg bg-secondary px-3 font-bold text-[#07131f] hover:brightness-110"
          >
            Concluir
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onReset}
        className="min-h-[44px] rounded-lg px-3 text-red-400"
      >
        Cancelar
      </button>
    </div>
  );
}
