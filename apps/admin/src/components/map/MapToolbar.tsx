import type { GeometryType as DrawingGeometryType, DrawingSession } from "@markmap/maps";
import { AppIcon, type AppIconName } from "../AppIcon";

export type SidePanel =
  | "none"
  | "ferramentas"
  | "filtros"
  | "camadas"
  | "telemetria"
  | "busca-offline"
  | "lugares-offline"
  | "altitude-offline"
  | "navegacao-offline"
  | "baixar-mapas";

interface MapToolbarProps {
  sidePanel: SidePanel;
  onTogglePanel: (panel: SidePanel) => void;
  onMyLocation: () => void;
  measuring: boolean;
  onToggleMeasure: () => void;
  drawingSession: DrawingSession | null;
  onStartDrawing: (type: DrawingGeometryType) => void;
}

export function ToolBtn({
  active,
  onClick,
  icon,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  icon: AppIconName;
  label: string;
  color: string;
}) {
  const activeColors: Record<string, string> = {
    cyan: "bg-cyan-500/15 border-cyan-400/40 text-cyan-400",
    blue: "bg-blue-500/15 border-blue-400/40 text-blue-400",
    violet: "bg-violet-500/15 border-violet-400/40 text-violet-400",
    slate: "bg-white/10 border-white/15 text-on-surface",
    emerald: "bg-emerald-500/15 border-emerald-400/40 text-emerald-400",
    amber: "bg-amber-500/15 border-amber-400/40 text-amber-400",
  };
  const idleClass =
    "bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`min-h-[44px] min-w-[44px] shrink-0 p-2.5 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
        active ? (activeColors[color] ?? activeColors["slate"]) : idleClass
      }`}
    >
      <AppIcon name={icon} size="lg" />
    </button>
  );
}

export function MapToolbar({
  sidePanel,
  onTogglePanel,
  onMyLocation,
  measuring,
  onToggleMeasure,
  drawingSession,
  onStartDrawing,
}: MapToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Atalhos do mapa"
      className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 lg:bottom-auto lg:top-6 lg:left-4 lg:translate-x-0 markmap-map-tools bg-surface-container/90 backdrop-blur-xl border border-outline-variant rounded-2xl p-2 flex lg:flex-col gap-1.5 shadow-2xl z-10 w-max max-w-[92vw] overflow-x-auto lg:max-h-[calc(100%-3rem)] lg:overflow-x-hidden lg:overflow-y-auto"
    >
      {/* Telemetria */}
      <ToolBtn
        active={sidePanel === "telemetria"}
        onClick={() => onTogglePanel("telemetria")}
        icon="telemetry"
        label="Telemetria"
        color="cyan"
      />
      {/* Camadas */}
      <ToolBtn
        active={sidePanel === "camadas"}
        onClick={() => onTogglePanel("camadas")}
        icon="layers"
        label="Camadas"
        color="blue"
      />
      {/* Filtros */}
      <ToolBtn
        active={sidePanel === "filtros"}
        onClick={() => onTogglePanel("filtros")}
        icon="filters"
        label="Filtros"
        color="violet"
      />
      {/* Ferramentas */}
      <ToolBtn
        active={sidePanel === "ferramentas"}
        onClick={() => onTogglePanel("ferramentas")}
        icon="tools"
        label="Ferramentas"
        color="slate"
      />
      {/* Escolha uma região e baixe diretamente do mapa. */}
      <ToolBtn
        active={sidePanel === "baixar-mapas"}
        onClick={() => onTogglePanel("baixar-mapas")}
        icon="download"
        label="Baixar mapas"
        color="emerald"
      />
      {/* Atalhos offline no mesmo menu; os serviços seguem montados ao fechar. */}
      <ToolBtn
        active={sidePanel === "busca-offline"}
        onClick={() => onTogglePanel("busca-offline")}
        icon="search"
        label="Buscar locais neste mapa"
        color="cyan"
      />
      <ToolBtn
        active={sidePanel === "lugares-offline"}
        onClick={() => onTogglePanel("lugares-offline")}
        icon="map"
        label="Lugares e transporte offline"
        color="blue"
      />
      <ToolBtn
        active={sidePanel === "altitude-offline"}
        onClick={() => onTogglePanel("altitude-offline")}
        icon="analytics"
        label="Altitude"
        color="emerald"
      />
      <ToolBtn
        active={sidePanel === "navegacao-offline"}
        onClick={() => onTogglePanel("navegacao-offline")}
        icon="coordinates"
        label="Navegação GPS offline"
        color="amber"
      />
      {/* Separador */}
      <div className="w-full h-px md:block hidden bg-outline-variant my-0.5" />
      <div className="w-px h-8 md:hidden block bg-outline-variant mx-0.5" />
      {/* Minha localização */}
      <ToolBtn
        active={false}
        onClick={onMyLocation}
        icon="location"
        label="Minha localização"
        color="emerald"
      />
      {/* Medir */}
      <ToolBtn
        active={measuring}
        onClick={onToggleMeasure}
        icon="measure"
        label={measuring ? "Encerrar medição" : "Medir distância"}
        color="amber"
      />
      <ToolBtn
        active={drawingSession?.type === "Point"}
        onClick={() => onStartDrawing("Point")}
        icon="point"
        label="Adicionar ponto"
        color="cyan"
      />
      <ToolBtn
        active={drawingSession?.type === "LineString"}
        onClick={() => onStartDrawing("LineString")}
        icon="line"
        label="Desenhar linha"
        color="blue"
      />
      <ToolBtn
        active={drawingSession?.type === "Polygon"}
        onClick={() => onStartDrawing("Polygon")}
        icon="polygon"
        label="Desenhar polígono"
        color="violet"
      />
    </div>
  );
}
