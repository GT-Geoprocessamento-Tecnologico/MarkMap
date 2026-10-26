import { kinks } from '@turf/turf';

/**
 * Client-side coordinate and topology validation.
 *
 * Provides range checks, finiteness, ring closure, and basic topological
 * validity (self-intersection detection for polygons) to provide immediate
 * feedback before sending authoritative requests to PostGIS.
 */

export type ValidationResult = { ok: true } | { ok: false; reason: string };

function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Longitude range per RFC 7946: [-180, 180]. */
export function isValidLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

/** Latitude range per RFC 7946: [-90, 90]. */
export function isValidLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

/** True for a finite [lng, lat] or [lng, lat, alt?] tuple in range. */
export function isValidPosition(value: unknown): value is number[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (value.length !== 2 && value.length !== 3) {
    return false;
  }
  const lng = value[0];
  const lat = value[1];
  if (!isValidLongitude(lng) || !isValidLatitude(lat)) {
    return false;
  }
  const alt = value[2];
  return alt === undefined || isFiniteNumber(alt);
}

function isClosedRing(ring: unknown): boolean {
  if (!Array.isArray(ring) || ring.length < 4) {
    return false;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!Array.isArray(first) || !Array.isArray(last)) {
    return false;
  }
  return first[0] === last[0] && first[1] === last[1];
}

function allPositions(values: unknown): boolean {
  if (!Array.isArray(values)) {
    return false;
  }
  return values.every((item) => isValidPosition(item));
}

/**
 * Validate a GeoJSON-like geometry object without depending on Zod.
 * Accepts Point, LineString, Polygon, MultiPoint, MultiLineString,
 * MultiPolygon. Rejects empty geometries, out-of-range coordinates,
 * unclosed rings and under-populated coordinate arrays.
 */
export function validateGeometryLight(geometry: unknown): ValidationResult {
  if (typeof geometry !== 'object' || geometry === null) {
    return fail('geometry must be an object');
  }
  const record = geometry as Record<string, unknown>;
  const type = record['type'];
  const coordinates = record['coordinates'];

  switch (type) {
    case 'Point': {
      if (!isValidPosition(coordinates)) {
        return fail('Point coordinates must be a [lng, lat] tuple in range');
      }
      return { ok: true };
    }
    case 'LineString': {
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return fail('LineString needs at least 2 positions');
      }
      if (!allPositions(coordinates)) {
        return fail('LineString has an invalid position');
      }
      return { ok: true };
    }
    case 'Polygon': {
      if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return fail('Polygon needs at least one ring');
      }
      for (const ring of coordinates) {
        if (!Array.isArray(ring) || !allPositions(ring)) {
          return fail('Polygon ring has an invalid position');
        }
        if (!isClosedRing(ring)) {
          return fail('Polygon ring must be closed with at least 4 positions');
        }
      }
      try {
        const intersection = kinks({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: coordinates as unknown as GeoJSON.Position[][],
          },
          properties: {},
        });
        if (intersection.features.length > 0) {
          return fail('Polygon edges must not cross or overlap (self-intersection)');
        }
      } catch {
        return fail('Failed to validate polygon topology');
      }
      return { ok: true };
    }
    case 'MultiPoint': {
      if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return fail('MultiPoint needs at least one position');
      }
      if (!allPositions(coordinates)) {
        return fail('MultiPoint has an invalid position');
      }
      return { ok: true };
    }
    case 'MultiLineString': {
      if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return fail('MultiLineString needs at least one line');
      }
      for (const line of coordinates) {
        if (!Array.isArray(line) || line.length < 2 || !allPositions(line)) {
          return fail('MultiLineString has an invalid line');
        }
      }
      return { ok: true };
    }
    case 'MultiPolygon': {
      if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return fail('MultiPolygon needs at least one polygon');
      }
      for (const polygon of coordinates) {
        if (!Array.isArray(polygon) || polygon.length === 0) {
          return fail('MultiPolygon has an empty polygon');
        }
        for (const ring of polygon) {
          if (!Array.isArray(ring) || !allPositions(ring)) {
            return fail('MultiPolygon ring has an invalid position');
          }
          if (!isClosedRing(ring)) {
            return fail('MultiPolygon ring must be closed with at least 4 positions');
          }
        }
      }
      try {
        const intersection = kinks({
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: coordinates as unknown as GeoJSON.Position[][][],
          },
          properties: {},
        });
        if (intersection.features.length > 0) {
          return fail('MultiPolygon edges must not cross or overlap (self-intersection)');
        }
      } catch {
        return fail('Failed to validate multi-polygon topology');
      }
      return { ok: true };
    }
    default: {
      return fail('unsupported geometry type');
    }
  }
}

