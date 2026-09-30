import { buildPage } from "@geonexo/contracts";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { Db } from "../client";
import { InvalidCursorError } from "../errors.js";
import { decodeCursor, encodeCursor, resolveLimit } from "../pagination.js";
import { projects } from "../schema/projects";

export type ProjectRecord = typeof projects.$inferSelect;

export type CreateProjectInput = {
  name: string;
  description?: string;
  workspaceId?: string;
};

export async function createProject(db: Db, input: CreateProjectInput) {
  if (input.workspaceId === undefined || input.workspaceId.length === 0)
    throw new Error("workspaceId is required for project persistence");
  const result = await db
    .insert(projects)
    .values({ ...input, workspaceId: input.workspaceId })
    .returning();
  return result[0];
}

export async function getProject(
  db: Db,
  id: string,
): Promise<ProjectRecord | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listProjects(
  db: Db,
  input: { limit?: number; offset?: number; cursor?: string } = {},
): Promise<{ items: ProjectRecord[]; nextCursor: string | null }> {
  if (input.cursor !== undefined && input.offset !== undefined) {
    throw new InvalidCursorError("cursor and offset cannot be used together");
  }

  const limit = resolveLimit(input.limit);
  const offset = input.offset ?? 0;
  const cursor =
    input.cursor !== undefined ? decodeCursor(input.cursor) : undefined;

  // PostgreSQL stores timestamp precision beyond JavaScript Date milliseconds.
  // The cursor codec emits ISO milliseconds, so both filtering and ordering
  // must truncate to milliseconds before using the UUID tie-breaker.
  const createdAtKey = sql`date_trunc('milliseconds', ${projects.createdAt})`;
  const items = await db
    .select()
    .from(projects)
    .where(
      and(
        isNull(projects.deletedAt),
        cursor
          ? sql`(${createdAtKey}, ${projects.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(createdAtKey), desc(projects.id))
    .limit(limit + 1)
    .offset(offset);
  return buildPage(items, limit, (row) =>
    encodeCursor({ createdAt: row.createdAt, id: row.id }),
  );
}
