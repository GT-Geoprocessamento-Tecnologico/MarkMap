import { describe, it, expect } from "vitest";
import {
  BoundaryGuard,
  calculateMinDistanceToPolygonMeters,
  isPointInPolygonInternal,
  normalizePolygonRings,
  isPointInRing,
  type LinearRing,
  type PolygonCoordinates,
  type BoundaryZone,
} from "../../src/geofencing/boundary-guard.js";
import {
  MEAN_EARTH_RADIUS_M,
  geodesicDistanceM,
  destinationPoint,
} from "@markmap/geo";
import {
  createHorseshoePolygon,
  createStarPolygon,
  createMultiHoleFarm,
  createBoundaryZone,
  createFarmWithCentralHole,
} from "../fixtures/test-polygons.js";

describe("BoundaryGuard Adversarial & Empirical Stress Challenge", () => {
  // Standard conversion constant for latitude
  const mPerLat = (Math.PI / 180) * MEAN_EARTH_RADIUS_M;

  /* ==========================================================================
   * 1. COMPLEX POLYGONS & MULTIPLE CONCENTRIC HOLES
   * ========================================================================== */
  describe("1. Complex Geometries and Multiple Concentric Holes", () => {
    // Horseshoe-shaped polygon (U-shape / Concave)
    // The polygon wraps around an internal gap that is NOT part of the property but is inside the BBox
    const horseshoePolygon = createHorseshoePolygon([-47.925, -16.04], 0.025);

    it("accurately distinguishes interior vs external gap in concave horseshoe polygons", () => {
      // Point in left arm of horseshoe -> INSIDE
      expect(isPointInPolygonInternal([-47.94, -16.02], horseshoePolygon)).toBe(true);

      // Point in right arm of horseshoe -> INSIDE
      expect(isPointInPolygonInternal([-47.91, -16.05], horseshoePolygon)).toBe(true);

      // Point in central gap / concavity (inside envelope but OUTSIDE farm) -> OUTSIDE
      expect(isPointInPolygonInternal([-47.925, -16.06], horseshoePolygon)).toBe(false);

      // Minimum distance in the gap should be to the internal gap edges
      const distInBay = calculateMinDistanceToPolygonMeters([-47.925, -16.06], horseshoePolygon);
      expect(distInBay).toBeGreaterThan(0);
      expect(Number.isFinite(distInBay)).toBe(true);
    });

    // 5-pointed concave star polygon
    it("validates containment and distances in 5-pointed star polygon", () => {
      const starRing = createStarPolygon([-47.9, -15.8], 0.05);

      // Center of star is INSIDE
      expect(isPointInPolygonInternal([-47.9, -15.8], starRing)).toBe(true);

      // Point in one of the concave indentations (outside the star)
      const outerR = 0.05;
      const notchLng = -47.9 + (outerR * 0.8 * Math.cos(Math.PI / 5 - Math.PI / 2)) / Math.cos((-15.8 * Math.PI) / 180);
      const notchLat = -15.8 + outerR * 0.8 * Math.sin(Math.PI / 5 - Math.PI / 2);
      expect(isPointInPolygonInternal([notchLng, notchLat], starRing)).toBe(false);
    });

    // Rural property with multiple independent holes (Lakes / Protected Areas / Easements)
    it("supports farm with multiple independent holes (3 lakes/enclaves)", () => {
      const multiHoleFarm = createMultiHoleFarm([-47.9, -16.1], 0.1);

      // Point in free pasture -> INSIDE
      expect(isPointInPolygonInternal([-47.9, -16.04], multiHoleFarm)).toBe(true);

      // Point inside Hole 1 (NW Lake) -> OUTSIDE
      expect(isPointInPolygonInternal([-47.96, -16.04], multiHoleFarm)).toBe(false);

      // Point inside Hole 2 (NE Lake) -> OUTSIDE
      expect(isPointInPolygonInternal([-47.84, -16.04], multiHoleFarm)).toBe(false);

      // Point inside Hole 3 (South Easement) -> OUTSIDE
      expect(isPointInPolygonInternal([-47.9, -16.16], multiHoleFarm)).toBe(false);

      // Point outside entire farm -> OUTSIDE
      expect(isPointInPolygonInternal([-48.05, -16.1], multiHoleFarm)).toBe(false);

      // Distance from a pasture point 15m from NW Lake edge
      const mPerLon = mPerLat * Math.cos((-16.05 * Math.PI) / 180);
      const point15mEastOfHole: [number, number] = [-47.95 + 15 / mPerLon, -16.04];
      const dist = calculateMinDistanceToPolygonMeters(point15mEastOfHole, multiHoleFarm);
      expect(dist).toBeCloseTo(15, 0);
    });
  });

  /* ==========================================================================
   * 2. MILLIMETRIC PRECISION: LOCAL TANGENT VS WGS84 GEODESIC (0 to 200m)
   * ========================================================================== */
  describe("2. Millimetric Precision of Local Tangent Projection vs Canonical Geodesic", () => {
    // Test representative latitudes across Brazilian territory:
    // Equator (Macapá ~0°), Centro-Oeste (Brasília ~-15.8°), Sudeste (São Paulo ~-23.5°), Sul (Porto Alegre ~-30.0°)
    const latitudes = [0.0, -15.7801, -23.5505, -30.0346];
    const distancesToTest = [0.5, 1.0, 5.0, 10.0, 25.0, 50.0, 75.0, 100.0, 150.0, 200.0];
    const bearingsToTest = [0, 45, 90, 135, 180, 225, 270, 315, 63, 192];

    it("guarantees error strictly less than 1cm (< 0.01m) for all distances 0-200m at Brazilian latitudes", () => {
      let maxErrorFound = 0;

      for (const lat of latitudes) {
        const origin: [number, number] = [-47.9, lat];

        for (const targetDist of distancesToTest) {
          for (const bearing of bearingsToTest) {
            // Generate exact geodesic destination point using canonical Great-Circle Haversine
            const destCoord = destinationPoint(
              { latitude: origin[1], longitude: origin[0] },
              targetDist,
              bearing
            );
            const destPoint: [number, number] = [destCoord.longitude, destCoord.latitude];

            // Create a boundary segment passing through origin, orthogonal to the approach vector
            // To simplify measuring minimum distance: create a point/segment polygon whose
            // closest point to destPoint is exactly origin!
            const orthogonalBearing1 = (bearing + 90) % 360;
            const orthogonalBearing2 = (bearing + 270) % 360;

            const p1Coord = destinationPoint({ latitude: origin[1], longitude: origin[0] }, 50, orthogonalBearing1);
            const p2Coord = destinationPoint({ latitude: origin[1], longitude: origin[0] }, 50, orthogonalBearing2);

            const fenceSegment: LinearRing = [
              [p1Coord.longitude, p1Coord.latitude],
              [p2Coord.longitude, p2Coord.latitude],
            ];

            const calculatedDist = calculateMinDistanceToPolygonMeters(destPoint, fenceSegment);
            const trueGeodesicDist = geodesicDistanceM(
              { latitude: destPoint[1], longitude: destPoint[0] },
              { latitude: origin[1], longitude: origin[0] }
            );

            const absError = Math.abs(calculatedDist - trueGeodesicDist);
            if (absError > maxErrorFound) {
              maxErrorFound = absError;
            }

            // Empirical error MUST be less than 0.01m (1cm) for distances up to 200m
            expect(absError).toBeLessThan(0.01);
          }
        }
      }

      // Confirm that average/maximum precision is in the millimetric range
      expect(maxErrorFound).toBeLessThan(0.01);
    });
  });

  /* ==========================================================================
   * 3. STRICT DETERMINISM IN BOUNDARY_CROSSED EVENT TRANSITIONS
   * ========================================================================== */
  describe("3. Strict Determinism of BOUNDARY_CROSSED Transition", () => {
    const zoneSquare: BoundaryZone = {
      id: "fazenda-teste-determinismo",
      name: "Fazenda Determinismo",
      polygon: [
        [-48.0, -16.0],
        [-47.9, -16.0],
        [-47.9, -16.1],
        [-48.0, -16.1],
        [-48.0, -16.0],
      ],
    };

    it("emits BOUNDARY_CROSSED and events with absolute determinism over 100 round-trip crossing cycles", () => {
      const guard = new BoundaryGuard([zoneSquare], { warningThresholdMeters: 50 });

      // Interior point (> 50m from boundary)
      const insidePos: [number, number] = [-47.95, -16.05];
      // Exterior point (> 50m from boundary)
      const outsidePos: [number, number] = [-47.85, -16.05];

      // Initialization: first fix outside
      const initRes = guard.evaluateBoundaryPosition(outsidePos);
      expect(initRes.alerts[0]?.status).toBe("OUTSIDE");

      // Execute 100 complete round-trip crossings
      for (let cycle = 0; cycle < 100; cycle++) {
        // Crossing inward: OUTSIDE -> INSIDE
        const crossIn = guard.evaluateBoundaryPosition(insidePos);
        expect(crossIn.alerts[0]?.status).toBe("BOUNDARY_CROSSED");
        expect(crossIn.events).toHaveLength(1);
        expect(crossIn.events[0]?.type).toBe("ENTERED");

        // Remain inside
        const stayIn = guard.evaluateBoundaryPosition(insidePos);
        expect(stayIn.alerts[0]?.status).toBe("INSIDE");
        expect(stayIn.events).toHaveLength(0);

        // Crossing outward: INSIDE -> OUTSIDE
        const crossOut = guard.evaluateBoundaryPosition(outsidePos);
        expect(crossOut.alerts[0]?.status).toBe("BOUNDARY_CROSSED");
        expect(crossOut.events).toHaveLength(1);
        expect(crossOut.events[0]?.type).toBe("EXITED");

        // Remain outside
        const stayOut = guard.evaluateBoundaryPosition(outsidePos);
        expect(stayOut.alerts[0]?.status).toBe("OUTSIDE");
        expect(stayOut.events).toHaveLength(0);
      }
    });

    it("emits BOUNDARY_CROSSED when crossing the internal boundary of a hole (enclave)", () => {
      const farmWithHole: BoundaryZone = {
        id: "fazenda-furo-cruzamento",
        name: "Fazenda com Lago",
        polygon: [
          // Outer ring
          [
            [-48.0, -16.0],
            [-47.9, -16.0],
            [-47.9, -16.1],
            [-48.0, -16.1],
            [-48.0, -16.0],
          ],
          // Internal lake
          [
            [-47.96, -16.04],
            [-47.94, -16.04],
            [-47.94, -16.06],
            [-47.96, -16.06],
            [-47.96, -16.04],
          ],
        ],
      };

      const guard = new BoundaryGuard([farmWithHole], { warningThresholdMeters: 50 });

      // Point on farm outside the lake
      const pasturePos: [number, number] = [-47.98, -16.05];
      // Point inside the lake
      const lakePos: [number, number] = [-47.95, -16.05];

      // Fix 1: Pasture (inside the farm)
      const f1 = guard.evaluateBoundaryPosition(pasturePos);
      expect(f1.alerts[0]?.status).toBe("INSIDE");

      // Fix 2: Enter lake (outside usable farm area) -> BOUNDARY_CROSSED
      const f2 = guard.evaluateBoundaryPosition(lakePos);
      expect(f2.alerts[0]?.status).toBe("BOUNDARY_CROSSED");

      // Fix 3: Remain in lake
      const f3 = guard.evaluateBoundaryPosition(lakePos);
      expect(f3.alerts[0]?.status).toBe("OUTSIDE");

      // Fix 4: Return from lake to pasture -> BOUNDARY_CROSSED
      const f4 = guard.evaluateBoundaryPosition(pasturePos);
      expect(f4.alerts[0]?.status).toBe("BOUNDARY_CROSSED");
    });
  });

  /* ==========================================================================
   * 4. ROBUSTNESS AGAINST DEGENERATE AND EXTREME INPUTS
   * ========================================================================== */
  describe("4. Robustness Against Degenerate Inputs and Edge Cases", () => {
    it("handles polygons with less than 3 vertices safely without uncaught exceptions", () => {
      // Normalization with anomalous inputs
      expect(normalizePolygonRings([])).toEqual([]);
      expect(normalizePolygonRings([[] as unknown as [number, number]])).toEqual([]);
      expect(normalizePolygonRings([[1, 2], [3, 4]] as unknown as LinearRing)).toEqual([[[1, 2], [3, 4]]]);

      // 0 vertices
      expect(isPointInRing([0, 0], [])).toBe(false);
      expect(isPointInPolygonInternal([0, 0], [])).toBe(false);
      expect(calculateMinDistanceToPolygonMeters([0, 0], [])).toBe(Number.POSITIVE_INFINITY);

      // 1 vertex
      expect(isPointInRing([0, 0], [[0, 0]])).toBe(false);
      expect(isPointInPolygonInternal([0, 0], [[0, 0]])).toBe(false);
      expect(calculateMinDistanceToPolygonMeters([0, 0], [[0, 0]])).toBe(Number.POSITIVE_INFINITY);

      // 2 vertices (straight line, no area)
      expect(isPointInRing([0, 0], [[0, 0], [1, 1]])).toBe(false);
      expect(isPointInPolygonInternal([0, 0], [[0, 0], [1, 1]])).toBe(false);
      // calculateMinDistanceToPolygonMeters calculates distance to edge normally
      expect(calculateMinDistanceToPolygonMeters([0, 0], [[0, 0], [1, 1]])).toBe(0);
    });

    it("resists NaN and infinite coordinates without breaking", () => {
      const validSquare: LinearRing = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ];

      // Point with NaN
      expect(isPointInPolygonInternal([Number.NaN, 0], validSquare)).toBe(false);
      expect(isPointInPolygonInternal([0, Number.NaN], validSquare)).toBe(false);
      expect(calculateMinDistanceToPolygonMeters([Number.NaN, 0], validSquare)).toBe(Number.POSITIVE_INFINITY);

      // Polygon with NaN vertices
      const nanRing: LinearRing = [
        [Number.NaN, 0],
        [1, Number.NaN],
        [0, 0],
      ];
      expect(calculateMinDistanceToPolygonMeters([0.5, 0.5], nanRing)).toBe(Number.POSITIVE_INFINITY);
    });

    it("correctly handles degenerate collinear polygons (zero area)", () => {
      // Polygon where all vertices lie on the same straight line: y = x
      const collinearRing: LinearRing = [
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        [2, 2],
        [0, 0],
      ];

      // No point can be contained within the interior of a zero-area polygon
      expect(isPointInPolygonInternal([1.5, 1.5], collinearRing)).toBe(false);
      expect(isPointInPolygonInternal([1.5, 2.0], collinearRing)).toBe(false);

      // Distance to the collinear segment is calculated correctly
      const dist = calculateMinDistanceToPolygonMeters([0, 1], collinearRing);
      expect(dist).toBeGreaterThan(0);
      expect(Number.isFinite(dist)).toBe(true);
    });

    it("rejects invalid zones and coordinates outside WGS84 bounds in BoundaryGuard", () => {
      // Zones with less than 3 vertices in BoundaryGuard constructor should throw TypeError
      expect(() => {
        new BoundaryGuard([
          {
            id: "bad-zone",
            name: "Bad",
            polygon: [[0, 0], [1, 1]],
          },
        ]);
      }).toThrow(TypeError);

      // Coordinates outside WGS84 bounds in evaluateBoundaryPosition should throw TypeError
      const validGuard = new BoundaryGuard([
        {
          id: "valid-zone",
          name: "Valid",
          polygon: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        },
      ]);

      expect(() => validGuard.evaluateBoundaryPosition([185, 0])).toThrow(TypeError);
      expect(() => validGuard.evaluateBoundaryPosition([0, -95])).toThrow(TypeError);
      expect(() => validGuard.evaluateBoundaryPosition([Number.NaN, 0])).toThrow(TypeError);
    });

    it("processes gigantic polygons (> 1,500 vertices) with high performance", () => {
      // Generate a complex polygon with 1,500 vertices (irregular perimeter of large farm)
      const numVertices = 1500;
      const centerLng = -48.0;
      const centerLat = -16.0;
      const baseRadius = 0.05;
      const bigPolygon: LinearRing = [];

      for (let i = 0; i < numVertices; i++) {
        const theta = (i * 2 * Math.PI) / numVertices;
        // Wavy radius with harmonics to create hundreds of curves
        const r = baseRadius * (1 + 0.1 * Math.sin(10 * theta) + 0.05 * Math.cos(25 * theta));
        const lng = centerLng + (r * Math.cos(theta)) / Math.cos((centerLat * Math.PI) / 180);
        const lat = centerLat + r * Math.sin(theta);
        bigPolygon.push([lng, lat]);
      }
      bigPolygon.push([...bigPolygon[0]!]);

      const guard = new BoundaryGuard(
        [
          {
            id: "mega-fazenda",
            name: "Mega Fazenda SIGEF",
            polygon: bigPolygon,
          },
        ],
        { warningThresholdMeters: 50 }
      );

      // Time measurement for 10 continuous GPS evaluations
      const start = performance.now();
      for (let k = 0; k < 10; k++) {
        const res = guard.evaluateBoundaryPosition([centerLng, centerLat]);
        expect(res.alerts[0]?.status).toBe("INSIDE");
      }
      const duration = performance.now() - start;
      const avgMs = duration / 10;

      // Average evaluation time per GNSS point MUST be less than 15ms
      expect(avgMs).toBeLessThan(15);
    });
  });
});
