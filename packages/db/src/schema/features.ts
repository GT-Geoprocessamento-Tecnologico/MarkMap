import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { geometryColumn } from "./geometry";
import { layers } from "./layers";
import { workspaces } from "./workspaces";

/**
 * 10-BACKEND-VISIONARIO-PRD.md:158-179. One unified table; geometry stored as
 * PostGIS `geometry(Geometry, 4674)`, `properties` as jsonb, `version` for
 * optimistic concurrency (50-CONTRATOS-DE-INTEGRACAO.md:128).
 *
 * Indexes: GiST on geometry (bbox), btree on layer_id (the equality filter of
 * every feature query). The composite `(layer_id, updated_at)` stays out until
 * a real query asks for it (PRD:174).
 */
export const features = pgTable(
  "features",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),
    layerId: uuid("layer_id")
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),
    geometry: geometryColumn("geometry").notNull(),
    properties: jsonb("properties")
      .notNull()
      .default(sql`'{}'`),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    geometryIdx: index("features_geometry_idx").using("gist", t.geometry),
    layerIdIdx: index("features_layer_id_idx").on(t.layerId),
    workspaceEntityKey: uniqueIndex("features_workspace_id_key").on(
      t.workspaceId,
      t.id,
    ),
    workspaceLayerFk: foreignKey({
      columns: [t.workspaceId, t.layerId],
      foreignColumns: [layers.workspaceId, layers.id],
      name: "features_workspace_layer_fk",
    }),
    sridCheck: check(
      "features_geometry_srid_check",
      sql`ST_SRID(${t.geometry}) = 4674`,
    ),
    notEmptyCheck: check(
      "features_geometry_not_empty_check",
      sql`NOT ST_IsEmpty(${t.geometry})`,
    ),
  }),
);
