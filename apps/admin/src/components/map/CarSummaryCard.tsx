// Desenvolvido por MtsFerreira. Card de sumário do Cadastro Ambiental Rural (CAR).
import { useState } from "react";
import type { CarPropertySummary } from "@markmap/maps";
import { formatArea, type RuralAreaUnit } from "@markmap/geo";
import { AppIcon } from "../AppIcon";

export interface CarSummaryCardProps {
  summary: CarPropertySummary;
  className?: string;
}

const ALQUEIRE_OPTIONS: { id: RuralAreaUnit; label: string }[] = [
  { id: "alqueire_paulista", label: "Paulista (2,42 ha)" },
  { id: "alqueire_mineiro", label: "Mineiro / Goiano (4,84 ha)" },
  { id: "alqueire_baiano", label: "Baiano (9,68 ha)" },
  { id: "alqueire_norte", label: "Do Norte (2,72 ha)" },
];

function getStatusBadgeStyle(status?: string): string {
  const norm = String(status ?? "").toUpperCase();
  if (norm.includes("ATIVO")) {
    return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700";
  }
  if (norm.includes("PENDENTE")) {
    return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700";
  }
  if (norm.includes("CANCELADO") || norm.includes("SUSPENSO")) {
    return "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700";
  }
  return "bg-surface-container-high text-on-surface-variant border-outline-variant";
}

export const CAR_ALQUEIRE_STORAGE_KEY = "markmap:car_alqueire";

const VALID_ALQUEIRES: Record<string, boolean> = {
  alqueire_paulista: true,
  alqueire_mineiro: true,
  alqueire_baiano: true,
  alqueire_norte: true,
};

function getSavedAlqueire(): RuralAreaUnit {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(CAR_ALQUEIRE_STORAGE_KEY);
      if (stored && Object.hasOwn(VALID_ALQUEIRES, stored)) {
        return stored as RuralAreaUnit;
      }
    }
  } catch {
    // Falha silenciosa para quota / storage restrito
  }
  return "alqueire_paulista";
}

export function CarSummaryCard({ summary, className = "" }: CarSummaryCardProps) {
  const [selectedAlqueire, setSelectedAlqueire] = useState<RuralAreaUnit>(getSavedAlqueire);
  const [copied, setCopied] = useState(false);

  const handleAlqueireChange = (newVal: RuralAreaUnit) => {
    setSelectedAlqueire(newVal);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(CAR_ALQUEIRE_STORAGE_KEY, newVal);
      }
    } catch {
      // Ignora falhas de localStorage (modo anônimo restrito / quota excedida)
    }
  };

  if (!summary.isCarDataset) {
    return null;
  }

  const handleCopyCode = async () => {
    if (!summary.carCode) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(summary.carCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignora falhas de clipboard em ambientes restritos
    }
  };

  const locality = [summary.municipality, summary.state].filter(Boolean).join(" - ");
  const otherLayers = summary.layers.filter((layer) => layer.layerType !== "AREA_IMOVEL");
  const clampedRlPercent = Math.min(100, Math.max(0, summary.reservaLegalPercent));

  return (
    <section
      role="region"
      aria-label="Sumário do Cadastro Ambiental Rural (CAR)"
      className={`rounded-xl border border-outline-variant bg-surface-container p-4 space-y-3.5 text-on-surface shadow-sm transition-colors ${className}`}
    >
      {/* Cabeçalho */}
      <header className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <AppIcon name="map" size="sm" />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Sumário do CAR
            </h3>
          </div>
          {summary.carCode && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <code
                data-testid="car-code"
                className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-container-high border border-outline-variant/60 text-on-surface select-all truncate max-w-[210px]"
                title={summary.carCode}
              >
                {summary.carCode}
              </code>
              <button
                type="button"
                aria-label="Copiar código do CAR"
                onClick={handleCopyCode}
                className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                title="Copiar código"
              >
                <AppIcon name="copy" size="sm" />
              </button>
              {copied && (
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  Copiado!
                </span>
              )}
            </div>
          )}
          {locality && (
            <p className="text-[11px] text-on-surface-variant font-medium">
              {locality}
            </p>
          )}
        </div>
        {summary.status && (
          <span
            data-testid="car-status-badge"
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeStyle(summary.status)}`}
          >
            {summary.status}
          </span>
        )}
      </header>

      {/* Área Total do Imóvel e Seletor de Alqueires */}
      <div className="p-3 rounded-lg border border-outline-variant/60 bg-surface-container-high/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-on-surface-variant">Área do Imóvel</span>
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="car-alqueire-select"
              className="text-[11px] text-on-surface-variant font-medium"
            >
              Alqueire:
            </label>
            <select
              id="car-alqueire-select"
              aria-label="Selecionar padrão regional de alqueire"
              value={selectedAlqueire}
              onChange={(e) => handleAlqueireChange(e.target.value as RuralAreaUnit)}
              className="text-xs rounded border border-outline-variant bg-surface-container px-1.5 py-0.5 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {ALQUEIRE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2 pt-0.5">
          <div
            data-testid="car-area-ha"
            className="text-lg font-bold font-mono text-on-surface"
          >
            {formatArea(summary.areaImovelSqMeters, "hectares")}
          </div>
          <div
            data-testid="car-area-alqueires"
            className="text-xs font-mono font-semibold text-on-surface-variant"
          >
            {formatArea(summary.areaImovelSqMeters, selectedAlqueire)}
          </div>
        </div>
      </div>

      {/* Reserva Legal e Barra de Progresso */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-on-surface">Reserva Legal (RL)</span>
          <span
            data-testid="car-rl-percent"
            className="font-mono font-bold text-emerald-700 dark:text-emerald-400"
          >
            {summary.reservaLegalPercent.toFixed(1)}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={summary.reservaLegalPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Percentual de Reserva Legal"
          className="h-2.5 w-full rounded-full bg-surface-variant overflow-hidden border border-outline-variant/40"
        >
          <div
            className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
            style={{ width: `${clampedRlPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
          <span data-testid="car-rl-ha">
            {formatArea(summary.areaReservaLegalSqMeters, "hectares")}
          </span>
          <span data-testid="car-rl-alqueires">
            {formatArea(summary.areaReservaLegalSqMeters, selectedAlqueire)}
          </span>
        </div>
      </div>

      {/* Discriminação das Demais Camadas */}
      {otherLayers.length > 0 && (
        <div className="pt-2 border-t border-outline-variant/60 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
            Discriminação de Camadas
          </span>
          <div className="space-y-1 text-xs" data-testid="car-layers-list">
            {otherLayers.map((layer) => (
              <div
                key={layer.layerType}
                className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-surface-variant/40 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border"
                    style={{
                      backgroundColor: layer.style.fillColor,
                      borderColor: layer.style.strokeColor,
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-on-surface font-medium truncate" title={layer.label}>
                    {layer.label}
                    <span className="text-on-surface-variant ml-1 font-normal text-[11px]">
                      ({layer.count})
                    </span>
                  </span>
                </div>
                <div className="text-right shrink-0 font-mono text-on-surface font-semibold text-[11px]">
                  {formatArea(layer.areaSqMeters, "hectares")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
