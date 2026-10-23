import { GeofenceEngine, type GeofenceZone } from "../geofencing/engine.js";

export type BoundaryEventStatus = "INSIDE" | "OUTSIDE" | "APPROACHING" | "BOUNDARY_CROSSED";

export interface BoundaryAlert {
  zoneId: string;
  zoneName: string;
  status: BoundaryEventStatus;
  distanceToBoundaryMeters: number;
  timestamp: number;
}

export interface BoundaryGuardOptions {
  warningThresholdMeters?: number; // Distance in meters to trigger APPROACHING warning
}

export class BoundaryGuard extends GeofenceEngine {
  private warningThreshold: number;
  private lastDistances: Map<string, number> = new Map();
  private readonly boundaryZones: readonly GeofenceZone[];

  constructor(zones: GeofenceZone[], options: BoundaryGuardOptions = {}) {
    super(zones);
    this.boundaryZones = zones.slice();
    this.warningThreshold = options.warningThresholdMeters ?? 50; // default 50 meters
  }

  /**
   * Evaluates user position against property boundaries (CAR/SIGEF), checking if inside,
   * approaching, or crossing boundaries.
   */
  evaluateBoundaryPosition(coord: [number, number]): {
    events: Array<{ zoneId: string; type: "ENTERED" | "EXITED"; timestamp: number }>;
    alerts: BoundaryAlert[];
  } {
    const events = super.updatePosition(coord);
    const alerts: BoundaryAlert[] = [];
    const now = Date.now();

    for (const zone of this.boundaryZones) {
      const minDistance = this.calculateMinDistanceToPolygonMeters(coord, zone.polygon);
      this.lastDistances.set(zone.id, minDistance);

      const isInside = this.isPointInPolygonInternal(coord, zone.polygon);
      let status: BoundaryEventStatus = isInside ? "INSIDE" : "OUTSIDE";

      if (!isInside && minDistance <= this.warningThreshold) {
        status = "APPROACHING";
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

  private calculateMinDistanceToPolygonMeters(point: [number, number], polygon: Array<[number, number]>): number {
    let minDst = Number.POSITIVE_INFINITY;
    const [px, py] = point;
    const latRad = (py * Math.PI) / 180;
    const mPerLat = 111000;
    const mPerLon = 111000 * Math.cos(latRad);

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const p1 = polygon[i]!;
      const p2 = polygon[j]!;

      const x1 = p1[0] * mPerLon;
      const y1 = p1[1] * mPerLat;
      const x2 = p2[0] * mPerLon;
      const y2 = p2[1] * mPerLat;
      const cx = px * mPerLon;
      const cy = py * mPerLat;

      const A = cx - x1;
      const B = cy - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;

      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      const dx = cx - xx;
      const dy = cy - yy;
      const dst = Math.sqrt(dx * dx + dy * dy);
      if (dst < minDst) minDst = dst;
    }

    return Number(minDst.toFixed(2));
  }

  private isPointInPolygonInternal(point: [number, number], polygon: Array<[number, number]>): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i]!;
      const [xj, yj] = polygon[j]!;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
