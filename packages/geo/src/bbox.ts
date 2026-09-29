import type { GeoJsonPolygon } from './geojson.js';

/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

function isFinitePair(value: unknown): value is [number, number] {
  if (!Array.isArray(value)) {
    return false;
  }
  const lng = value[0];
  const lat = value[1];
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat)
  );
}

function collectPositions(coordinates: unknown, out: Array<[number, number]>): void {
  if (isFinitePair(coordinates)) {
    out.push([coordinates[0], coordinates[1]]);
    return;
  }
  if (Array.isArray(coordinates)) {
    for (const item of coordinates) {
      collectPositions(item, out);
    }
  }
}

/**
 * Compute the bbox of a GeoJSON geometry, feature or feature collection.
 * Returns null when no finite position is found. Implemented manually so
 * bbox never depends on a heavy dependency.
 */
export function computeBbox(input: unknown): BBox | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const record = input as Record<string, unknown>;
  const type = record['type'];
  let coordinates: unknown = null;

  if (type === 'Feature') {
    const geometry = record['geometry'];
    if (typeof geometry !== 'object' || geometry === null) {
      return null;
    }
    coordinates = (geometry as Record<string, unknown>)['coordinates'];
  } else if (type === 'FeatureCollection') {
    const features = record['features'];
    if (!Array.isArray(features)) {
      return null;
    }
    const points: Array<[number, number]> = [];
    for (const feature of features) {
      const nested = computeBbox(feature);
      if (nested !== null) {
        points.push([nested[0], nested[1]]);
        points.push([nested[2], nested[3]]);
      }
    }
    return bboxOfPoints(points);
  } else {
    coordinates = record['coordinates'];
  }

  const points: Array<[number, number]> = [];
  collectPositions(coordinates, points);
  return bboxOfPoints(points);
}

function bboxOfPoints(points: Array<[number, number]>): BBox | null {
  if (points.length === 0) {
    return null;
  }
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const [lng, lat] of points) {
    if (lng < minLng) {
      minLng = lng;
    }
    if (lat < minLat) {
      minLat = lat;
    }
    if (lng > maxLng) {
      maxLng = lng;
    }
    if (lat > maxLat) {
      maxLat = lat;
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Parse a `?bbox=minLng,minLat,maxLng,maxLat` query value (backend contract
 * for GET /layers/:id/features). Returns null when malformed or out of
 * range, so callers answer 400 instead of querying PostGIS with garbage.
 */
export function parseBboxParam(raw: unknown): BBox | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4) {
    return null;
  }
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (
    typeof minLng !== 'number' ||
    typeof minLat !== 'number' ||
    typeof maxLng !== 'number' ||
    typeof maxLat !== 'number'
  ) {
    return null;
  }
  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
    return null;
  }
  if (minLng > maxLng || minLat > maxLat) {
    return null;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** True when two bboxes overlap (edges touching counts as overlap). */
export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

/** True when [lng, lat] lies inside the bbox (inclusive). */
export function bboxContains(bbox: BBox, lng: number, lat: number): boolean {
  return lng >= bbox[0] && lng <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

/** Center of the bbox as [lng, lat]. */
export function bboxCenter(bbox: BBox): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

/** Render a bbox as a closed GeoJSON polygon ring. */
export function bboxToPolygon(bbox: BBox): GeoJsonPolygon {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}
