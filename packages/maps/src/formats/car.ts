import { measureAreaSquareMeters, type GeoNexoFeature } from "@markmap/geo";

export type CarLayerType =
  | "AREA_IMOVEL"
  | "RESERVA_LEGAL"
  | "APP"
  | "VEG_NATIVA"
  | "HIDROGRAFIA"
  | "AREA_CONSOLIDADA"
  | "CONSOLIDADA" // Alias para compatibilidade
  | "USO_RESTRITO"
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
    strokeWidth: 2.0,
  },
  RESERVA_LEGAL: {
    fillColor: "#2E7D32",
    fillOpacity: 0.4,
    strokeColor: "#1B5E20",
    strokeWidth: 1.5,
  },
  APP: {
    fillColor: "#00BCD4",
    fillOpacity: 0.4,
    strokeColor: "#006064",
    strokeWidth: 1.5,
  },
  VEG_NATIVA: {
    fillColor: "#4CAF50",
    fillOpacity: 0.35,
    strokeColor: "#2E7D32",
    strokeWidth: 1.5,
  },
  HIDROGRAFIA: {
    fillColor: "#2196F3",
    fillOpacity: 0.5,
    strokeColor: "#0D47A1",
    strokeWidth: 1.5,
  },
  AREA_CONSOLIDADA: {
    fillColor: "#FFEB3B",
    fillOpacity: 0.3,
    strokeColor: "#F57F17",
    strokeWidth: 1.2,
  },
  CONSOLIDADA: {
    fillColor: "#FFEB3B",
    fillOpacity: 0.3,
    strokeColor: "#F57F17",
    strokeWidth: 1.2,
  },
  USO_RESTRITO: {
    fillColor: "#9C27B0",
    fillOpacity: 0.3,
    strokeColor: "#4A148C",
    strokeWidth: 1.5,
  },
  UNKNOWN: {
    fillColor: "#9E9E9E",
    fillOpacity: 0.2,
    strokeColor: "#424242",
    strokeWidth: 1.0,
  },
};

