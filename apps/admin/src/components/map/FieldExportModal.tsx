// Desenvolvido por MtsFerreira. Exportador Universal de Desenhos de Campo (KML & GPX).
import { useState, useId, useMemo, type FormEvent } from "react";
import {
  exportToGpx,
  exportToKml,
  finishDrawingSession,
  type DrawingSession,
} from "@markmap/maps";
import { AppIcon } from "../AppIcon";
import { downloadBlob } from "../../lib/file-download";

export type ExportFormat = "kml" | "gpx";
export type ExportScope = "all" | "drawings" | "tracks" | "active";

export interface FieldExportModalProps {
  open: boolean;
  onClose: () => void;
  projectName?: string;
  projectFeatures: GeoJSON.Feature[];
  activeDrawingSession?: DrawingSession | null;
  activeTrackGeoJson?: GeoJSON.Feature<GeoJSON.LineString> | null;
  className?: string;
}

export interface NormalizedExportFeatures {
  features: GeoJSON.Feature[];
  counts: {
    points: number;
    lines: number;
    polygons: number;
    total: number;
  };
}

export function filterAndNormalizeFeatures(
  scope: ExportScope,
  projectFeatures: GeoJSON.Feature[],
  activeDrawingSession?: DrawingSession | null,
  activeTrackGeoJson?: GeoJSON.Feature<GeoJSON.LineString> | null,
): NormalizedExportFeatures {
  const selected: GeoJSON.Feature[] = [];

  // 1. Tentar extrair geometria da sessão ativa de desenho se existir
  let activeDrawingFeature: GeoJSON.Feature | null = null;
  if (activeDrawingSession && activeDrawingSession.vertices.length > 0) {
    try {
      const geometry = finishDrawingSession(activeDrawingSession);
      activeDrawingFeature = {
        type: "Feature",
        id: "active-drawing",
        geometry: geometry as GeoJSON.Geometry,
        properties: {
          name: `Desenho Atual (${activeDrawingSession.type})`,
          source: "markmap-drawing-active",
          createdAt: new Date().toISOString(),
        },
      };
    } catch {
      // Sessão de desenho ainda incompleta (ex: menos de 2 vértices em linha), descartar com segurança
    }
  }

  // 2. Extrair trilha ativa em gravação se houver pelo menos 2 coordenadas
  let validActiveTrack: GeoJSON.Feature<GeoJSON.LineString> | null = null;
  if (
    activeTrackGeoJson &&
    activeTrackGeoJson.geometry?.coordinates &&
    activeTrackGeoJson.geometry.coordinates.length >= 2
  ) {
    validActiveTrack = {
      ...activeTrackGeoJson,
      properties: {
        ...activeTrackGeoJson.properties,
        name: activeTrackGeoJson.properties?.name || "Trilha Ativa GNSS",
        source: "markmap-gnss-logger",
      },
    };
  }

  // 3. Filtrar de acordo com o escopo
  if (scope === "active") {
    if (activeDrawingFeature) selected.push(activeDrawingFeature);
    if (validActiveTrack) selected.push(validActiveTrack);
  } else {
    for (const feat of projectFeatures) {
      if (!feat || !feat.geometry) continue;

      const isTrack =
        feat.properties?.type === "gps_track" ||
        feat.properties?.source === "markmap-gnss-logger";

      if (scope === "all") {
        selected.push(feat);
      } else if (scope === "drawings" && !isTrack) {
        selected.push(feat);
      } else if (scope === "tracks" && isTrack) {
        selected.push(feat);
      }
    }

    // Incluir o elemento ativo se compatível com o escopo selecionado
    if ((scope === "all" || scope === "drawings") && activeDrawingFeature) {
      selected.push(activeDrawingFeature);
    }
    if ((scope === "all" || scope === "tracks") && validActiveTrack) {
      selected.push(validActiveTrack);
    }
  }

  // 4. Normalizar metadados para garantir legibilidade no Google Earth e receptores Garmin
  const normalizedFeatures: GeoJSON.Feature[] = selected.map((feat, index) => {
    const geomType = feat.geometry?.type;
    const defaultName =
      geomType === "Point"
        ? `Ponto ${index + 1}`
        : geomType === "Polygon"
          ? `Polígono ${index + 1}`
          : `Trilha/Linha ${index + 1}`;

    const rawTime =
      feat.properties?.time ||
      feat.properties?.recordedAt ||
      feat.properties?.createdAt ||
      new Date().toISOString();

    const desc =
      feat.properties?.description ||
      feat.properties?.desc ||
      (feat.properties?.distanceKm !== undefined
        ? `Distância: ${feat.properties.distanceKm} km | Duração: ${feat.properties.durationSeconds}s`
        : undefined);

    return {
      type: "Feature",
      id: feat.id ?? `feat-${index + 1}`,
      geometry: feat.geometry,
      properties: {
        ...feat.properties,
        name: feat.properties?.name || defaultName,
        time: String(rawTime),
        description: desc,
      },
    };
  });

  const counts = {
    points: normalizedFeatures.filter((f) => f.geometry.type === "Point").length,
    lines: normalizedFeatures.filter(
      (f) =>
        f.geometry.type === "LineString" ||
        f.geometry.type === "MultiLineString",
    ).length,
    polygons: normalizedFeatures.filter((f) => f.geometry.type === "Polygon")
      .length,
    total: normalizedFeatures.length,
  };

  return { features: normalizedFeatures, counts };
}

