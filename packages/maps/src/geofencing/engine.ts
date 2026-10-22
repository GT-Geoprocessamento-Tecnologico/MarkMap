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

  constructor(private zones: GeofenceZone[]) {}

  updatePosition(coord: [number, number]): GeofenceEvent[] {
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
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
