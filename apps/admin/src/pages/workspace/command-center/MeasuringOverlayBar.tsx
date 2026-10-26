import React from "react";
import { AppIcon } from "../../../components/AppIcon.js";
import type { MeasurePoint } from "./types.js";
import { formatDistance } from "./utils.js";

interface MeasuringOverlayBarProps {
  measuring: boolean;
  measurePoints: MeasurePoint[];
  totalDistance: number;
  onToggleMeasure: () => void;
}

export function MeasuringOverlayBar({
  measuring,
  measurePoints,
  totalDistance,
  onToggleMeasure,
}: MeasuringOverlayBarProps) {
  if (!measuring) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
      <AppIcon name="measure" size="sm" />
      {measurePoints.length === 0
        ? "Clique no mapa para iniciar a medição"
        : `${measurePoints.length} ponto${
            measurePoints.length > 1 ? "s" : ""
          } · ${formatDistance(totalDistance)}`}
      <button
        type="button"
        onClick={onToggleMeasure}
        className="ml-1 text-amber-600 hover:text-amber-900 font-bold"
      >
        ✕
      </button>
    </div>
  );
}
