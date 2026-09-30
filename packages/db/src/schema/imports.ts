import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
  text,
} from "drizzle-orm/pg-core";

import { inList } from "./checks";
import { layers } from "./layers";
import { projects } from "./projects";
import { workspaces } from "./workspaces";

/**
 * 10-BACKEND-VISIONARIO-PRD.md:197-209. Status values fixed by the PRD; the
 * error message is sanitized by the writer (never raw parser/SQL text).
 */
export const IMPORT_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;

export const imports = pgTable(
  "imports",
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
    targetLayerId: uuid("target_layer_id").references(() => layers.id, {
      onDelete: "cascade",
    }),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    format: varchar("format", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    rowCount: integer("row_count"),
    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    workspaceProjectFk: foreignKey({
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: "imports_workspace_project_fk",
    }),
    workspaceLayerFk: foreignKey({
      columns: [t.workspaceId, t.targetLayerId],
      foreignColumns: [layers.workspaceId, layers.id],
      name: "imports_workspace_layer_fk",
    }).onDelete("cascade"),
    statusCheck: check(
      "imports_status_check",
      inList("status", IMPORT_STATUSES),
    ),
  }),
);
