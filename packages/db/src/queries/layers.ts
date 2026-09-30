import {
  buildPage,
  type GeometryType,
  type Pagination,
} from "@geonexo/contracts";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "../client.js";
import { ProjectNotFoundError } from "../errors.js";
import { decodeCursor, encodeCursor, resolveLimit } from "../pagination.js";
import { LAYER_KINDS, layers } from "../schema/layers.js";
import { projects } from "../schema/projects.js";

export type LayerRecord = typeof layers.$inferSelect;

export type LayerKind = (typeof LAYER_KINDS)[number];

export type CreateLayerInput = {
  projectId: string;
  workspaceId?: string;
  name: string;
  kind: LayerKind;
  geometryType: GeometryType | null;
  description?: string | null;
};

export type UpdateLayerInput = {
  name?: string;
  description?: string | null;
  visibleByDefault?: boolean;
  sortOrder?: number;
};

export const createLayer = async (
  db: Db,
  input: CreateLayerInput,
): Promise<LayerRecord> => {
  // Verify that the referenced project exists
  const project = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, input.projectId), isNull(projects.deletedAt)))
    .limit(1);
  if (project.length === 0) {
    throw new ProjectNotFoundError(input.projectId);
  }
  if (input.workspaceId === undefined || input.workspaceId.length === 0)
    throw new Error("workspaceId is required for layer persistence");

  const [row] = await db
    .insert(layers)
    .values({
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      name: input.name,
      kind: input.kind,
      geometryType: input.geometryType,
      description: input.description ?? null,
    })
    .returning();
  if (!row) throw new Error("createLayer: insert returned no row");
  return row;
};

export const getLayer = async (
  db: Db,
  id: string,
): Promise<LayerRecord | null> => {
  const [row] = await db
    .select()
    .from(layers)
    .where(and(eq(layers.id, id), isNull(layers.deletedAt)))
    .limit(1);
  return row ?? null;
};

export const listLayers = async (
  db: Db,
  input: { projectId: string; limit?: number; cursor?: string },
): Promise<Pagination<LayerRecord>> => {
  const limit = resolveLimit(input.limit);
  const cursor =
    input.cursor !== undefined ? decodeCursor(input.cursor) : undefined;
  const createdAtKey = sql`date_trunc('milliseconds', ${layers.createdAt})`;
  const rows = await db
    .select()
    .from(layers)
    .where(
      and(
        eq(layers.projectId, input.projectId),
        isNull(layers.deletedAt),
        cursor
          ? sql`(${createdAtKey}, ${layers.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(createdAtKey), desc(layers.id))
    .limit(limit + 1);
  return buildPage(rows, limit, (row) =>
    encodeCursor({ createdAt: row.createdAt, id: row.id }),
  );
};

export const updateLayer = async (
  db: Db,
  id: string,
  input: UpdateLayerInput,
): Promise<LayerRecord | null> => {
  const [row] = await db
    .update(layers)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.visibleByDefault !== undefined
        ? { visibleByDefault: input.visibleByDefault }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      updatedAt: sql`now()`,
    })
    .where(and(eq(layers.id, id), isNull(layers.deletedAt)))
    .returning();
  return row ?? null;
};

/**
 * Soft delete: the row stays for audit/restore, listings drop it. Features are
 * not touched — layer-level restore keeps working (decision recorded in
 * docs/database/schema.md).
 */
export const softDeleteLayer = async (
  db: Db,
  id: string,
): Promise<string | null> => {
  const [row] = await db
    .update(layers)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(layers.id, id), isNull(layers.deletedAt)))
    .returning({ id: layers.id });
  return row?.id ?? null;
};
