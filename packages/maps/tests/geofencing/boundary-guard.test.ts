import { describe, it, expect } from "vitest";
import { BoundaryGuard } from "../../src/geofencing/boundary-guard.js";
import type { GeofenceZone } from "../../src/geofencing/engine.js";

describe("BoundaryGuard for Brazilian Rural Properties (CAR / SIGEF)", () => {
  const propertyZone: GeofenceZone = {
    id: "car-fazenda-boa-vista",
    name: "Fazenda Boa Vista",
    polygon: [
      [-48.0, -16.0],
      [-47.9, -16.0],
      [-47.9, -16.1],
      [-48.0, -16.1],
      [-48.0, -16.0],
    ],
  };

  it("detects when user is INSIDE, APPROACHING, or OUTSIDE property boundaries", () => {
    const guard = new BoundaryGuard([propertyZone], { warningThresholdMeters: 5000 });

    // Far outside
    const resFar = guard.evaluateBoundaryPosition([-47.0, -15.0]);
    expect(resFar.alerts[0]?.status).toBe("OUTSIDE");

    // Inside property
    const resInside = guard.evaluateBoundaryPosition([-47.95, -16.05]);
    expect(resInside.alerts[0]?.status).toBe("INSIDE");
    expect(resInside.events[0]?.type).toBe("ENTERED");

    // Exiting property
    const resExiting = guard.evaluateBoundaryPosition([-47.0, -15.0]);
    expect(resExiting.events[0]?.type).toBe("EXITED");
  });
});
