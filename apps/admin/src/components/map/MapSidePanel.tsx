import type { SidePanel } from "./MapToolbar";
import { formatDistance, type MeasurePoint } from "./MapDrawingControl";
import { AppIcon, type AppIconName } from "../AppIcon";
import type { DatasetRecord } from "../../lib/datasets/dataset-store";
import { exportDatasetGeoJSON } from "../../lib/datasets/dataset-store";
import { useToast } from "@markmap/ui";

export interface TelemetryData {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface ProjectLayerItem {
  id: string;
  name: string;
  visibleByDefault: boolean;
}

interface MapSidePanelProps {
  sidePanel: SidePanel;
  onClose: () => void;
  // Telemetry props
  telemetry: TelemetryData;
  measuring: boolean;
  measurePoints: MeasurePoint[];
  totalDistance: number;
  onToggleMeasure: () => void;
  // Camadas props
  activeDataset?: DatasetRecord;
  datasetHasPoints: boolean;
  datasetHasPolygons: boolean;
  showDatasetPoints: boolean;
  layerVisibility: Record<string, boolean>;
  onToggleLayerVisibility: (key: string) => void;
  onToggleDatasetPoints: () => void;
  datasetSelection: string;
  onSelectDataset: (id: string) => void;
  datasets: DatasetRecord[];
  projectLayers: ProjectLayerItem[];
  projectFeatureError?: unknown;
  projectFeatureTruncated?: boolean;
  // Filtros props
  filterText: string;
  onFilterTextChange: (text: string) => void;
  filterType: string;
  onFilterTypeChange: (type: string) => void;
  activeGeoJsonFeatures: GeoJSON.Feature[];
  onClearFilters: () => void;
  // Ferramentas props
  onMyLocation: () => void;
}

export function Row({
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

export function MapSidePanel({
  sidePanel,
  onClose,
  telemetry,
  measuring,
  measurePoints,
  totalDistance,
  onToggleMeasure,
  activeDataset,
  datasetHasPoints,
  datasetHasPolygons,
  showDatasetPoints,
  layerVisibility,
  onToggleLayerVisibility,
  onToggleDatasetPoints,
  datasetSelection,
  onSelectDataset,
  datasets,
  projectLayers,
  projectFeatureError,
  projectFeatureTruncated,
  filterText,
  onFilterTextChange,
  filterType,
  onFilterTypeChange,
  activeGeoJsonFeatures,
  onClearFilters,
  onMyLocation,
}: MapSidePanelProps) {
  const { toast } = useToast();

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
      {/* Header do painel */}
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
          aria-label="Fechar painel do mapa"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
        >
          <AppIcon name="close" size="sm" />
        </button>
      </div>

      {/* Conteúdo: TELEMETRIA */}
      {sidePanel === "telemetria" && (
        <div className="p-5 space-y-4">
          <div>
            <p className={subtitleClass + " mb-2 uppercase tracking-wider"}>
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
            <p className={subtitleClass + " mb-2 uppercase tracking-wider"}>
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
                <p className={subtitleClass + " mb-2 uppercase tracking-wider"}>
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
              onClick={onToggleMeasure}
              className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-semibold hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
            >
              <AppIcon name="measure" size="sm" />
              Iniciar medição de distância
            </button>
          )}
        </div>
      )}

      {/* Conteúdo: CAMADAS */}
      {sidePanel === "camadas" && (
        <div className="p-5 space-y-3">
          <p className={subtitleClass + " uppercase tracking-wider"}>
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
              aria-label="Alternar dataset local"
              aria-pressed={layerVisibility.dataset}
              disabled={!activeDataset}
              onClick={() => onToggleLayerVisibility("dataset")}
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
                aria-label="Alternar pontos do dataset"
                aria-pressed={showDatasetPoints}
                disabled={!layerVisibility.dataset}
                onClick={onToggleDatasetPoints}
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
              onChange={(event) => onSelectDataset(event.target.value)}
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
                aria-label={`Alternar camada ${layer.name}`}
                aria-pressed={
                  layerVisibility[layer.id] ?? layer.visibleByDefault
                }
                onClick={() => onToggleLayerVisibility(layer.id)}
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
                : String(projectFeatureError ?? "erro desconhecido")}
            </p>
          )}
          {projectFeatureTruncated && (
            <p className="text-xs text-on-surface-variant">
              Consulta parcial: até 100 camadas e 10.000 feições por projeto.
            </p>
          )}
        </div>
      )}

      {/* Conteúdo: FILTROS */}
      {sidePanel === "filtros" && (
        <div className="p-5 space-y-4">
          <p className={subtitleClass + " uppercase tracking-wider"}>
            Filtrar feições no mapa
          </p>
          <div>
            <label className={labelClass + " block mb-1.5"}>
              Busca por nome
            </label>
            <input
              aria-label="Buscar nas propriedades das feições"
              type="text"
              value={filterText}
              onChange={(e) => onFilterTextChange(e.target.value)}
              placeholder="Ex: Fazenda, Sítio..."
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
            />
          </div>
          <div>
            <label className={labelClass + " block mb-1.5"}>
              Tipo de feição
            </label>
            <select
              aria-label="Tipo de feição"
              value={filterType}
              onChange={(e) => onFilterTypeChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
            >
              <option value="todos">Todos os tipos</option>
              <option value="Point">Pontos</option>
              <option value="LineString">Linhas</option>
              <option value="Polygon">Polígonos</option>
              <option value="Multi">Multi-geometrias</option>
            </select>
          </div>
          <div className="h-px bg-surface-variant" />
          {filterText && (
            <div className="space-y-2">
              <p className={subtitleClass}>Resultados para "{filterText}":</p>
              {activeGeoJsonFeatures.slice(0, 100).map((feature, index) => (
                <div
                  key={String(feature.id ?? index)}
                  className="px-3 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant"
                >
                  <p className="text-on-surface font-semibold text-sm">
                    {String(
                      feature.properties?.name ??
                        feature.id ??
                        `Feição ${index + 1}`,
                    )}
                  </p>
                  <p className="text-on-surface-variant text-xs">
                    {JSON.stringify(feature.properties)}
                  </p>
                </div>
              ))}
              {activeGeoJsonFeatures.length === 0 && (
                <p className="text-on-surface-variant text-sm text-center py-4">
                  Nenhuma feição encontrada.
                </p>
              )}
            </div>
          )}
          <button
            onClick={onClearFilters}
            className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-variant transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Conteúdo: FERRAMENTAS */}
      {sidePanel === "ferramentas" && (
        <div className="p-5 space-y-3">
          <p className={subtitleClass + " uppercase tracking-wider"}>
            Ferramentas disponíveis
          </p>
          {[
            {
              icon: "measure" as AppIconName,
              label: "Medir Distância",
              desc: "Clique em pontos no mapa para medir.",
              action: () => {
                onToggleMeasure();
              },
            },
            {
              icon: "location" as AppIconName,
              label: "Minha Localização",
              desc: "Centralizar o mapa na sua posição atual.",
              action: onMyLocation,
            },
            {
              icon: "download" as AppIconName,
              label: "Exportar Dados",
              desc: "Exportar o dataset selecionado em GeoJSON.",
              action: () => {
                if (activeDataset)
                  void exportDatasetGeoJSON(activeDataset.id).catch((cause) =>
                    toast({
                      title: "Exportação não concluída",
                      description:
                        cause instanceof Error
                          ? cause.message
                          : "Falha ao exportar.",
                      variant: "error",
                    }),
                  );
                else
                  toast({
                    title: "Nenhum dataset selecionado",
                    variant: "error",
                  });
              },
            },
            {
              icon: "copy" as AppIconName,
              label: "Copiar coordenadas",
              desc: "Copiar o centro atual do mapa.",
              action: async () => {
                const value = `${telemetry.lat.toFixed(6)}, ${telemetry.lng.toFixed(6)}`;
                try {
                  if (!navigator.clipboard?.writeText)
                    throw new Error("Cópia indisponível neste dispositivo.");
                  await navigator.clipboard.writeText(value);
                  toast({
                    title: "Coordenadas copiadas",
                    description: value,
                    variant: "success",
                  });
                } catch (cause) {
                  toast({
                    title: "Não foi possível copiar",
                    description:
                      cause instanceof Error
                        ? cause.message
                        : "Verifique a permissão de cópia.",
                    variant: "error",
                  });
                }
              },
            },
            {
              icon: "upload" as AppIconName,
              label: "Importar dataset",
              desc: "Abrir a página de importação local.",
              action: () => {
                window.location.href = "/imports";
              },
            },
          ].map((tool) => (
            <button
              key={tool.icon}
              onClick={tool.action}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-primary/10 hover:border-primary/30 transition-colors text-left"
            >
              <AppIcon name={tool.icon} size="md" className="mt-0.5" />
              <div>
                <p className="text-on-surface font-semibold text-sm">
                  {tool.label}
                </p>
                <p className="text-on-surface-variant text-xs mt-0.5">
                  {tool.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
