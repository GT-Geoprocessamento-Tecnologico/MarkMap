import React from "react";
import type { Layer } from "@markmap/contracts";
import { AppIcon } from "../../../components/AppIcon.js";
import type { DatasetRecord } from "../../../lib/datasets/dataset-store.js";
import { FiltersPanel } from "./FiltersPanel.js";
import { LayersPanel } from "./LayersPanel.js";
import { TelemetryPanel } from "./TelemetryPanel.js";
import { ToolsPanel } from "./ToolsPanel.js";
import type { MeasurePoint, SidePanel, TelemetryData } from "./types.js";

interface CommandCenterSidePanelProps {
  sidePanel: SidePanel;
  telemetry: TelemetryData;
  measuring: boolean;
  measurePoints: MeasurePoint[];
  totalDistance: number;
  activeDataset?: DatasetRecord;
  datasetHasPoints: boolean;
  datasetHasPolygons: boolean;
  showDatasetPoints: boolean;
  layerVisibility: Record<string, boolean>;
  datasetSelection: string;
  datasets: DatasetRecord[];
  projectLayers: Layer[];
  projectFeatureError?: unknown;
  projectFeatureTruncated: boolean;
  filterText: string;
  filterType: string;
  activeGeoJson: GeoJSON.FeatureCollection;
  onClose: () => void;
  onToggleMeasure: () => void;
  onSetLayerVisibility: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  onSetDatasetSelection: (value: string) => void;
  onSetFilterText: (text: string) => void;
  onSetFilterType: (type: string) => void;
  onClearFilters: () => void;
  onHandleMyLocation: () => void;
  onSetSidePanel: (panel: SidePanel) => void;
  toast: (options: {
    title: string;
    description?: string;
    variant?: "default" | "error" | "success";
  }) => void;
}

export function CommandCenterSidePanel({
  sidePanel,
  telemetry,
  measuring,
  measurePoints,
  totalDistance,
  activeDataset,
  datasetHasPoints,
  datasetHasPolygons,
  showDatasetPoints,
  layerVisibility,
  datasetSelection,
  datasets,
  projectLayers,
  projectFeatureError,
  projectFeatureTruncated,
  filterText,
  filterType,
  activeGeoJson,
  onClose,
  onToggleMeasure,
  onSetLayerVisibility,
  onSetDatasetSelection,
  onSetFilterText,
  onSetFilterType,
  onClearFilters,
  onHandleMyLocation,
  onSetSidePanel,
  toast,
}: CommandCenterSidePanelProps) {
  if (
    sidePanel === "none" ||
    sidePanel === "baixar-mapas" ||
    sidePanel.endsWith("-offline")
  ) {
    return null;
  }

  const panelBg =
    "absolute z-20 bg-surface-container border border-outline-variant shadow-2xl";
  const panelPos =
    "bottom-[calc(8rem+env(safe-area-inset-bottom))] left-3 right-3 lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:h-full lg:w-80";
  const panelRound = "rounded-2xl lg:rounded-none lg:rounded-l-2xl";
  const labelClass = "text-on-surface font-semibold text-sm";
  const subtitleClass = "text-on-surface-variant text-xs";
  const valueClass = "text-on-surface font-mono font-bold text-sm";

  return (
    <div
      className={`${panelBg} ${panelPos} ${panelRound} flex flex-col max-h-[55vh] lg:max-h-full overflow-y-auto`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
        <span className="text-on-surface font-bold text-base flex items-center gap-2">
          <AppIcon
            name={
              sidePanel === "telemetria"
                ? "telemetry"
                : sidePanel === "camadas"
                  ? "layers"
                  : sidePanel === "filtros"
                    ? "filters"
                    : "tools"
            }
            size="md"
          />
          {sidePanel === "telemetria"
            ? "Telemetria"
            : sidePanel === "camadas"
              ? "Camadas"
              : sidePanel === "filtros"
                ? "Filtros"
                : "Ferramentas"}
        </span>
        <button
          type="button"
          aria-label="Fechar painel do mapa"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
        >
          <AppIcon name="close" size="sm" />
        </button>
      </div>

      {sidePanel === "telemetria" && (
        <TelemetryPanel
          telemetry={telemetry}
          measuring={measuring}
          measurePoints={measurePoints}
          totalDistance={totalDistance}
          onToggleMeasure={onToggleMeasure}
          labelClass={labelClass}
          subtitleClass={subtitleClass}
          valueClass={valueClass}
        />
      )}

      {sidePanel === "camadas" && (
        <LayersPanel
          activeDataset={activeDataset}
          datasetHasPoints={datasetHasPoints}
          datasetHasPolygons={datasetHasPolygons}
          showDatasetPoints={showDatasetPoints}
          layerVisibility={layerVisibility}
          datasetSelection={datasetSelection}
          datasets={datasets}
          projectLayers={projectLayers}
          projectFeatureError={projectFeatureError}
          projectFeatureTruncated={projectFeatureTruncated}
          onSetLayerVisibility={onSetLayerVisibility}
          onSetDatasetSelection={onSetDatasetSelection}
          subtitleClass={subtitleClass}
        />
      )}

      {sidePanel === "filtros" && (
        <FiltersPanel
          filterText={filterText}
          filterType={filterType}
          activeGeoJson={activeGeoJson}
          onSetFilterText={onSetFilterText}
          onSetFilterType={onSetFilterType}
          onClearFilters={onClearFilters}
          labelClass={labelClass}
          subtitleClass={subtitleClass}
        />
      )}

      {sidePanel === "ferramentas" && (
        <ToolsPanel
          activeDataset={activeDataset}
          telemetry={telemetry}
          onToggleMeasure={onToggleMeasure}
          onHandleMyLocation={onHandleMyLocation}
          onSetSidePanel={onSetSidePanel}
          toast={toast}
          subtitleClass={subtitleClass}
        />
      )}
    </div>
  );
}
