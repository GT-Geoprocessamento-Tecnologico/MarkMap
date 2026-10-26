export interface TelemetryData {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface MeasurePoint {
  lng: number;
  lat: number;
}

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
