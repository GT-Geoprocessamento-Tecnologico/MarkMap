import {
  assertGeometryCompatible,
  buildPage,
  geometryTypeSchema,
  type Bbox,
  type Geometry,
  type Pagination,
} from "@markmap/contracts";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { LayerNotFoundError, VersionConflictError } from "../errors.js";
import { decodeCursor, encodeCursor, resolveLimit } from "../pagination.js";
import {
  assertStorableGeometry,
  bboxOverlaps,
  geoJsonFromGeometry,
  geomFromGeoJSON,
} from "./spatial.js";
import { features } from "../schema/features.js";
import { layers } from "../schema/layers.js";

/** DB record: every column, with geometry parsed back into GeoJSON. */
export type FeatureRecord = Omit<
  typeof features.$inferSelect,
  "geometry" | "workspaceId"
> & {
  geometry: Geometry;
};

type FeatureRow = Omit<FeatureRecord, "geometry"> & { geometry: string };

const featureSelection = {
  id: features.id,
  layerId: features.layerId,
  geometry: geoJsonFromGeometry(features.geometry),
  properties: features.properties,
  version: features.version,
  createdAt: features.createdAt,
  updatedAt: features.updatedAt,
  deletedAt: features.deletedAt,
};

const toRecord = (row: FeatureRow): FeatureRecord => ({
  ...row,
  geometry: JSON.parse(row.geometry) as Geometry,
});

export type CreateFeatureInput = {
  layerId: string;
  workspaceId?: string;
  geometry: Geometry;
  properties?: Record<string, unknown>;
};

/**
 * `version` is the caller's expected current version: when the stored row
 * moved on, `VersionConflictError` (HTTP 409) is raised (PRD:301-305).
 */
export type UpdateFeatureInput = {
  version: number;
  geometry?: Geometry;
  properties?: Record<string, unknown>;
};

export const createFeature = async (
  db: Db,
  input: CreateFeatureInput,
): Promise<FeatureRecord> => {
  const [layer] = await db
    .select({ geometryType: layers.geometryType })
    .from(layers)
    .where(and(eq(layers.id, input.layerId), isNull(layers.deletedAt)))
    .limit(1);
  if (!layer) throw new LayerNotFoundError(input.layerId);
  if (input.workspaceId === undefined || input.workspaceId.length === 0)
    throw new Error("workspaceId is required for feature persistence");

  const declaredGeometryType =
    layer.geometryType === null
      ? null
      : geometryTypeSchema.parse(layer.geometryType);
  assertGeometryCompatible(input.geometry, declaredGeometryType);
  await assertStorableGeometry(db, input.geometry);
  const [row] = await db
    .insert(features)
    .values({
      layerId: input.layerId,
      workspaceId: input.workspaceId,
      geometry: geomFromGeoJSON(input.geometry),
      properties: input.properties ?? {},
    })
    .returning(featureSelection);
  if (!row) throw new Error("createFeature: insert returned no row");
  return toRecord(row);
};

export const getFeature = async (
  db: Db,
  id: string,
  input: { includeDeleted?: boolean } = {},
): Promise<FeatureRecord | null> => {
  const [row] = await db
    .select(featureSelection)
    .from(features)
    .where(
      and(
        eq(features.id, id),
        input.includeDeleted === true ? undefined : isNull(features.deletedAt),
      ),
    )
    .limit(1);
  return row ? toRecord(row) : null;
};

export type ListFeaturesInput = {
  layerId: string;
  bbox?: Bbox;
  limit?: number;
  cursor?: string;
  includeDeleted?: boolean;
};

/** Never unbounded: `limit` is clamped, `bbox` pre-filters through the GiST index. */
export const listFeatures = async (
  db: Db,
  input: ListFeaturesInput,
): Promise<Pagination<FeatureRecord>> => {
  const limit = resolveLimit(input.limit);
  const cursor =
    input.cursor !== undefined ? decodeCursor(input.cursor) : undefined;
  const createdAtKey = sql`date_trunc('milliseconds', ${features.createdAt})`;
  const rows = await db
    .select(featureSelection)
    .from(features)
    .where(
      and(
        eq(features.layerId, input.layerId),
        input.includeDeleted === true ? undefined : isNull(features.deletedAt),
        input.bbox ? bboxOverlaps(features.geometry, input.bbox) : undefined,
        cursor
          ? sql`(${createdAtKey}, ${features.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(createdAtKey), desc(features.id))
    .limit(limit + 1);
  return buildPage(rows.map(toRecord), limit, (row) =>
    encodeCursor({ createdAt: row.createdAt, id: row.id }),
  );
};

export const updateFeature = async (
  db: Db,
  id: string,
  input: UpdateFeatureInput,
): Promise<FeatureRecord | null> => {
  if (input.geometry !== undefined)
    await assertStorableGeometry(db, input.geometry);
  const [row] = await db
    .update(features)
    .set({
      ...(input.geometry !== undefined
        ? { geometry: geomFromGeoJSON(input.geometry) }
        : {}),
      ...(input.properties !== undefined
        ? { properties: input.properties }
        : {}),
      version: sql`${features.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(features.id, id),
        eq(features.version, input.version),
        isNull(features.deletedAt),
      ),
    )
    .returning(featureSelection);
  if (row) return toRecord(row);

  // Zero rows: the feature is gone, or its version moved on.
  const [current] = await db
    .select({ version: features.version })
    .from(features)
    .where(and(eq(features.id, id), isNull(features.deletedAt)))
    .limit(1);
  if (!current) return null;
  throw new VersionConflictError(input.version, current.version);
};

/** Soft delete: hidden from listings, kept for audit (PRD:461-462). */
export const softDeleteFeature = async (
  db: Db,
  id: string,
): Promise<string | null> => {
  const [row] = await db
    .update(features)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(features.id, id), isNull(features.deletedAt)))
    .returning({ id: features.id });
  return row?.id ?? null;
};
