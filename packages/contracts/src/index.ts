export {
  STORAGE_SRID,
  wireSridSchema,
  positionSchema,
  pointGeometrySchema,
  lineStringGeometrySchema,
  linearRingSchema,
  polygonGeometrySchema,
  multiPointGeometrySchema,
  multiLineStringGeometrySchema,
  multiPolygonGeometrySchema,
  geometrySchema,
  geometryTypeSchema,
  simpleGeometryTypeSchema,
  geometryKindSchema,
  geometryKindOf,
  isGeometryCompatibleWith,
} from './geometry.js';
export type {
  GeometryType,
  Position,
  Geometry,
  Point,
  LineString,
  LinearRing,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryKind,
} from './geometry.js';

export {
  uuidSchema,
  timestampSchema,
  projectSchema,
  createProjectSchema,
  updateProjectSchema,
} from './project.js';
export type { Project, CreateProject, UpdateProject } from './project.js';

export { layerSchema, createLayerSchema, updateLayerSchema } from './layer.js';
export type { Layer, CreateLayer, UpdateLayer } from './layer.js';

export {
  bboxSchema,
  listFeaturesQuerySchema,
  featurePropertiesSchema,
  featureSchema,
  createFeatureSchema,
  updateFeatureSchema,
  GeometryTypeMismatchError,
  assertGeometryCompatible,
} from './feature.js';
export type { Bbox, ListFeaturesQuery, Feature, CreateFeature, UpdateFeature } from './feature.js';

export { importStatusSchema, importSchema, createImportSchema } from './import.js';
export type { Import, CreateImport, ImportStatus } from './import.js';

export {
  errorCodeSchema,
  httpStatusByErrorCode,
  validationIssueSchema,
  errorSchema,
  errorResponseSchema,
  ErrorCodes,
  buildErrorResponse,
} from './errors.js';
export type { ErrorCode, Error, ErrorResponse, ValidationIssue } from './errors.js';

export {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  paginationCursorSchema,
  paginationQuerySchema,
  paginationSchema,
  buildPage,
} from './pagination.js';
export type { PaginationQuery, Pagination } from './pagination.js';
