import { z } from 'zod';

import { STORAGE_SRID, geometryTypeSchema } from './geometry.js';
import type { GeometryType } from './geometry.js';
import { timestampSchema, uuidSchema } from './project.js';

/**
 * Re-exported so `import { geometryTypeSchema } from '@geonexo/contracts/layer'`
 * (used by feature.ts) keeps working. geometry.ts is the single source of truth.
 */
export { geometryTypeSchema };

/**
 * layers.kind is the logical layer kind
 * (10-BACKEND-VISIONARIO-PRD.md:144). It answers "what is this layer", not
 * "which GeoJSON type does it store" - that is layers.geometry_type.
 */
export const layerKindSchema = z.enum(['point', 'line', 'polygon', 'mixed', 'raster', 'remote']);

/**
 * The subset of kinds that can hold features. A raster or remote layer is
 * served by a provider and has no rows in the features table, so it can never
 * declare a geometry_type.
 */
export const featureBearingLayerKindSchema = z.enum(['point', 'line', 'polygon', 'mixed']);

type LayerKindAndGeometryType = {
  readonly kind: string;
  readonly geometryType: GeometryType | null;
};

const canCarryFeatures = (kind: string): boolean => featureBearingLayerKindSchema.safeParse(kind).success;

/**
 * layers.geometry_type is nullable and only meaningful for feature-bearing
 * kinds (10-BACKEND-VISIONARIO-PRD.md:144-145).
 */
const isGeometryTypeAllowed = (layer: LayerKindAndGeometryType): boolean =>
  layer.geometryType === null || canCarryFeatures(layer.kind);

const geometryTypeNotAllowedMessage =
  'geometryType is only allowed when kind is one of point, line, polygon or mixed';

const layerNameSchema = z.string().min(1, 'Name is required').max(160, 'Name must be at most 160 characters');

/** layers.srid integer NOT NULL DEFAULT 4674 (SIRGAS 2000). */
const layerSridSchema = z.number().int().positive().default(STORAGE_SRID);

/** jsonb NOT NULL DEFAULT '{}' columns. */
const jsonbObjectSchema = z.record(z.unknown()).default({});

export const layerSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    name: layerNameSchema,
    description: z.string().nullable(),
    kind: layerKindSchema,
    geometryType: geometryTypeSchema.nullable(),
    srid: layerSridSchema,
    style: jsonbObjectSchema,
    metadata: jsonbObjectSchema,
    visibleByDefault: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine(isGeometryTypeAllowed, geometryTypeNotAllowedMessage);

export const createLayerSchema = z
  .object({
    projectId: uuidSchema,
    name: layerNameSchema,
    description: z.string().nullable().optional(),
    kind: layerKindSchema,
    geometryType: geometryTypeSchema.nullable().default(null),
    srid: layerSridSchema,
    style: jsonbObjectSchema,
    metadata: jsonbObjectSchema,
    visibleByDefault: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .refine(isGeometryTypeAllowed, geometryTypeNotAllowedMessage);

export const updateLayerSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
});

export type Layer = z.infer<typeof layerSchema>;
export type LayerKind = z.infer<typeof layerKindSchema>;
export type FeatureBearingLayerKind = z.infer<typeof featureBearingLayerKindSchema>;
export type CreateLayer = z.infer<typeof createLayerSchema>;
export type UpdateLayer = z.infer<typeof updateLayerSchema>;
