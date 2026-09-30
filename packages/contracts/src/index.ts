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
} from "./geometry.js";
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
} from "./geometry.js";

export {
  uuidSchema,
  timestampSchema,
  projectSchema,
  createProjectSchema,
  updateProjectSchema,
} from "./project.js";
export type { Project, CreateProject, UpdateProject } from "./project.js";

export { mapSchema } from "./map.js";
export type { Map } from "./map.js";

export { layerSchema, createLayerSchema, updateLayerSchema } from "./layer.js";
export type { Layer, CreateLayer, UpdateLayer } from "./layer.js";

export {
  bboxSchema,
  listFeaturesQuerySchema,
  featurePropertiesSchema,
  featureSchema,
  createFeatureSchema,
  updateFeatureSchema,
  GeometryTypeMismatchError,
  assertGeometryCompatible,
} from "./feature.js";
export type {
  Bbox,
  ListFeaturesQuery,
  Feature,
  CreateFeature,
  UpdateFeature,
} from "./feature.js";

export {
  importStatusSchema,
  importSchema,
  createImportSchema,
} from "./import.js";
export type { Import, CreateImport, ImportStatus } from "./import.js";

export {
  errorCodeSchema,
  httpStatusByErrorCode,
  validationIssueSchema,
  errorSchema,
  errorResponseSchema,
  ErrorCodes,
  buildErrorResponse,
} from "./errors.js";
export type {
  ErrorCode,
  Error,
  ErrorResponse,
  ValidationIssue,
} from "./errors.js";

export {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  paginationCursorSchema,
  paginationQuerySchema,
  paginationSchema,
  buildPage,
} from "./pagination.js";
export type { PaginationQuery, Pagination } from "./pagination.js";

export {
  workspaceCapabilitySchema,
  bootstrapProofSchema,
  capabilityProvisionRequestSchema,
  capabilityRecoveryRequestSchema,
  capabilityProvisionResponseSchema,
} from "./workspace.js";
export type {
  WorkspaceCapability,
  BootstrapProof,
  CapabilityProvisionRequest,
  CapabilityRecoveryRequest,
  CapabilityProvisionResponse,
} from "./workspace.js";

export {
  blobRefSchema,
  controlPointSchema,
  geoReferenceSchema,
  pdfImportStateSchema,
  importMetadataSchema,
} from "./pdf.js";
export type {
  PagePoint,
  BlobRef,
  ControlPoint,
  GeoReference,
  PdfImportState,
  ImportMetadata,
} from "./pdf.js";

export {
  mapBoundsSchema,
  offlineMapArchiveRefSchema,
  offlineMapPackageManifestSchema,
} from "./offline-map.js";
export type {
  MapBounds,
  OfflineMapArchiveRef,
  OfflineMapPackageManifest,
} from "./offline-map.js";

export {
  syncEntitySchema,
  projectSyncDataSchema,
  mapSyncDataSchema,
  layerSyncDataSchema,
  featureSyncDataSchema,
  syncEntityPayloadSchema,
  syncUpsertOperationSchema,
  syncDeleteOperationSchema,
  syncOperationSchema,
  syncCursorSchema,
  tombstoneSchema,
  syncConflictSchema,
  pushSyncAckSchema,
  pushSyncRequestSchema,
  pushSyncResponseSchema,
  serverChangeSchema,
  pullSyncResponseSchema,
} from "./sync.js";
export type {
  SyncEntity,
  ProjectSyncData,
  MapSyncData,
  LayerSyncData,
  FeatureSyncData,
  SyncEntityPayload,
  SyncOperation,
  SyncCursor,
  Tombstone,
  SyncConflict,
  PushSyncAck,
  PushSyncRequest,
  PushSyncResponse,
  ServerChange,
  PullSyncResponse,
} from "./sync.js";
