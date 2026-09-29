import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { geometryColumn } from './geometry';
import { layers } from './layers';

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
  'features',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    layerId: uuid('layer_id')
      .notNull()
      .references(() => layers.id, { onDelete: 'cascade' }),
    geometry: geometryColumn('geometry').notNull(),
    properties: jsonb('properties')
      .notNull()
      .default(sql`'{}'`),
    version: integer('version')
      .notNull()
      .default(1),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    geometryIdx: index('features_geometry_idx').using('gist', t.geometry),
    layerIdIdx: index('features_layer_id_idx').on(t.layerId),
    sridCheck: check('features_geometry_srid_check', sql`ST_SRID(${t.geometry}) = 4674`),
    notEmptyCheck: check('features_geometry_not_empty_check', sql`NOT ST_IsEmpty(${t.geometry})`),
  }),
);
