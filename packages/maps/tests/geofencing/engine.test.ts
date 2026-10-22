import { describe, it, expect } from "vitest";
import { GeofenceEngine, type GeofenceZone } from "../../src/geofencing/engine.js";

describe("Geofence Engine", () => {
  const zone: GeofenceZone = {
    id: "zone-1",
    name: "Restricted Area",
    polygon: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  };

  it("detects ENTERED transition when user moves inside polygon", () => {
    const engine = new GeofenceEngine([zone]);
    const eventsOutside = engine.updatePosition([15, 15]);
    expect(eventsOutside).toHaveLength(0);

    const eventsInside = engine.updatePosition([5, 5]);
    expect(eventsInside).toHaveLength(1);
    expect(eventsInside[0].type).toBe("ENTERED");
    expect(eventsInside[0].zoneId).toBe("zone-1");
  });
});
