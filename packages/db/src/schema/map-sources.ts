import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { inList } from "./checks";
import { projects } from "./projects";

/**
 * 10-BACKEND-VISIONARIO-PRD.md:181-195. `project_id` nullable: global sources
 * (e.g. the basemap) are allowed. Never store sensitive tokens in `config`
 * (PRD:195).
 */
export const MAP_SOURCE_PROVIDER_TYPES = [
  "xyz",
  "style",
  "wms",
  "wfs",
  "pmtiles",
  "geojson",
] as const;

export const mapSources = pgTable(
  "map_sources",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 160 }).notNull(),
    providerType: varchar("provider_type", { length: 16 }).notNull(),
    urlTemplate: text("url_template").notNull(),
    attribution: text("attribution"),
    config: jsonb("config")
      .notNull()
      .default(sql`'{}'`),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => ({
    providerTypeCheck: check(
      "map_sources_provider_type_check",
      inList("provider_type", MAP_SOURCE_PROVIDER_TYPES),
    ),
  }),
);
