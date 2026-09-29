import { z } from "zod";

// ## Project contract
// The contracts in this directory are the source of truth for the API
// and the UI.  They are written in Zod so that we can use
// the same runtime validation on both the server and client.
//
// In the future we may expose these as TypeScript types via
// `z.infer<typeof ProjectSchema>` which keeps the contract and the
// type system in sync.

import { z } from "zod";

// Identifier type used throughout the API.
export const IDSchema = z.string().uuid({ message: "must be a UUID" });

/**
 * A spatial feature that we store in PostGIS.  The geometry field
 * is stored as GeoJSON.  The contract explicitly requires the
 * GeoJSON to be in EPSG:4326 for ease of use on the browser.
 */
export const FeatureSchema = z.object({
  id: IDSchema,
  properties: z.record(z.any()),
  geometry: z.object({
    type: z.literal("Feature"),
    geometry: z.object({
      type: z.enum(["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection"]),
      coordinates: z.any(), // The exact shape depends on the type.
    }),
    // The CRS is optional for now; when we support other CRSs we can
    // add a `crs` field here.  For the MVP it’s always EPSG:4326.
    crs: z.undefined().optional(),
  }),
});

/**
 * A layer is a logical grouping of features.  In the API we expose
 * the geometry type and an optional default style.  For the initial
 * MVP, geometry is always `GeometryCollection`.
 */
export const LayerSchema = z.object({
  id: IDSchema,
  name: z.string({ message: "layer name cannot be empty" }).min(1),
  description: z.string().optional(),
  geometryType: z.enum(["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"], {
    errorMap: () => ({ message: "unsupported geometry type" }),
  }),
  defaultStyle: z.record(z.any()).optional(),
  projectId: IDSchema,
});

/**
 * A project is a container of layers/features.  Right now it only
 * stores a name and an optional description.  Future metadata can be
 * added (ownerId, timestamps, etc.) without breaking the contract.
 */
export const ProjectSchema = z.object({
  id: IDSchema,
  name: z.string().min(3, { message: "Project name must be at least 3 characters" }),
  description: z.string().max(500, { message: "Description too long" }).optional(),
  createdAt: z.preprocess((arg) => {
    if (typeof arg === "string") return new Date(arg);
    if (arg instanceof Date) return arg;
    return new Date();
  }, z.date().datetime()).optional(),
  updatedAt: z.preprocess((arg) => {
    if (typeof arg === "string") return new Date(arg);
    if (arg instanceof Date) return arg;
    return new Date();
  }, z.date().datetime()).optional(),
});

// Re-export helpers
export type Project = z.infer<typeof ProjectSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type Feature = z.infer<typeof FeatureSchema>;

// Custom error formatting – useful for API error responses
export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().uuid(),
});
export type Error = z.infer<typeof ErrorSchema>;