function getDefaultFileName(projectName?: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  const base = projectName
    ? projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")
    : "markmap_campo";
  return `${base}_${dateStr}`;
}

export function FieldExportModal({
  open,
  onClose,
  projectName,
  projectFeatures,
  activeDrawingSession,
  activeTrackGeoJson,
  className = "",
}: FieldExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("kml");
  const [scope, setScope] = useState<ExportScope>("all");
  const [fileNameBase, setFileNameBase] = useState(() =>
    getDefaultFileName(projectName),
  );
  const fileNameInputId = useId();

  const { features, counts } = useMemo(
    () =>
      filterAndNormalizeFeatures(
        scope,
        projectFeatures,
        activeDrawingSession,
        activeTrackGeoJson,
      ),
    [scope, projectFeatures, activeDrawingSession, activeTrackGeoJson],
  );

  if (!open) return null;

  const handleExport = (e: FormEvent) => {
    e.preventDefault();
    if (counts.total === 0) return;

    const safeBase = fileNameBase.trim() || getDefaultFileName(projectName);
    const fileName = `${safeBase}.${format}`;

    const content =
      format === "kml"
        ? exportToKml(features, {
            name: safeBase,
            description: "Exportado via MarkMap Brasil — GIS de Campo",
          })
        : exportToGpx(features, {
            name: safeBase,
            creator: "MarkMap Brasil (Field Engine)",
          });

    const mimeType =
      format === "kml"
        ? "application/vnd.google-earth.kml+xml;charset=utf-8"
        : "application/gpx+xml;charset=utf-8";

    const blob = new Blob([content], { type: mimeType });
    downloadBlob(blob, fileName);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-export-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-dim/80 backdrop-blur-sm"
    >
      <div
        className={`w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container text-on-surface p-5 md:p-6 shadow-2xl space-y-5 ${className}`}
      >
        {/* Cabeçalho */}
        <header className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <AppIcon name="upload" size="md" />
            </div>
            <div>
              <h2
                id="field-export-dialog-title"
                className="text-base font-bold text-on-surface"
              >
                Exportar Desenhos e Trilhas
              </h2>
              <p className="text-xs text-on-surface-variant">
                Gere arquivos KML e GPX 100% offline para Google Earth e Garmin.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar exportador"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <AppIcon name="close" size="sm" />
          </button>
        </header>

        <form onSubmit={handleExport} className="space-y-5">
          {/* 1. Escolha do Formato */}
          <section className="space-y-2">
            <label className="text-xs font-semibold text-on-surface block">
              Formato de Exportação
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setFormat("kml")}
                className={`min-h-[48px] p-3 rounded-xl border text-left transition-all flex flex-col justify-center ${
                  format === "kml"
                    ? "border-emerald-500 bg-emerald-500/10 text-on-surface shadow-sm font-semibold"
                    : "border-outline-variant hover:border-outline-variant/80 bg-surface-container-high/40 text-on-surface-variant"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">KML 2.2 (.kml)</span>
                  {format === "kml" && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  Google Earth, QGIS, ArcGIS
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFormat("gpx")}
                className={`min-h-[48px] p-3 rounded-xl border text-left transition-all flex flex-col justify-center ${
                  format === "gpx"
                    ? "border-emerald-500 bg-emerald-500/10 text-on-surface shadow-sm font-semibold"
                    : "border-outline-variant hover:border-outline-variant/80 bg-surface-container-high/40 text-on-surface-variant"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">GPX 1.1 (.gpx)</span>
                  {format === "gpx" && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  GPS Garmin, Receptores de Campo
                </span>
              </button>
            </div>
          </section>

          {/* 2. Escopo da Exportação */}
          <section className="space-y-2">
            <label className="text-xs font-semibold text-on-surface block">
              Escopo das Feições
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all ${
                  scope === "all"
                    ? "border-primary bg-primary/10 text-on-surface font-bold"
                    : "border-outline-variant hover:border-outline-variant/80 text-on-surface-variant"
                }`}
              >
                Todas as Feições
              </button>

              <button
                type="button"
                onClick={() => setScope("drawings")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all ${
                  scope === "drawings"
                    ? "border-primary bg-primary/10 text-on-surface font-bold"
                    : "border-outline-variant hover:border-outline-variant/80 text-on-surface-variant"
                }`}
              >
                Apenas Desenhos
              </button>

              <button
                type="button"
                onClick={() => setScope("tracks")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all ${
                  scope === "tracks"
                    ? "border-primary bg-primary/10 text-on-surface font-bold"
                    : "border-outline-variant hover:border-outline-variant/80 text-on-surface-variant"
                }`}
              >
                Apenas Trilhas GNSS
              </button>

              <button
                type="button"
                onClick={() => setScope("active")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all ${
                  scope === "active"
                    ? "border-primary bg-primary/10 text-on-surface font-bold"
                    : "border-outline-variant hover:border-outline-variant/80 text-on-surface-variant"
                }`}
              >
                Ativo no Momento
              </button>
            </div>
          </section>

          {/* 3. Resumo Dinâmico de Feições */}
          <div className="rounded-xl border border-outline-variant/70 bg-surface-container-high/50 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
              <span>Feições no Arquivo:</span>
              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                {counts.total} total
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-on-surface-variant">
              <span>📍 {counts.points} ponto{counts.points !== 1 ? "s" : ""}</span>
              <span>〰️ {counts.lines} linha{counts.lines !== 1 ? "s" : ""}</span>
              <span>⬡ {counts.polygons} polígono{counts.polygons !== 1 ? "s" : ""}</span>
            </div>
            {counts.total === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 pt-1 font-medium">
                Nenhuma feição encontrada no escopo selecionado.
              </p>
            )}
          </div>

          {/* 4. Nome do Arquivo */}
          <div className="space-y-1.5">
            <label
              htmlFor={fileNameInputId}
              className="text-xs font-semibold text-on-surface"
            >
              Nome do Arquivo
            </label>
            <div className="flex items-center rounded-xl border border-outline-variant bg-surface-container-high/40 focus-within:border-primary transition-colors overflow-hidden">
              <input
                id={fileNameInputId}
                type="text"
                value={fileNameBase}
                onChange={(e) => setFileNameBase(e.target.value)}
                required
                className="w-full min-h-[44px] px-3 py-2 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                placeholder="nome_do_arquivo"
              />
              <span className="px-3 py-2 text-xs font-mono font-bold text-on-surface-variant bg-surface-container-high border-l border-outline-variant select-none">
                .{format}
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/60">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-outline-variant hover:bg-surface-container-high text-on-surface text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={counts.total === 0}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-emerald-600"
            >
              <AppIcon name="upload" size="sm" />
              Exportar Arquivo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
