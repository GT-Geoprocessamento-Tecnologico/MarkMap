// ## Geometry contract
// Defines the allowed geometry types and coordinate structures.
// We keep this minimal and let the feature contract handle
// the actual GeoJSON envelope.

import { z } from "zod";

export const GeometryTypeEnum = z.enum([
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
  "GeometryCollection",
]);

// We don't enforce the exact coordinate shape here because it varies
// by geometry type. The feature contract will validate the full
// GeoJSON structure. If you need stricter validation you can add
// a custom refine that checks coordinates.length against the type.
export const GeometryCoordinates = z.any();

/**
 * A minimal GeoJSON feature (without bbox or crs) that we use
 * for storing in PostGIS and transmitting over the API.
 * The CRS is assumed to be EPSG:4326 for the MVP.
 */
export const GeoJSONFeature = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: GeometryTypeEnum,
    coordinates: GeometryCoordinates,
  }),
  properties: z.record(z.any()),
});

export type GeometryType = z.infer<typeof GeometryTypeEnum>;
export type GeoJSONFeatureType = z.infer<typeof GeoJSONFeature>;
