import React from "react";
import { AppIcon } from "../../../components/AppIcon.js";
import type { MeasurePoint, TelemetryData } from "./types.js";
import { formatDistance } from "./utils.js";

interface TelemetryPanelProps {
  telemetry: TelemetryData;
  measuring: boolean;
  measurePoints: MeasurePoint[];
  totalDistance: number;
  onToggleMeasure: () => void;
  labelClass: string;
  subtitleClass: string;
  valueClass: string;
}

export function TelemetryPanel({
  telemetry,
  measuring,
  measurePoints,
  totalDistance,
  onToggleMeasure,
  labelClass,
  subtitleClass,
  valueClass,
}: TelemetryPanelProps) {
  return (
    <div className="p-5 space-y-4">
      <div>
        <p className={`${subtitleClass} mb-2 uppercase tracking-wider`}>
          Posição do mapa
        </p>
        <div className="space-y-2">
          <Row
            label="Latitude"
            value={`${telemetry.lat.toFixed(6)}°`}
            labelCls={labelClass}
            valueCls={valueClass}
          />
          <Row
            label="Longitude"
            value={`${telemetry.lng.toFixed(6)}°`}
            labelCls={labelClass}
            valueCls={valueClass}
          />
        </div>
      </div>
      <div className="h-px bg-surface-variant" />
      <div>
        <p className={`${subtitleClass} mb-2 uppercase tracking-wider`}>
          Câmera
        </p>
        <div className="space-y-2">
          <Row
            label="Zoom"
            value={telemetry.zoom.toFixed(2)}
            labelCls={labelClass}
            valueCls="text-cyan-700 font-mono font-bold text-sm"
          />
          <Row
            label="Inclinação (Pitch)"
            value={`${telemetry.pitch.toFixed(1)}°`}
            labelCls={labelClass}
            valueCls="text-cyan-700 font-mono font-bold text-sm"
          />
          <Row
            label="Rotação (Bearing)"
            value={`${telemetry.bearing.toFixed(1)}°`}
            labelCls={labelClass}
            valueCls="text-cyan-700 font-mono font-bold text-sm"
          />
        </div>
      </div>
      {measuring && (
        <>
          <div className="h-px bg-surface-variant" />
          <div>
            <p className={`${subtitleClass} mb-2 uppercase tracking-wider`}>
              Medição ativa
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <Row
                label="Pontos"
                value={String(measurePoints.length)}
                labelCls="text-amber-800 font-semibold text-sm"
                valueCls="text-amber-900 font-mono font-bold text-sm"
              />
              <Row
                label="Distância total"
                value={formatDistance(totalDistance)}
                labelCls="text-amber-800 font-semibold text-sm"
                valueCls="text-amber-900 font-mono font-bold text-base"
              />
            </div>
            <button
              type="button"
              onClick={onToggleMeasure}
              className="mt-3 w-full py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition-colors"
            >
              Encerrar medição
            </button>
          </div>
        </>
      )}
      {!measuring && (
        <button
          type="button"
          onClick={onToggleMeasure}
          className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-semibold hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
        >
          <AppIcon name="measure" size="sm" />
          Iniciar medição de distância
        </button>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  labelCls,
  valueCls,
}: {
  label: string;
  value: string;
  labelCls: string;
  valueCls: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelCls}>{label}</span>
      <span className={valueCls}>{value}</span>
    </div>
  );
}
