import { MEAN_EARTH_RADIUS_M } from '@markmap/geo';
import { GeofenceEngine, type GeofenceZone } from './engine.js';

export type BoundaryEventStatus =
  | 'INSIDE'
  | 'SAFE'
  | 'OUTSIDE'
  | 'APPROACHING'
  | 'BOUNDARY_CROSSED';

export interface BoundaryAlert {
  zoneId: string;
  zoneName: string;
  status: BoundaryEventStatus;
  distanceToBoundaryMeters: number;
  timestamp: number;
}

export interface BoundaryGuardOptions {
  /** Distância em metros para disparar o aviso APPROACHING (padrão: 50m) */
  warningThresholdMeters?: number;
}

export type LinearRing = Array<[number, number]>;
export type PolygonCoordinates = LinearRing[];
export type MultiPolygonCoordinates = PolygonCoordinates[];

export interface BoundaryZone {
  id: string;
  name: string;
  polygon: LinearRing | PolygonCoordinates;
}

/**
 * Normaliza polígonos para o formato GeoJSON PolygonCoordinates ([number, number][][]).
 * Garante retrocompatibilidade com anéis simples legados ([number, number][]).
 */
export function normalizePolygonRings(
  polygon: LinearRing | PolygonCoordinates,
): PolygonCoordinates {
  if (!Array.isArray(polygon) || polygon.length === 0) {
    return [];
  }
  const first = polygon[0];
  if (!Array.isArray(first) || first.length === 0) {
    return [];
  }
  if (typeof first[0] === 'number') {
    // Anel simples legado: [ [lng, lat], [lng, lat], ... ]
    return [polygon as LinearRing];
  }
  // Múltiplos anéis GeoJSON: [ [ [lng, lat], ... ], [ [lng, lat], ... ] ]
  return polygon as PolygonCoordinates;
}

/**
 * Testa se um ponto [lng, lat] está contido dentro de um anel linear via Ray Casting.
 */
export function isPointInRing(
  point: [number, number],
  ring: readonly [number, number][],
): boolean {
  const [x, y] = point;
  let inside = false;
  const n = ring.length;
  if (n < 3) return false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const p1 = ring[i];
    const p2 = ring[j];
    if (!p1 || !p2) continue;
    const [xi, yi] = p1;
    const [xj, yj] = p2;

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Testa se uma coordenada [lng, lat] está dentro do anel externo e fora de anéis internos (furos).
 */
export function isPointInPolygonInternal(
  point: [number, number],
  polygon: LinearRing | PolygonCoordinates,
): boolean {
  const rings = normalizePolygonRings(polygon);
  if (rings.length === 0) return false;

  const outerRing = rings[0];
  if (!outerRing || outerRing.length < 3) return false;

  // 1. Deve estar contido no anel exterior
  if (!isPointInRing(point, outerRing)) {
    return false;
  }

  // 2. Não deve estar contido em nenhum anel interior (furo / área excluída)
  for (let k = 1; k < rings.length; k++) {
    const holeRing = rings[k];
    if (holeRing && holeRing.length >= 3 && isPointInRing(point, holeRing)) {
      return false;
    }
  }

  return true;
}

/**
 * Calcula a menor distância perpendicular ou aos vértices (em metros) de um ponto [lng, lat]
 * até todos os segmentos de borda de um polígono (anel externo e furos).
 * Emprega projeção equirretangular local tangente de alta performance baseada no raio geodésico canônico.
 */
export function calculateMinDistanceToPolygonMeters(
  point: [number, number],
  polygon: LinearRing | PolygonCoordinates,
): number {
  const rings = normalizePolygonRings(polygon);
  if (rings.length === 0) return Number.POSITIVE_INFINITY;

  const [px, py] = point;
  const latRad = (py * Math.PI) / 180;
  const mPerLat = (Math.PI / 180) * MEAN_EARTH_RADIUS_M; // ~111194.93 m/deg
  const mPerLon = mPerLat * Math.cos(latRad);

  let minDstSq = Number.POSITIVE_INFINITY;

  for (const ring of rings) {
    const n = ring.length;
    if (n < 2) continue;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const p1 = ring[i];
      const p2 = ring[j];
      if (!p1 || !p2) continue;

      // Coordenadas métricas relativas ao ponto do usuário (origem 0,0)
      const x1 = (p1[0] - px) * mPerLon;
      const y1 = (p1[1] - py) * mPerLat;
      const x2 = (p2[0] - px) * mPerLon;
      const y2 = (p2[1] - py) * mPerLat;

      const vx = x2 - x1;
      const vy = y2 - y1;
      const lenSq = vx * vx + vy * vy;

      let qx: number;
      let qy: number;

      if (lenSq === 0) {
        // Segmento degenerado num único ponto
        qx = x1;
        qy = y1;
      } else {
        // Projeção escalar de (0 - A) sobre V
        const t = -(x1 * vx + y1 * vy) / lenSq;
        if (t <= 0) {
          qx = x1;
          qy = y1;
        } else if (t >= 1) {
          qx = x2;
          qy = y2;
        } else {
          qx = x1 + t * vx;
          qy = y1 + t * vy;
        }
      }

      const dstSq = qx * qx + qy * qy;
      if (dstSq < minDstSq) {
        minDstSq = dstSq;
      }
    }
  }

  if (!Number.isFinite(minDstSq)) {
    return Number.POSITIVE_INFINITY;
  }

  const minDst = Math.sqrt(minDstSq);
  return Number(minDst.toFixed(2));
}

