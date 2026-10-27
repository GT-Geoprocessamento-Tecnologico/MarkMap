/**
 * Test polygon fixtures for geofencing stress tests
 * Extracted from boundary-guard-stress.test.ts for reuse across tests
 */

import { MEAN_EARTH_RADIUS_M } from "@markmap/geo";
import type { LinearRing, PolygonCoordinates } from "../../src/geofencing/boundary-guard";

// Constants for earth radius calculations
const mPerLat = (Math.PI / 180) * MEAN_EARTH_RADIUS_M;

/** Creates a concave horseshoe-shaped polygon (U-shape) */
export function createHorseshoePolygon(
  center: [number, number],
  size: number = 0.05
): LinearRing {
  const [centerLng, centerLat] = center;

  return [
    [centerLng - size, centerLat + size], // Top-left
    [centerLng + size, centerLat + size], // Top-right
    [centerLng + size, centerLat - size * 0.8], // Bottom-right
    [centerLng + size * 0.4, centerLat - size * 0.8], // Internal bottom-right corner
    [centerLng + size * 0.4, centerLat], // Internal right gap
    [centerLng - size * 0.4, centerLat], // Internal left gap
    [centerLng - size * 0.4, centerLat - size * 0.8], // Internal bottom-left corner
    [centerLng - size, centerLat - size * 0.8], // Bottom-left
    [centerLng - size, centerLat + size], // Closing
  ];
}

/** Creates a 5-point star polygon with self-intersections (concave star shape) */
export function createStarPolygon(
  center: [number, number],
  radius: number = 0.05
): LinearRing {
  const [centerLng, centerLat] = center;
  const starRing: [number, number][] = [];
  const innerRadius = radius * 0.4;

  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? radius : innerRadius;
    const lng = centerLng + (r * Math.cos(angle)) / Math.cos((centerLat * Math.PI) / 180);
    const lat = centerLat + r * Math.sin(angle);
    starRing.push([lng, lat]);
  }

  starRing.push([...starRing[0]!]); // Close the ring
  return starRing;
}

/** Creates a farm with multiple independent holes (lakes, enclaves, mineral rights areas) */
export function createMultiHoleFarm(
  center: [number, number],
  size: number = 0.1
): PolygonCoordinates {
  const [centerLng, centerLat] = center;
  const halfSize = size / 2;

  return [
    // Ring 0: Outer farm boundary
    [
      [centerLng - size, centerLat + size],
      [centerLng + size, centerLat + size],
      [centerLng + size, centerLat - size],
      [centerLng - size, centerLat - size],
      [centerLng - size, centerLat + size],
    ],
    // Hole 1: Northwest lake
    [
      [centerLng - size * 0.15, centerLat + size * 0.15],
      [centerLng - size * 0.25, centerLat + size * 0.15],
      [centerLng - size * 0.25, centerLat + size * 0.05],
      [centerLng - size * 0.15, centerLat + size * 0.05],
      [centerLng - size * 0.15, centerLat + size * 0.15],
    ],
    // Hole 2: Northeast lake
    [
      [centerLng + size * 0.25, centerLat + size * 0.15],
      [centerLng + size * 0.35, centerLat + size * 0.15],
      [centerLng + size * 0.35, centerLat + size * 0.05],
      [centerLng + size * 0.25, centerLat + size * 0.05],
      [centerLng + size * 0.25, centerLat + size * 0.15],
    ],
    // Hole 3: Southern mineral rights/access area
    [
      [centerLng - size * 0.08, centerLat - size * 0.3],
      [centerLng + size * 0.12, centerLat - size * 0.3],
      [centerLng + size * 0.12, centerLat - size * 0.5],
      [centerLng - size * 0.08, centerLat - size * 0.5],
      [centerLng - size * 0.08, centerLat - size * 0.3],
    ],
  ];
}

/** Creates a square fence segment for distance validation tests */
export function createFenceSegment(
  center: [number, number],
  length: number = 100
): LinearRing {
  const [centerLng, centerLat] = center;
  const mPerLon = mPerLat * Math.cos((centerLat * Math.PI) / 180);
  const deltaLng = length / mPerLon;
  const deltaLat = length / mPerLat;

  return [
    [centerLng - deltaLng, centerLat - deltaLat],
    [centerLng + deltaLng, centerLat - deltaLat],
    [centerLng + deltaLng, centerLat + deltaLat],
    [centerLng - deltaLng, centerLat + deltaLat],
    [centerLng - deltaLng, centerLat - deltaLat],
  ];
}

/** Creates a simple boundary zone for deterministic transition tests */
export function createBoundaryZone(
  id: string,
  center: [number, number],
  size: number = 0.05
) {
  const [centerLng, centerLat] = center;

  return {
    id,
    name: `Test Zone ${id}`,
    polygon: [
      [centerLng - size, centerLat - size],
      [centerLng + size, centerLat - size],
      [centerLng + size, centerLat + size],
      [centerLng - size, centerLat + size],
      [centerLng - size, centerLat - size],
    ],
  };
}

/** Creates a farm with a central hole (e.g., lake in middle) */
export function createFarmWithCentralHole(
  center: [number, number],
  outerSize: number = 0.1,
  holeSize: number = 0.02
): PolygonCoordinates {
  const [centerLng, centerLat] = center;

  return [
    // Outer farm boundary
    [
      [centerLng - outerSize, centerLat - outerSize],
      [centerLng + outerSize, centerLat - outerSize],
      [centerLng + outerSize, centerLat + outerSize],
      [centerLng - outerSize, centerLat + outerSize],
      [centerLng - outerSize, centerLat - outerSize],
    ],
    // Central hole (lake)
    [
      [centerLng - holeSize, centerLat - holeSize],
      [centerLng + holeSize, centerLat - holeSize],
      [centerLng + holeSize, centerLat + holeSize],
      [centerLng - holeSize, centerLat + holeSize],
      [centerLng - holeSize, centerLat - holeSize],
    ],
  ];
}