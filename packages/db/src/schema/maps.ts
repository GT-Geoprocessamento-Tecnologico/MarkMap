import { sql } from "drizzle-orm";
import {
  foreignKey,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { projects } from "./projects";
import { workspaces } from "./workspaces";

/**
 * 10-BACKEND-VISIONARIO-PRD.md:128-137. `default_center` uses simple numeric
 * columns instead of jsonb (PRD allows either): typed, queryable, no parsing.
 */
export const maps = pgTable(
  "maps",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    defaultCenterLng: numeric("default_center_lng", { precision: 9, scale: 6 }),
    defaultCenterLat: numeric("default_center_lat", { precision: 9, scale: 6 }),
    defaultZoom: numeric("default_zoom", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    workspaceEntityKey: uniqueIndex("maps_workspace_id_key").on(
      t.workspaceId,
      t.id,
    ),
    workspaceProjectFk: foreignKey({
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "maps_workspace_project_fk",
    }),
  }),
);
