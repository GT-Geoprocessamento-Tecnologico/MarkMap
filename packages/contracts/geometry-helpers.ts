/** @deprecated Compatibility entry point; use the canonical geometry schemas. */
export {
  geometrySchema as GeometrySchema,
  pointGeometrySchema,
  lineStringGeometrySchema,
  polygonGeometrySchema,
} from "./src/geometry.js";
export type { Geometry, Point, LineString, Polygon } from "./src/geometry.js";
