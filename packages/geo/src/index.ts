export {
  EPSG_SIRGAS2000,
  EPSG_WGS84,
  CRS_TRANSPORT,
  SIRGAS2000_PROJ,
  SRID_CANONICAL,
  ensureCrsRegistered,
  isSupportedEpsg,
  sirgas2000ToWgs84,
  toCanonical,
  transformPosition,
  wgs84ToSirgas2000,
} from './crs.js';
export type { LngLat } from './crs.js';

export {
  bboxCenter,
  bboxContains,
  bboxIntersects,
  bboxToPolygon,
  computeBbox,
  parseBboxParam,
} from './bbox.js';
export type { BBox } from './bbox.js';

export {
  createFeature,
  createFeatureCollection,
  emptyFeatureCollection,
  geometryTypeOf,
  isFeature,
  isFeatureCollection,
  normalizeProperties,
} from './geojson.js';
export type {
  GeoJsonGeometry,
  GeoJsonGeometryType,
  GeoJsonLineString,
  GeoJsonMultiLineString,
  GeoJsonMultiPoint,
  GeoJsonMultiPolygon,
  GeoJsonPoint,
  GeoJsonPolygon,
  GeoJsonPosition,
  GeoNexoFeature,
  GeoNexoFeatureCollection,
  JsonObject,
  JsonValue,
} from './geojson.js';

export { centroidOf, measureAreaSquareMeters, measureLengthMeters } from './measure.js';

export { isValidLatitude, isValidLongitude, isValidPosition, validateGeometryLight } from './validate.js';
export type { ValidationResult } from './validate.js';

export * from './coordinates.js';
export * from './geodesy.js';
export * from './navigation.js';
export * from './location.js';
