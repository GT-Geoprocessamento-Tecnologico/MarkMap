export interface GeofenceZone {
  id: string;
  name: string;
  polygon: Array<[number, number]>; // [lon, lat]
}

export interface GeofenceEvent {
  zoneId: string;
  type: "ENTERED" | "EXITED";
  timestamp: number;
}

export class GeofenceEngine {
  private states: Map<string, boolean> = new Map();

  constructor(private zones: GeofenceZone[]) {
    if (!Array.isArray(zones)) throw new TypeError("Geofence zones must be an array");
    for (const zone of zones) this.validateZone(zone);
  }

  updatePosition(coord: [number, number]): GeofenceEvent[] {
    this.validateCoordinate(coord, "Geofence position");
    const events: GeofenceEvent[] = [];
    const now = Date.now();

    for (const zone of this.zones) {
      const isInside = this.isPointInPolygon(coord, zone.polygon);
      const wasInside = this.states.get(zone.id) || false;

      if (isInside && !wasInside) {
        this.states.set(zone.id, true);
        events.push({ zoneId: zone.id, type: "ENTERED", timestamp: now });
      } else if (!isInside && wasInside) {
        this.states.set(zone.id, false);
        events.push({ zoneId: zone.id, type: "EXITED", timestamp: now });
      }
    }

    return events;
  }

  private isPointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const current = polygon[i]!;
      const previous = polygon[j]!;
      const [xi, yi] = current;
      const [xj, yj] = previous;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private validateZone(zone: GeofenceZone): void {
    if (!zone || typeof zone !== "object" || typeof zone.id !== "string" || zone.id.length === 0 || !Array.isArray(zone.polygon) || zone.polygon.length < 3) {
      throw new TypeError("Geofence zone must have an id and a polygon with at least three vertices");
    }
    for (const vertex of zone.polygon) this.validateCoordinate(vertex, "Geofence polygon vertex");
  }

  private validateCoordinate(coord: [number, number], label: string): void {
    if (!Array.isArray(coord) || coord.length !== 2 || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1]) || coord[0] < -180 || coord[0] > 180 || coord[1] < -90 || coord[1] > 90) {
      throw new TypeError(`${label} must be a finite [longitude, latitude] pair within WGS84 bounds`);
    }
  }
}
