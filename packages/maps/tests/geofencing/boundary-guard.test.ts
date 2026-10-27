import { describe, it, expect } from "vitest";
import {
  BoundaryGuard,
  calculateMinDistanceToPolygonMeters,
  isPointInPolygonInternal,
  normalizePolygonRings,
  isPointInRing,
} from "../../src/geofencing/boundary-guard.js";
import type { GeofenceZone } from "../../src/geofencing/engine.js";
import { MEAN_EARTH_RADIUS_M } from "@markmap/geo";

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

  it("detects when user is INSIDE, APPROACHING, BOUNDARY_CROSSED or OUTSIDE property boundaries", () => {
    const guard = new BoundaryGuard([propertyZone], { warningThresholdMeters: 5000 });

    // Far outside
    const resFar = guard.evaluateBoundaryPosition([-47.0, -15.0]);
    expect(resFar.alerts[0]?.status).toBe("OUTSIDE");

    // Inside property (primeiro fix após estar fora: cruza a divisa)
    const resCrossing = guard.evaluateBoundaryPosition([-47.95, -16.05]);
    expect(resCrossing.alerts[0]?.status).toBe("BOUNDARY_CROSSED");
    expect(resCrossing.events[0]?.type).toBe("ENTERED");

    // Estabelecido no interior da propriedade (> 5000m dos limites)
    // No quadrado [-48.0, -16.0] a [-47.9, -16.1], o centro [-47.95, -16.05] está a ~5500m das divisas
    const resInside = guard.evaluateBoundaryPosition([-47.95, -16.05]);
    expect(resInside.alerts[0]?.status).toBe("INSIDE");

    // Cruzando de volta para fora
    const resExiting = guard.evaluateBoundaryPosition([-47.0, -15.0]);
    expect(resExiting.events[0]?.type).toBe("EXITED");
    expect(resExiting.alerts[0]?.status).toBe("BOUNDARY_CROSSED");
  });

  it("emits BOUNDARY_CROSSED when transitioning between inside and outside", () => {
    const guard = new BoundaryGuard([propertyZone], { warningThresholdMeters: 50 });

    // Começa dentro
    const step1 = guard.evaluateBoundaryPosition([-47.95, -16.05]);
    expect(step1.alerts[0]?.status).toBe("INSIDE");

    // Transita para fora da propriedade
    const step2 = guard.evaluateBoundaryPosition([-47.85, -16.05]);
    expect(step2.alerts[0]?.status).toBe("BOUNDARY_CROSSED");

    // Permanece fora, longe da divisa
    const step3 = guard.evaluateBoundaryPosition([-47.85, -16.05]);
    expect(step3.alerts[0]?.status).toBe("OUTSIDE");

    // Retorna para dentro da propriedade
    const step4 = guard.evaluateBoundaryPosition([-47.95, -16.05]);
    expect(step4.alerts[0]?.status).toBe("BOUNDARY_CROSSED");
  });

  it("detects APPROACHING status when within warningThresholdMeters", () => {
    // Um polígono simples em torno da latitude -16.0
    const mPerLat = (Math.PI / 180) * MEAN_EARTH_RADIUS_M;
    // 30 metros ao norte da borda norte (-16.0)
    const lat30mNorth = -16.0 + 30 / mPerLat;

    const guard = new BoundaryGuard([propertyZone], { warningThresholdMeters: 50 });

    const res = guard.evaluateBoundaryPosition([-47.95, lat30mNorth]);
    expect(res.alerts[0]?.status).toBe("APPROACHING");
    expect(res.alerts[0]?.distanceToBoundaryMeters).toBeCloseTo(30, 0);
  });

  it("handles rural property polygons with holes (internal islands / CAR exclusions)", () => {
    // Fazenda com anel externo e um furo de servidão no meio
    // Anel externo: [-48.0, -16.0] até [-47.9, -16.1]
    // Anel interno (furo): [-47.96, -16.04] até [-47.94, -16.06]
    const polygonWithHole: [number, number][][] = [
      [
        [-48.0, -16.0],
        [-47.9, -16.0],
        [-47.9, -16.1],
        [-48.0, -16.1],
        [-48.0, -16.0],
      ],
      [
        [-47.96, -16.04],
        [-47.94, -16.04],
        [-47.94, -16.06],
        [-47.96, -16.06],
        [-47.96, -16.04],
      ],
    ];

    // Ponto na fazenda fora do furo
    expect(isPointInPolygonInternal([-47.92, -16.05], polygonWithHole)).toBe(true);

    // Ponto dentro do furo (área de servidão/excluída)
    expect(isPointInPolygonInternal([-47.95, -16.05], polygonWithHole)).toBe(false);

    // Ponto fora de todo o polígono
    expect(isPointInPolygonInternal([-47.85, -16.05], polygonWithHole)).toBe(false);

    // BoundaryGuard deve aceitar zona com anel interno
    const guardWithHole = new BoundaryGuard(
      [
        {
          id: "fazenda-com-furo",
          name: "Fazenda com Enclave",
          polygon: polygonWithHole,
        },
      ],
      { warningThresholdMeters: 50 }
    );

    // Avaliação no furo deve retornar OUTSIDE ou APPROACHING em relação à borda do furo
    const alertHole = guardWithHole.evaluateBoundaryPosition([-47.95, -16.05]);
    expect(alertHole.alerts[0]?.status).not.toBe("INSIDE");
  });

  it("calculates accurate orthogonal and vertex distances using local equirectangular projection", () => {
    const square: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ];

    // Ponto exatamente no centro (0.5, 0.5) na latitude 0 (equador)
    const mPerDeg = (Math.PI / 180) * MEAN_EARTH_RADIUS_M; // ~111194.93 m
    const expectedDist = 0.5 * mPerDeg; // Distância ortogonal até qualquer uma das 4 arestas

    const calculatedDist = calculateMinDistanceToPolygonMeters([0.5, 0.5], square);
    expect(calculatedDist).toBeCloseTo(expectedDist, -1); // tolerância < 10m em 55km

    // Ponto ortogonal a 10 metros da borda sul (y = -10m / mPerDeg)
    const pointSouth: [number, number] = [0.5, -10 / mPerDeg];
    const distSouth = calculateMinDistanceToPolygonMeters(pointSouth, square);
    expect(distSouth).toBeCloseTo(10, 0);

    // Ponto diagonal próximo ao vértice (0, 0): (-10m, -10m)
    const pointCorner: [number, number] = [-10 / mPerDeg, -10 / mPerDeg];
    const distCorner = calculateMinDistanceToPolygonMeters(pointCorner, square);
    const expectedCornerDist = Math.sqrt(10 * 10 + 10 * 10); // ~14.14m
    expect(distCorner).toBeCloseTo(expectedCornerDist, 0);
  });

  it("normalizes polygon rings correctly", () => {
    const singleRing: [number, number][] = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    const multiRings: [number, number][][] = [singleRing, singleRing];

    expect(normalizePolygonRings(singleRing)).toEqual([singleRing]);
    expect(normalizePolygonRings(multiRings)).toEqual(multiRings);
    expect(normalizePolygonRings([])).toEqual([]);
    expect(normalizePolygonRings([[] as unknown as [number, number]])).toEqual([]);
  });

  it("evaluates isPointInRing correctly", () => {
    const ring: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    expect(isPointInRing([5, 5], ring)).toBe(true);
    expect(isPointInRing([15, 5], ring)).toBe(false);
    expect(isPointInRing([5, 15], ring)).toBe(false);
    expect(isPointInRing([5, 5], [])).toBe(false);
  });
});
