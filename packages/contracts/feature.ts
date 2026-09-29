// ## Feature contract
// Defines a single geospatial feature.
// Geometries are expected to be in EPSG:4326 for API transmission.

import { z } from "zod";
import { IDSchema } from "./project";

export const FeatureSchema = z.object({
  id: IDSchema,
  layerId: IDSchema,
  properties: z.record(z.any()),
  geometry: z.object({
    type: z.literal("Feature"),
    geometry: z.object({
      type: z.enum([
        "Point",
        "LineString",
        "Polygon",
        "MultiPoint",
        "MultiLineString",
        "MultiPolygon",
        "GeometryCollection"
      ]),
      coordinates: z.any(),
    }),
  }),
});

export type Feature = z.infer<typeof FeatureSchema>;
