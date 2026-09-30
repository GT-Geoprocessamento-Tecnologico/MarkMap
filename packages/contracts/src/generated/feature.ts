import { z } from "zod";

import { geometrySchema, isGeometryCompatibleWith } from "./geometry.js";
import type { Geometry, GeometryType } from "./geometry.js";
import { geometryTypeSchema } from "./layer.js";
import { timestampSchema, uuidSchema } from "./project.js";

/** GeoJSON properties travel as a real JSON object, never as a JSON string. */
export const featurePropertiesSchema = z.record(z.unknown());

/**
 * GET /layers/:id/features?bbox=minLng,minLat,maxLng,maxLat
 * Parsed and validated here so the route never concatenates user input into SQL.
 */
/** Strict decimal pattern: rejects '', '0x10', '1e2' and other Number() surprises. */
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

export const bboxSchema = z
  .string()
  .refine(
    (raw) => {
      const parts = raw.split(",");
      return (
        parts.length === 4 &&
        parts.every((part) => DECIMAL_PATTERN.test(part.trim()))
      );
    },
    {
      message:
        "bbox must contain exactly 4 decimal values: minLng,minLat,maxLng,maxLat",
    },
  )
  .transform((raw) => raw.split(",").map((part) => Number(part.trim())))
  .refine(
    (values) => {
      const [minLng, minLat, maxLng, maxLat] = values as [
        number,
        number,
        number,
        number,
      ];
      return minLng <= maxLng && minLat <= maxLat;
    },
    { message: "bbox minimums must not be greater than maximums" },
  )
  .transform((values) => {
    const [minLng, minLat, maxLng, maxLat] = values as [
      number,
      number,
      number,
      number,
    ];
    return { minLng, minLat, maxLng, maxLat } as const;
  });

export type Bbox = z.infer<typeof bboxSchema>;

/**
 * `z.coerce.boolean()` is `Boolean(value)`, so the string "false" parses as
 * true and every caller asking for no soft-deleted rows would get them. Only
 * the literal strings "true"/"false" are accepted.
 */
export const booleanQueryFlagSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const listFeaturesQuerySchema = z.object({
  bbox: bboxSchema.optional(),
  includeDeleted: booleanQueryFlagSchema.optional(),
});

export type ListFeaturesQuery = z.infer<typeof listFeaturesQuerySchema>;

export const featureSchema = z.object({
  id: uuidSchema,
  layerId: uuidSchema,
  geometry: geometrySchema,
  properties: featurePropertiesSchema,
  version: z.number().int().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createFeatureSchema = z.object({
  layerId: uuidSchema,
  geometry: geometrySchema,
  properties: featurePropertiesSchema.default({}),
});

/**
 * `version` is mandatory: it is the expected current version, and the route
 * answers 409 VERSION_CONFLICT when the stored row moved on.
 */
export const updateFeatureSchema = z
  .object({
    id: uuidSchema,
    version: z.number().int().min(1, "version must be a positive integer"),
    geometry: geometrySchema.optional(),
    properties: featurePropertiesSchema.optional(),
  })
  .refine(
    (body) => body.geometry !== undefined || body.properties !== undefined,
    "At least one of geometry or properties must be provided",
  );

export type Feature = z.infer<typeof featureSchema>;
export type CreateFeature = z.infer<typeof createFeatureSchema>;
export type UpdateFeature = z.infer<typeof updateFeatureSchema>;

/** Thrown by the application layer when a layer rejects the geometry. */
export class GeometryTypeMismatchError extends Error {
  readonly code = "GEOMETRY_TYPE_MISMATCH" as const;

  constructor(
    readonly allowedType: GeometryType | null,
    readonly receivedType: Geometry["type"],
  ) {
    super(
      allowedType === null
        ? "Geometry type not accepted by this layer"
        : `Layer only accepts ${allowedType} geometries, received ${receivedType}`,
    );
    this.name = "GeometryTypeMismatchError";
  }
}

export const assertGeometryCompatible = (
  geometry: Geometry,
  allowedType: GeometryType | null,
): void => {
  if (!isGeometryCompatibleWith(geometry, allowedType)) {
    throw new GeometryTypeMismatchError(allowedType, geometry.type);
  }
};

export { geometryTypeSchema };
