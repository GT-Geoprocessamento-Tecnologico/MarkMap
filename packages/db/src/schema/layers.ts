import { geometryTypeSchema } from "@markmap/contracts/geometry";
import { sql, desc } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { inList } from "./checks";
import { projects } from "./projects";
import { workspaces } from "./workspaces";

/**
 * 10-BACKEND-VISIONARIO-PRD.md:143-154. `kind` is a logical enum enforced by
 * CHECK (PostgreSQL has no portable enum ALTER); `geometry_type` mirrors the
 * wire enum from `@markmap/contracts` so both cannot drift.
 *
 * `description` is not in the PRD table but exists in `layerSchema`
 * (packages/contracts): kept nullable so the HTTP contract can persist without
 * losing data — see docs/database/schema.md.
 */
export const LAYER_KINDS = [
  "point",
  "line",
  "polygon",
  "mixed",
  "raster",
  "remote",
] as const;

export const layers = pgTable(
  "layers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    kind: varchar("kind", { length: 32 }).notNull(),
    geometryType: varchar("geometry_type", { length: 32 }),
    srid: integer("srid").notNull().default(4674),
    style: jsonb("style")
      .notNull()
      .default(sql`'{}'`),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'`),
    visibleByDefault: boolean("visible_by_default").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    indexes: [
      index("layers_project_id_sort_order_idx").on(t.projectId, t.sortOrder),
      index("layers_project_created_at_id_idx").on(
        t.projectId,
        desc(t.createdAt),
        desc(t.id),
      ),
    ],
    workspaceEntityKey: uniqueIndex("layers_workspace_id_key").on(
      t.workspaceId,
      t.id,
    ),
    workspaceProjectFk: foreignKey({
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "layers_workspace_project_fk",
    }),
    checks: [
      check("layers_kind_check", inList("kind", LAYER_KINDS)),
      check(
        "layers_geometry_type_check",
        sql`"geometry_type" IS NULL OR ${inList(
          "geometry_type",
          geometryTypeSchema.options,
        )}`,
      ),
      check("layers_srid_check", sql`${t.srid} = 4674`),
    ],
  }),
);
