export {
  EPSG_SIRGAS2000,
  EPSG_WGS84,
  CRS_TRANSPORT,
  REPROJECTABLE_PROJ,
  SIRGAS2000_PROJ,
  SRID_CANONICAL,
  ensureCrsRegistered,
  isReprojectableEpsg,
  isSupportedEpsg,
  parseGeoJsonCrsEpsg,
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
  MarkMapFeature,
  MarkMapFeatureCollection,
  JsonObject,
  JsonValue,
} from './geojson.js';

export {
  centroidOf,
  measureAreaSquareMeters,
  measureLengthMeters,
  measurePointsAreaSquareMeters,
} from './measure.js';

export {
  convertArea,
  convertDistance,
  convertAngle,
  formatArea,
  AREA_UNITS,
  METERS_PER_UNIT,
} from './units/survey.js';
export type {
  AreaUnit,
  RuralAreaUnit,
  DistanceUnit,
  AngleUnit,
  AreaUnitDefinition,
} from './units/survey.js';

export { isValidLatitude, isValidLongitude, isValidPosition, validateGeometryLight } from './validate.js';
export type { ValidationResult } from './validate.js';

export * from './coordinates.js';
export * from './geodesy.js';
export * from './navigation.js';
export * from './location.js';

export { parseGpx } from './gpx.js';
export { parseKml } from './kml.js';
export { extractKmzKml, MAX_KMZ_BYTES } from './kmz.js';
export { tracksToGeoJSON } from './tracks-geojson.js';
export type { TrackGeoJsonCollection, TrackGeoJsonFeature } from './tracks-geojson.js';
