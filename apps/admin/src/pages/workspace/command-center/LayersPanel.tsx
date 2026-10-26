import React from "react";
import type { Layer } from "@markmap/contracts";
import type { DatasetRecord } from "../../../lib/datasets/dataset-store.js";

interface LayersPanelProps {
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
  onSetLayerVisibility: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  onSetDatasetSelection: (value: string) => void;
  subtitleClass: string;
}

export function LayersPanel({
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
  onSetLayerVisibility,
  onSetDatasetSelection,
  subtitleClass,
}: LayersPanelProps) {
  return (
    <div className="p-5 space-y-3">
      <p className={`${subtitleClass} uppercase tracking-wider`}>
        Gerenciar camadas visíveis
      </p>
      <div className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-surface-variant transition-colors">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0 bg-cyan-500" />
          <span className="text-on-surface text-sm font-medium">
            {activeDataset?.name ?? "Dataset selecionado"}
          </span>
        </div>
        <button
          type="button"
          aria-label="Alternar dataset local"
          aria-pressed={layerVisibility.dataset}
          disabled={!activeDataset}
          onClick={() =>
            onSetLayerVisibility((prev) => ({
              ...prev,
              dataset: !prev.dataset,
            }))
          }
          className={`w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0 ${
            layerVisibility.dataset ? "bg-secondary" : "bg-on-surface/15"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface-container shadow transition-all duration-200 ${
              layerVisibility.dataset ? "left-[calc(100%-22px)]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {activeDataset && datasetHasPoints && (
        <div className="flex items-center justify-between py-2 px-3 pl-6 rounded-lg border border-outline-variant/60 bg-surface-container text-xs text-on-surface">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-cyan-400" />
            <span>
              {datasetHasPolygons
                ? "Pontos e marcos dos vértices"
                : "Pontos do dataset"}
            </span>
          </div>
          <button
            type="button"
            aria-label="Alternar pontos do dataset"
            aria-pressed={showDatasetPoints}
            disabled={!layerVisibility.dataset}
            onClick={() =>
              onSetLayerVisibility((prev) => ({
                ...prev,
                datasetPoints: !showDatasetPoints,
              }))
            }
            className={`h-5 w-9 rounded-full relative transition-colors duration-200 flex-shrink-0 ${
              showDatasetPoints && layerVisibility.dataset
                ? "bg-secondary"
                : "bg-on-surface/15"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                showDatasetPoints && layerVisibility.dataset
                  ? "translate-x-4"
                  : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      )}
      {!activeDataset && (
        <p className="text-on-surface-variant text-sm">
          Selecione um dataset local abaixo ou importe um arquivo.
        </p>
      )}
      <label className="block text-xs font-semibold text-on-surface-variant">
        Dataset local (opcional)
        <select
          aria-label="Selecionar dataset local"
          value={datasetSelection}
          onChange={(event) => onSetDatasetSelection(event.target.value)}
          className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container px-2 py-2 text-sm text-on-surface"
        >
          <option value="none">Nenhum dataset</option>
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </option>
          ))}
        </select>
      </label>
      {projectLayers.map((layer) => (
        <div
          key={layer.id}
          className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface"
        >
          <span>{layer.name}</span>
          <button
            type="button"
            aria-label={`Alternar camada ${layer.name}`}
            aria-pressed={layerVisibility[layer.id] ?? layer.visibleByDefault}
            onClick={() =>
              onSetLayerVisibility((prev) => ({
                ...prev,
                [layer.id]: !(prev[layer.id] ?? layer.visibleByDefault),
              }))
            }
            className={`h-5 w-9 rounded-full ${
              (layerVisibility[layer.id] ?? layer.visibleByDefault)
                ? "bg-secondary"
                : "bg-on-surface/15"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                (layerVisibility[layer.id] ?? layer.visibleByDefault)
                  ? "translate-x-4"
                  : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      ))}
      {projectFeatureError != null && (
        <p role="alert" className="text-sm text-red-400">
          Não foi possível carregar as feições do projeto:{" "}
          {projectFeatureError instanceof Error
            ? projectFeatureError.message
            : "erro desconhecido"}
        </p>
      )}
      {projectFeatureTruncated && (
        <p className="text-xs text-on-surface-variant">
          Consulta parcial: até 100 camadas e 10.000 feições por projeto.
        </p>
      )}
    </div>
  );
}