/**
 * BoundaryGuard com suporte a CAR/SIGEF, furos internos, telemetria de aproximação
 * e detecção confiável de cruzamento de fronteira (BOUNDARY_CROSSED).
 */
export class BoundaryGuard extends GeofenceEngine {
  private warningThreshold: number;
  private lastDistances: Map<string, number> = new Map();
  private lastInsideStates: Map<string, boolean> = new Map();
  private readonly boundaryZones: readonly BoundaryZone[];

  constructor(
    zones: Array<GeofenceZone | BoundaryZone>,
    options: BoundaryGuardOptions = {},
  ) {
    // Compatibilidade com a validação da GeofenceEngine base
    const geofenceCompatibleZones: GeofenceZone[] = zones.map((z) => {
      const rings = normalizePolygonRings(z.polygon);
      return {
        id: z.id,
        name: z.name,
        polygon: rings[0] ?? (z.polygon as LinearRing),
      };
    });

    super(geofenceCompatibleZones);
    this.boundaryZones = zones.slice();
    this.warningThreshold = options.warningThresholdMeters ?? 50;
  }

  /**
   * Avalia a posição do usuário em relação aos limites cadastrais (CAR / SIGEF).
   */
  evaluateBoundaryPosition(coord: [number, number]): {
    events: Array<{ zoneId: string; type: 'ENTERED' | 'EXITED'; timestamp: number }>;
    alerts: BoundaryAlert[];
  } {
    const events = super.updatePosition(coord);
    const alerts: BoundaryAlert[] = [];
    const now = Date.now();

    for (const zone of this.boundaryZones) {
      const minDistance = this.calculateMinDistanceToPolygonMeters(coord, zone.polygon);
      this.lastDistances.set(zone.id, minDistance);

      const isInside = this.isPointInPolygonInternal(coord, zone.polygon);
      const wasInside = this.lastInsideStates.get(zone.id);
      this.lastInsideStates.set(zone.id, isInside);

      let status: BoundaryEventStatus = isInside ? 'INSIDE' : 'OUTSIDE';

      // 1. Detecção de cruzamento de divisa
      if (wasInside !== undefined && wasInside !== isInside) {
        status = 'BOUNDARY_CROSSED';
      }
      // 2. Alerta de proximidade métrica (< 50m da cerca)
      else if (minDistance <= this.warningThreshold) {
        status = 'APPROACHING';
      }

      alerts.push({
        zoneId: zone.id,
        zoneName: zone.name,
        status,
        distanceToBoundaryMeters: minDistance,
        timestamp: now,
      });
    }

    return { events, alerts };
  }

  calculateMinDistanceToPolygonMeters(
    point: [number, number],
    polygon: LinearRing | PolygonCoordinates,
  ): number {
    return calculateMinDistanceToPolygonMeters(point, polygon);
  }

  isPointInPolygonInternal(
    point: [number, number],
    polygon: LinearRing | PolygonCoordinates,
  ): boolean {
    return isPointInPolygonInternal(point, polygon);
  }
}