export const CAR_LAYER_LABELS: Record<CarLayerType, string> = {
  AREA_IMOVEL: "Área do Imóvel",
  RESERVA_LEGAL: "Reserva Legal",
  APP: "Área de Preservação Permanente (APP)",
  VEG_NATIVA: "Vegetação Nativa",
  HIDROGRAFIA: "Hidrografia",
  AREA_CONSOLIDADA: "Área Consolidada",
  CONSOLIDADA: "Área Consolidada",
  USO_RESTRITO: "Uso Restrito",
  UNKNOWN: "Outras Feições",
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

export interface CarLayerSummary {
  layerType: CarLayerType;
  label: string;
  count: number;
  areaHa: number;
  areaSqMeters: number;
  style: CarLayerStyle;
}

export interface CarPropertySummary {
  carCode?: string;
  municipality?: string;
  state?: string;
  status?: string;
  areaImovelHa: number;
  areaImovelSqMeters: number;
  areaReservaLegalHa: number;
  areaReservaLegalSqMeters: number;
  reservaLegalPercent: number; // 0 a 100
  isCarDataset: boolean;
  layers: CarLayerSummary[];
}

/**
 * Normalizes input string removing accents, diacritics and whitespace.
 */
export function normalizeCarString(str: unknown): string {
  if (str == null) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Extracts possible candidate text representing the CAR layer from a property bag.
 */
export function extractCarLayerCandidate(props: Record<string, unknown>): string {
  const candidates = [
    props.layerType,
    props.layer,
    props.LAYER,
    props.tipo_tema,
    props.TIPO_TEMA,
    props.nom_tema,
    props.NOM_TEMA,
    props.tema,
    props.TEMA,
    props.classe,
    props.CLASSE,
    props.tipo,
    props.TIPO,
    props.TIPO_IMOVEL,
    props.rotulo,
    props.ROTULO,
    props.descricao,
    props.DESCRICAO,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      return c;
    }
  }
  return "";
}

/**
 * Classifies raw CAR layer strings or property records into official CAR layer types.
 * Fully case-insensitive and diacritics-insensitive.
 */
export function classifyCarLayer(
  layerNameOrProps: string | Record<string, unknown> = "",
): CarLayerType {
  let raw = "";
  if (typeof layerNameOrProps === "object" && layerNameOrProps !== null) {
    raw = extractCarLayerCandidate(layerNameOrProps);
  } else {
    raw = String(layerNameOrProps ?? "");
  }

  const normalized = normalizeCarString(raw);
  if (!normalized) return "UNKNOWN";

  // APP (Preservação Permanente)
  if (
    /(?:^|[^A-Z0-9])APP(?:[^A-Z0-9]|$)/.test(normalized) ||
    normalized.startsWith("APP_") ||
    normalized.endsWith("_APP") ||
    normalized.includes("PRESERVACAO") ||
    normalized.includes("PERMANENTE")
  ) {
    return "APP";
  }

  // Reserva Legal
  if (
    normalized.includes("RESERVA") ||
    /(?:^|[^A-Z0-9])RL(?:[^A-Z0-9]|$)/.test(normalized) ||
    normalized.startsWith("RL_") ||
    normalized.endsWith("_RL")
  ) {
    return "RESERVA_LEGAL";
  }

  // Vegetação Nativa
  if (
    normalized.includes("VEG_NATIVA") ||
    normalized.includes("VEGETACAO") ||
    normalized.includes("REMANESCENTE") ||
    /(?:^|[^A-Z0-9])NATIV[AO]S?(?:[^A-Z0-9]|$)/.test(normalized)
  ) {
    return "VEG_NATIVA";
  }

  // Hidrografia
  if (
    normalized.includes("HIDRO") ||
    normalized.includes("CURSO D'AGUA") ||
    normalized.includes("CURSO DAGUA") ||
    normalized.includes("CURSO_DAGUA") ||
    normalized.includes("NASCENTE") ||
    normalized.includes("CORREGO") ||
    /(?:^|[^A-Z0-9])RIO(?:[^A-Z0-9]|$)/.test(normalized) ||
    normalized.includes("LAGO") ||
    normalized.includes("REPRESA") ||
    normalized.includes("MASSA D'AGUA") ||
    normalized.includes("MASSA DAGUA") ||
    /(?:^|[^A-Z0-9])AGUAS?(?:[^A-Z0-9]|$)/.test(normalized)
  ) {
    return "HIDROGRAFIA";
  }

  // Área Consolidada
  if (
    normalized.includes("CONSOLIDADA") ||
    normalized.includes("CONSOLIDADO") ||
    normalized.includes("ANTROPICA") ||
    normalized.includes("AGROPECUARI")
  ) {
    return "AREA_CONSOLIDADA";
  }

  // Uso Restrito
  if (
    normalized.includes("RESTRITO") ||
    normalized.includes("DECLIVIDADE")
  ) {
    return "USO_RESTRITO";
  }

  // Área do Imóvel / Perímetro
  if (
    normalized.includes("IMOVEL") ||
    normalized.includes("PROPRIEDADE") ||
    normalized.includes("PERIMETRO")
  ) {
    return "AREA_IMOVEL";
  }

  return "UNKNOWN";
}

/**
 * Computes a comprehensive CAR summary from an array of features.
 * Calculates total property area, Legal Reserve area, % of Legal Reserve and
 * discriminates each layer with geodetic areas and official styling.
 */
export function computeCarSummary(
  features: readonly (GeoNexoFeature | GeoJSON.Feature | Record<string, unknown>)[],
): CarPropertySummary {
  if (!features || !Array.isArray(features) || features.length === 0) {
    return {
      areaImovelHa: 0,
      areaImovelSqMeters: 0,
      areaReservaLegalHa: 0,
      areaReservaLegalSqMeters: 0,
      reservaLegalPercent: 0,
      isCarDataset: false,
      layers: [],
    };
  }

  let carCode: string | undefined;
  let municipality: string | undefined;
  let state: string | undefined;
  let status: string | undefined;
  let carFeatureCount = 0;

  const layerMap = new Map<CarLayerType, { count: number; areaHa: number; areaSqMeters: number }>();

  for (const item of features) {
    const feat = item as GeoJSON.Feature;
    const props = (feat.properties ?? (item as Record<string, unknown>)) as Record<string, unknown>;
    const rawType = extractCarLayerCandidate(props) || (typeof item === "string" ? item : "");
    const classified = classifyCarLayer(rawType || props);

    if (classified !== "UNKNOWN") {
      carFeatureCount++;
    }

    // Capture metadata (prefer AREA_IMOVEL properties or first available)
    if (!carCode || classified === "AREA_IMOVEL") {
      const code = props.cod_imovel || props.COD_IMOVEL || props.car_code || props.carCode || props.cod_state;
      if (code) carCode = String(code);
    }
    if (!municipality || classified === "AREA_IMOVEL") {
      const mun = props.nom_mun || props.municipio || props.MUNICIPIO || props.municipality;
      if (mun) municipality = String(mun);
    }
    if (!state || classified === "AREA_IMOVEL") {
      const uf = props.cod_estado || props.uf || props.UF || props.state;
      if (uf) state = String(uf);
    }
    if (!status || classified === "AREA_IMOVEL") {
      const st = props.status || props.ind_status || props.SITUACAO || props.situacao;
      if (st) status = String(st);
    }

    // Calculate feature area
    let areaSqMeters = 0;
    let areaHa = 0;

    if (
      feat.geometry &&
      typeof feat.geometry === "object" &&
      (feat.geometry.type === "Polygon" || feat.geometry.type === "MultiPolygon")
    ) {
      try {
        areaSqMeters = measureAreaSquareMeters(feat as unknown as GeoNexoFeature);
        areaHa = areaSqMeters / 10000;
      } catch {
        areaSqMeters = 0;
        areaHa = 0;
      }
    }

    const rawArea = props.num_area ?? props.area_ha ?? props.AREA_HA ?? props.area;
    if (rawArea != null) {
      const parsedArea = Number(String(rawArea).trim().replace(",", "."));
      if (!isNaN(parsedArea) && parsedArea > 0) {
        areaHa = parsedArea;
        if (areaSqMeters === 0) {
          areaSqMeters = areaHa * 10000;
        }
      }
    }

    // Normalize CONSOLIDADA to AREA_CONSOLIDADA
    const canonicalType: CarLayerType = classified === "CONSOLIDADA" ? "AREA_CONSOLIDADA" : classified;

    const existing = layerMap.get(canonicalType) ?? { count: 0, areaHa: 0, areaSqMeters: 0 };
    existing.count += 1;
    existing.areaHa += areaHa;
    existing.areaSqMeters += areaSqMeters;
    layerMap.set(canonicalType, existing);
  }

  const imovelData = layerMap.get("AREA_IMOVEL");
  const rlData = layerMap.get("RESERVA_LEGAL");

  const areaImovelHa = imovelData ? imovelData.areaHa : 0;
  const areaImovelSqMeters = imovelData ? imovelData.areaSqMeters : 0;
  const areaReservaLegalHa = rlData ? rlData.areaHa : 0;
  const areaReservaLegalSqMeters = rlData ? rlData.areaSqMeters : 0;

  const reservaLegalPercent = areaImovelHa > 0 ? (areaReservaLegalHa / areaImovelHa) * 100 : 0;

  const ORDERED_TYPES: CarLayerType[] = [
    "AREA_IMOVEL",
    "RESERVA_LEGAL",
    "APP",
    "VEG_NATIVA",
    "HIDROGRAFIA",
    "AREA_CONSOLIDADA",
    "USO_RESTRITO",
  ];

  const layers: CarLayerSummary[] = [];
  for (const t of ORDERED_TYPES) {
    const data = layerMap.get(t);
    if (data && data.count > 0) {
      layers.push({
        layerType: t,
        label: CAR_LAYER_LABELS[t],
        count: data.count,
        areaHa: Number(data.areaHa.toFixed(4)),
        areaSqMeters: Number(data.areaSqMeters.toFixed(2)),
        style: OFFICIAL_CAR_STYLES[t],
      });
    }
  }

  // Include UNKNOWN if present
  const unknownData = layerMap.get("UNKNOWN");
  if (unknownData && unknownData.count > 0 && carFeatureCount > 0) {
    layers.push({
      layerType: "UNKNOWN",
      label: CAR_LAYER_LABELS.UNKNOWN,
      count: unknownData.count,
      areaHa: Number(unknownData.areaHa.toFixed(4)),
      areaSqMeters: Number(unknownData.areaSqMeters.toFixed(2)),
      style: OFFICIAL_CAR_STYLES.UNKNOWN,
    });
  }

  return {
    ...(carCode ? { carCode } : {}),
    ...(municipality ? { municipality } : {}),
    ...(state ? { state } : {}),
    ...(status ? { status } : {}),
    areaImovelHa: Number(areaImovelHa.toFixed(4)),
    areaImovelSqMeters: Number(areaImovelSqMeters.toFixed(2)),
    areaReservaLegalHa: Number(areaReservaLegalHa.toFixed(4)),
    areaReservaLegalSqMeters: Number(areaReservaLegalSqMeters.toFixed(2)),
    reservaLegalPercent: Number(reservaLegalPercent.toFixed(2)),
    isCarDataset: carFeatureCount > 0,
    layers,
  };
}

export type EnrichedCarProperties = Record<string, unknown> & {
  _carFillColor?: string;
  _carFillOpacity?: number;
  _carStrokeColor?: string;
  _carStrokeWidth?: number;
  _carLayerType?: CarLayerType;
};

/**
 * Enriches a feature's properties with official CAR styling properties
 * for seamless MapLibre data-driven rendering.
 */
export function enrichFeatureWithCarStyle<T extends { type: "Feature"; properties?: Record<string, unknown> | null }>(
  feature: T,
): Omit<T, "properties"> & { properties: EnrichedCarProperties } {
  const props = ((feature && feature.properties) ?? {}) as Record<string, unknown>;
  const layerType = classifyCarLayer(props);
  if (layerType === "UNKNOWN") {
    return { ...feature, properties: props as EnrichedCarProperties };
  }

  const style = OFFICIAL_CAR_STYLES[layerType];
  return {
    ...feature,
    properties: {
      ...props,
      _carFillColor: style.fillColor,
      _carFillOpacity: style.fillOpacity,
      _carStrokeColor: style.strokeColor,
      _carStrokeWidth: style.strokeWidth,
      _carLayerType: layerType,
    },
  };
}

/**
 * Enriches an entire GeoJSON FeatureCollection with CAR data-driven style attributes.
 */
export function enrichGeoJsonWithCarStyles<
  T extends { type: "FeatureCollection"; features: { type: "Feature"; properties?: Record<string, unknown> | null }[] },
>(
  geojson: T,
): Omit<T, "features"> & {
  features: (Omit<T["features"][number], "properties"> & { properties: EnrichedCarProperties })[];
} {
  if (!geojson || !Array.isArray(geojson.features)) {
    return { ...geojson, features: [] };
  }
  return {
    ...geojson,
    features: geojson.features.map((f) => enrichFeatureWithCarStyle(f)),
  };
}


/**
 * Parses and normalizes a CAR GeoJSON feature collection.
 */
export function parseCarGeoJson(geoJson: unknown): NormalizedCarFeature[] {
  if (!geoJson || typeof geoJson !== "object") {
    throw new TypeError("Invalid CAR GeoJSON data");
  }

  const document = geoJson as GeoJSON.FeatureCollection | GeoJSON.Feature;
  const features =
    document.type === "FeatureCollection"
      ? document.features
      : document.type === "Feature"
        ? [document]
        : [];

  return features.map((feature: GeoJSON.Feature, index: number) => {
    const props = feature.properties || {};

    const rawType = extractCarLayerCandidate(props);
    const layerType = classifyCarLayer(rawType || props);

    const carCode = props.cod_imovel || props.COD_IMOVEL || props.car_code || props.cod_state || undefined;
    const status = props.status || props.ind_status || props.SITUACAO || undefined;
    const rawAreaVal = props.num_area ?? props.area_ha ?? props.AREA_HA ?? props.area;
    let areaHa: number | undefined;
    if (rawAreaVal != null) {
      const parsed = Number(String(rawAreaVal).trim().replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        areaHa = parsed;
      }
    }

    if (areaHa === undefined && feature.geometry && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
      try {
        const sqMeters = measureAreaSquareMeters(feature as unknown as GeoNexoFeature);
        areaHa = sqMeters / 10000;
      } catch {
        // ignore
      }
    }

    const municipality = props.nom_mun || props.municipio || props.MUNICIPIO || undefined;
    const state = props.cod_estado || props.uf || props.UF || undefined;

    return {
      id: String(feature.id ?? props.gid ?? `car-feat-${index}`),
      ...(carCode ? { carCode: String(carCode) } : {}),
      layerType,
      ...(status ? { status: String(status) } : {}),
      ...(typeof areaHa === "number" && Number.isFinite(areaHa) ? { areaHa } : {}),
      ...(municipality ? { municipality: String(municipality) } : {}),
      ...(state ? { state: String(state) } : {}),
      style: OFFICIAL_CAR_STYLES[layerType],
      rawProperties: props,
      geometry: feature.geometry,
    };
  });
}
