export type CarLayerType =
  | "AREA_IMOVEL"
  | "APP"
  | "RESERVA_LEGAL"
  | "USO_RESTRITO"
  | "CONSOLIDADA"
  | "UNKNOWN";

export interface CarLayerStyle {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
}

export const OFFICIAL_CAR_STYLES: Record<CarLayerType, CarLayerStyle> = {
  AREA_IMOVEL: {
    fillColor: "#FF9800",
    fillOpacity: 0.15,
    strokeColor: "#E65100",
    strokeWidth: 2,
  },
  APP: {
    fillColor: "#00BCD4",
    fillOpacity: 0.4,
    strokeColor: "#006064",
    strokeWidth: 1.5,
  },
  RESERVA_LEGAL: {
    fillColor: "#4CAF50",
    fillOpacity: 0.45,
    strokeColor: "#1B5E20",
    strokeWidth: 1.5,
  },
  USO_RESTRITO: {
    fillColor: "#9C27B0",
    fillOpacity: 0.3,
    strokeColor: "#4A148C",
    strokeWidth: 1.5,
  },
  CONSOLIDADA: {
    fillColor: "#FFEB3B",
    fillOpacity: 0.3,
    strokeColor: "#F57F17",
    strokeWidth: 1,
  },
  UNKNOWN: {
    fillColor: "#9E9E9E",
    fillOpacity: 0.2,
    strokeColor: "#424242",
    strokeWidth: 1,
  },
};

export interface NormalizedCarFeature {
  id?: string;
  carCode?: string;
  layerType: CarLayerType;
  status?: "ATIVO" | "PENDENTE" | "SUSPENSO" | "CANCELADO" | string;
  areaHa?: number;
  municipality?: string;
  state?: string;
  style: CarLayerStyle;
  rawProperties: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
}

/**
 * Classifies raw CAR layer strings or property names into official CAR layer types.
 */
export function classifyCarLayer(layerNameOrType: string = ""): CarLayerType {
  const normalized = String(layerNameOrType).toUpperCase().trim();

  if (normalized.includes("IMOVEL") || normalized.includes("AREA_IMOVEL") || normalized.includes("PROPRIEDADE")) {
    return "AREA_IMOVEL";
  }
  if (normalized.includes("APP") || normalized.includes("PRESERVACAO_PERMANENTE")) {
    return "APP";
  }
  if (normalized.includes("RESERVA") || normalized.includes("RL") || normalized.includes("RESERVA_LEGAL")) {
    return "RESERVA_LEGAL";
  }
  if (normalized.includes("RESTRITO") || normalized.includes("USO_RESTRITO")) {
    return "USO_RESTRITO";
  }
  if (normalized.includes("CONSOLIDADA") || normalized.includes("USO_CONSOLIDADO")) {
    return "CONSOLIDADA";
  }

  return "UNKNOWN";
}

/**
 * Parses and normalizes a CAR GeoJSON feature collection.
 */
export function parseCarGeoJson(geoJson: unknown): NormalizedCarFeature[] {
  if (!geoJson || typeof geoJson !== "object") {
    throw new TypeError("Invalid CAR GeoJSON data");
  }

  const document = geoJson as GeoJSON.FeatureCollection | GeoJSON.Feature;
  const features = document.type === "FeatureCollection" ? document.features : document.type === "Feature" ? [document] : [];

  return features.map((feature: GeoJSON.Feature, index: number) => {
    const props = feature.properties || {};

    const rawType = props.layer || props.tipo_tema || props.TIPO_IMOVEL || props.nom_tema || props.layerType || "";
    const layerType = classifyCarLayer(rawType);

    const carCode = props.cod_imovel || props.COD_IMOVEL || props.car_code || props.cod_state || undefined;
    const status = props.status || props.ind_status || props.SITUACAO || undefined;
    const areaHa = props.num_area || props.area_ha || props.AREA_HA ? Number(props.num_area || props.area_ha || props.AREA_HA) : undefined;
    const municipality = props.nom_mun || props.municipio || props.MUNICIPIO || undefined;
    const state = props.cod_estado || props.uf || props.UF || undefined;

    return {
      id: String(feature.id ?? props.gid ?? `car-feat-${index}`),
      carCode,
      layerType,
      status,
      ...(typeof areaHa === "number" && Number.isFinite(areaHa) ? { areaHa } : {}),
      municipality,
      state,
      style: OFFICIAL_CAR_STYLES[layerType],
      rawProperties: props,
      geometry: feature.geometry,
    };
  });
}
