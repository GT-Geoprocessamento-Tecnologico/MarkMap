/**
 * Minimal GeoJSON types owned by @geonexo/geo.
 *
 * Kept local (instead of @types/geojson) so this package has zero extra
 * type dependencies. Shapes follow RFC 7946. `properties` is always an
 * object, never a JSON string, per 50-CONTRATOS-DE-INTEGRACAO section 6.
 */

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type GeoJsonPosition = [number, number] | [number, number, number];

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: GeoJsonPosition;
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: GeoJsonPosition[];
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: GeoJsonPosition[][];
}

export interface GeoJsonMultiPoint {
  type: 'MultiPoint';
  coordinates: GeoJsonPosition[];
}

export interface GeoJsonMultiLineString {
  type: 'MultiLineString';
  coordinates: GeoJsonPosition[][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: GeoJsonPosition[][][];
}

export type GeoJsonGeometry =
  | GeoJsonPoint
  | GeoJsonLineString
  | GeoJsonPolygon
  | GeoJsonMultiPoint
  | GeoJsonMultiLineString
  | GeoJsonMultiPolygon;

export type GeoJsonGeometryType = GeoJsonGeometry['type'];

export interface GeoNexoFeature {
  type: 'Feature';
  id?: string | undefined;
  geometry: GeoJsonGeometry | null;
  properties: JsonObject;
  bbox?: [number, number, number, number] | undefined;
}

export interface GeoNexoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoNexoFeature[];
  bbox?: [number, number, number, number] | undefined;
}

/** Coerce unknown input into a properties object; primitives become {}. */
export function normalizeProperties(input: unknown): JsonObject {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {};
  }
  const out: JsonObject = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (isJsonValue(value)) {
      out[key] = value;
    }
  }
  return out;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((item) => isJsonValue(item));
  }
  return false;
}

/** Build a Feature with normalized properties. */
export function createFeature(
  geometry: GeoJsonGeometry,
  properties?: unknown,
  id?: string,
): GeoNexoFeature {
  const feature: GeoNexoFeature = {
    type: 'Feature',
    geometry,
    properties: normalizeProperties(properties),
  };
  if (id !== undefined) {
    feature.id = id;
  }
  return feature;
}

/** Wrap features in a FeatureCollection. */
export function createFeatureCollection(
  features: GeoNexoFeature[],
): GeoNexoFeatureCollection {
  return { type: 'FeatureCollection', features: [...features] };
}

/** Empty collection constant factory (avoids shared mutable state). */
export function emptyFeatureCollection(): GeoNexoFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

export function isFeature(input: unknown): input is GeoNexoFeature {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  return record['type'] === 'Feature' && typeof record['geometry'] === 'object';
}

export function isFeatureCollection(input: unknown): input is GeoNexoFeatureCollection {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  return record['type'] === 'FeatureCollection' && Array.isArray(record['features']);
}

/** Geometry type discriminator, or null for unknown shapes. */
export function geometryTypeOf(input: unknown): GeoJsonGeometryType | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const type = (input as Record<string, unknown>)['type'];
  switch (type) {
    case 'Point':
    case 'LineString':
    case 'Polygon':
    case 'MultiPoint':
    case 'MultiLineString':
    case 'MultiPolygon':
      return type;
    default:
      return null;
  }
}
