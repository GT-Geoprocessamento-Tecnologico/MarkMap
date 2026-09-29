import { area as turfArea, centroid as turfCentroid, length as turfLength } from '@turf/turf';
import type { GeoNexoFeature } from './geojson.js';

/**
 * Measurement helpers. Turf.js is the single engine for area / distance;
 * nothing here reimplements geospatial math.
 *
 * Units: meters for length, square meters for area (Turf defaults).
 */

function toTurfInput(feature: GeoNexoFeature): GeoJSON.Feature | null {
  if (feature.geometry === null) {
    return null;
  }
  return {
    type: 'Feature',
    geometry: feature.geometry as unknown as GeoJSON.Geometry,
    properties: { ...(feature.properties as Record<string, unknown>) },
  };
}

/** Geodesic area in square meters. Returns 0 for non-polygonal input. */
export function measureAreaSquareMeters(feature: GeoNexoFeature): number {
  const input = toTurfInput(feature);
  if (input === null) {
    return 0;
  }
  const geometryType = input.geometry.type;
  if (geometryType !== 'Polygon' && geometryType !== 'MultiPolygon') {
    return 0;
  }
  try {
    const value = turfArea(input as Parameters<typeof turfArea>[0]);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** Geodesic length in meters. Returns 0 for non-linear input. */
export function measureLengthMeters(feature: GeoNexoFeature): number {
  const input = toTurfInput(feature);
  if (input === null) {
    return 0;
  }
  const geometryType = input.geometry.type;
  if (geometryType !== 'LineString' && geometryType !== 'MultiLineString') {
    return 0;
  }
  try {
    const kilometers = turfLength(input as Parameters<typeof turfLength>[0], {
      units: 'kilometers',
    });
    const meters = kilometers * 1000;
    return Number.isFinite(meters) ? meters : 0;
  } catch {
    return 0;
  }
}

/** Visual centroid as [lng, lat], or null when it cannot be computed. */
export function centroidOf(feature: GeoNexoFeature): [number, number] | null {
  const input = toTurfInput(feature);
  if (input === null) {
    return null;
  }
  try {
    const center = turfCentroid(input as Parameters<typeof turfCentroid>[0]);
    const coords = center.geometry.coordinates as unknown;
    if (!Array.isArray(coords)) {
      return null;
    }
    const lng = coords[0];
    const lat = coords[1];
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return null;
    }
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return null;
    }
    return [lng, lat];
  } catch {
    return null;
  }
}
