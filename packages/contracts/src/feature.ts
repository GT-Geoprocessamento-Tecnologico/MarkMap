import { z } from "zod";

import { geometrySchema, isGeometryCompatibleWith } from "./geometry.js";
import type { Geometry, GeometryType } from "./geometry.js";
import { geometryTypeSchema } from "./layer.js";
import { timestampSchema, uuidSchema } from "./project.js";

/** GeoJSON properties travel as a real JSON object, never as a JSON string. */
const MAX_PROPERTY_KEYS = 50;
const MAX_PROPERTY_DEPTH = 3;
const MAX_PROPERTY_VALUE_BYTES = 2048;

export const featurePropertiesSchema = z
  .record(z.unknown())
  .superRefine((value, ctx) => {
    let keyCount = 0;
    const addInvalid = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const visit = (
      entry: unknown,
      depth: number,
      path: (string | number)[],
    ) => {
      if (depth > MAX_PROPERTY_DEPTH) {
        addInvalid(path, "Properties must not exceed depth 3");
        return;
      }
      if (
        entry === undefined ||
        typeof entry === "function" ||
        typeof entry === "symbol" ||
        typeof entry === "bigint"
      ) {
        addInvalid(path, "Properties must contain JSON-compatible values");
        return;
      }
      if (typeof entry === "number" && !Number.isFinite(entry)) {
        addInvalid(path, "Properties must contain finite numbers");
        return;
      }
      let serialized: string;
      try {
        serialized = JSON.stringify(entry);
      } catch {
        addInvalid(path, "Properties must contain JSON-compatible values");
        return;
      }
      if (
        new TextEncoder().encode(serialized).length > MAX_PROPERTY_VALUE_BYTES
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: MAX_PROPERTY_VALUE_BYTES,
          type: "string",
          inclusive: true,
          path,
          message: "Property values must be at most 2 KB",
        });
      }
      if (Array.isArray(entry)) {
        entry.forEach((child, index) =>
          visit(child, depth + 1, [...path, index]),
        );
        return;
      }
      if (entry !== null && typeof entry === "object") {
        const prototype = Object.getPrototypeOf(entry);
        if (prototype !== Object.prototype && prototype !== null) {
          addInvalid(path, "Properties must contain plain JSON objects");
          return;
        }
        for (const [key, child] of Object.entries(entry)) {
          keyCount += 1;
          visit(child, depth + 1, [...path, key]);
        }
      }
    };
    for (const [key, child] of Object.entries(value)) {
      keyCount += 1;
      visit(child, 1, [key]);
    }
    if (keyCount > MAX_PROPERTY_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: MAX_PROPERTY_KEYS,
        type: "array",
        inclusive: true,
        path: [],
        message: "Properties must contain at most 50 keys",
      });
    }
  });

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
      return (
        minLng >= -180 &&
        maxLng <= 180 &&
        minLat >= -90 &&
        maxLat <= 90 &&
        minLng <= maxLng &&
        minLat <= maxLat
      );
    },
    {
      message:
        "bbox values must be within longitude/latitude bounds and minimums must not exceed maximums",
    },
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
