import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { workspaces } from "./workspaces";

export const syncEntities = pgTable(
  "sync_entities",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entity: varchar("entity", { length: 16 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    version: integer("version").notNull().default(1),
    payload: jsonb("payload"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.workspaceId, t.entity, t.entityId],
    }),
    scopeIdx: index("sync_entities_scope_idx").on(t.workspaceId, t.entity),
  }),
);

export const syncOperations = pgTable(
  "sync_operations",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    operationId: uuid("operation_id").notNull(),
    entity: varchar("entity", { length: 16 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    operation: varchar("operation", { length: 8 }).notNull(),
    envelope: jsonb("envelope").notNull(),
    version: integer("version").notNull(),
    sequence: bigint("sequence", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.workspaceId, t.operationId],
    }),
    sequenceIdx: index("sync_operations_workspace_sequence_idx").on(
      t.workspaceId,
      t.sequence,
    ),
  }),
);

export const syncTombstones = pgTable(
  "sync_tombstones",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entity: varchar("entity", { length: 16 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    version: integer("version").notNull(),
    sequence: bigint("sequence", { mode: "bigint" }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.workspaceId, t.entity, t.entityId],
    }),
    seq: index("sync_tombstones_workspace_sequence_idx").on(
      t.workspaceId,
      t.sequence,
    ),
  }),
);

export const uploadSessions = pgTable("upload_sessions", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata").notNull(),
  blobId: uuid("blob_id").notNull(),
  receivedBytes: bigint("received_bytes", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  completed: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
