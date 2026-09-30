/** @deprecated Compatibility entry point; use the canonical schemas in src/. */
export {
  geometryTypeSchema as GeometryTypeEnum,
  geometrySchema as GeoJSONGeometry,
  positionSchema as GeometryCoordinates,
  geometrySchema,
} from "./src/geometry.js";
export type { GeometryType, Geometry, Position } from "./src/geometry.js";
