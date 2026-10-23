import { convertArea } from "../units/survey.js";

export type SigefVertexType = "M" | "P" | "V" | "UNKNOWN";

export interface SigefVertex {
  code: string;
  type: SigefVertexType;
  coordinate: [number, number]; // [lon, lat]
  altitude?: number;
  sigmaPositionMeters?: number;
  isCompliant: boolean;
}

export interface SigefParcelReport {
  parcelCode?: string;
  denomination?: string;
  ownerName?: string;
  areaHa?: number;
  areaAlqueiresPaulista?: number;
  perimeterMeters: number;
  vertices: SigefVertex[];
  complianceSummary: {
    totalVertices: number;
    marcoCount: number;
    virtualCount: number;
    verticeCount: number;
    nonCompliantCount: number;
    isFullyCompliant: boolean;
  };
}

/**
 * INCRA precision limits per vertex type (Norma Técnica 3ª Edição)
 */
export const INCRA_PRECISION_LIMITS: Record<Extract<SigefVertexType, "M" | "P" | "V">, number> = {
  M: 0.1, // Marco: 10 cm
  V: 0.5, // Vértice: 50 cm
  P: 3.0, // Ponto Virtual: 3.0 m
};

export function classifySigefVertexType(typeCodeStr: string = ""): SigefVertexType {
  const code = String(typeCodeStr).toUpperCase().trim();
  if (code.startsWith("M") || code.includes("MARCO")) return "M";
  if (code.startsWith("V") || code.includes("VERTICE")) return "V";
  if (code.startsWith("P") || code.includes("VIRTUAL")) return "P";
  return "UNKNOWN";
}

/**
 * Calculates Euclidean perimeter of a closed geographic ring in approximate meters.
 */
function calculateRingPerimeter(ring: Array<[number, number]>): number {
  let meters = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i]!;
    const p2 = ring[i + 1]!;
    const dx = (p2[0] - p1[0]) * 111000 * Math.cos((((p1[1] + p2[1]) / 2) * Math.PI) / 180);
    const dy = (p2[1] - p1[1]) * 111000;
    meters += Math.sqrt(dx * dx + dy * dy);
  }
  return Number(meters.toFixed(2));
}

/**
 * Parses and audits a SIGEF parcel GeoJSON feature.
 */
export function parseSigefParcel(feature: any): SigefParcelReport {
  if (!feature || typeof feature !== "object" || !feature.geometry) {
    throw new TypeError("Invalid SIGEF parcel feature");
  }

  const props = feature.properties || {};
  const geom = feature.geometry;

  let coordinates: Array<[number, number]> = [];
  if (geom.type === "Polygon" && Array.isArray(geom.coordinates) && geom.coordinates[0]) {
    coordinates = geom.coordinates[0];
  } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates) && geom.coordinates[0]?.[0]) {
    coordinates = geom.coordinates[0][0];
  }

  const perimeterMeters = calculateRingPerimeter(coordinates);

  const rawAreaHa = props.area_ha || props.num_area || props.area;
  const areaHa = Number.isFinite(Number(rawAreaHa)) ? Number(rawAreaHa) : undefined;
  const areaSqMeters = areaHa !== undefined ? areaHa * 10000 : 0;
  const areaAlqueiresPaulista = areaSqMeters > 0 ? Number(convertArea(areaSqMeters, "alqueire_paulista").toFixed(2)) : undefined;

  const rawVertices: any[] = Array.isArray(props.vertices) ? props.vertices : coordinates.map((c, idx) => ({ code: `VERT-${idx + 1}`, coord: c }));

  let marcoCount = 0;
  let virtualCount = 0;
  let verticeCount = 0;
  let nonCompliantCount = 0;

  const vertices: SigefVertex[] = rawVertices.map((v, i) => {
    const type = classifySigefVertexType(v.type || v.codigo || v.code);
    const sigma = Number.isFinite(Number(v.sigma)) ? Number(v.sigma) : undefined;
    const limit = type !== "UNKNOWN" ? INCRA_PRECISION_LIMITS[type] : 0.5;
    const isCompliant = sigma !== undefined ? sigma <= limit : true;

    if (type === "M") marcoCount++;
    else if (type === "P") virtualCount++;
    else if (type === "V") verticeCount++;

    if (!isCompliant) nonCompliantCount++;

    return {
      code: v.code || `V-${i + 1}`,
      type,
      coordinate: Array.isArray(v.coord) ? v.coord : coordinates[i] || [0, 0],
      altitude: Number.isFinite(Number(v.altitude)) ? Number(v.altitude) : undefined,
      sigmaPositionMeters: sigma,
      isCompliant,
    };
  });

  return {
    parcelCode: props.cod_parcela || props.codigo_parcela || props.id,
    denomination: props.denominacao || props.nome_imovel,
    ownerName: props.detentor || props.proprietario,
    areaHa,
    areaAlqueiresPaulista,
    perimeterMeters,
    vertices,
    complianceSummary: {
      totalVertices: vertices.length,
      marcoCount,
      virtualCount,
      verticeCount,
      nonCompliantCount,
      isFullyCompliant: nonCompliantCount === 0,
    },
  };
}
