// ## Layer contract
// A layer groups features and provides a small amount of metadata.
// The UI will use the `defaultStyle` to render features when a
// custom style is not provided.

import { z } from "zod";
import { IDSchema } from "./project";

export const LayerSchema = z.object({
  id: IDSchema,
  name: z.string().min(1, { message: "layer name cannot be empty" }),
  description: z.string().optional(),
  geometryType: z.enum([
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
  ]),
  defaultStyle: z.record(z.any()).optional(),
  projectId: IDSchema,
});

export type Layer = z.infer<typeof LayerSchema>;
