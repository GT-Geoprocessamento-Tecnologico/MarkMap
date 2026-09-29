import { sql } from 'drizzle-orm';
import { numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { projects } from './projects';

/**
 * 10-BACKEND-VISIONARIO-PRD.md:128-137. `default_center` uses simple numeric
 * columns instead of jsonb (PRD allows either): typed, queryable, no parsing.
 */
export const maps = pgTable('maps', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  defaultCenterLng: numeric('default_center_lng', { precision: 9, scale: 6, mode: 'number' }),
  defaultCenterLat: numeric('default_center_lat', { precision: 9, scale: 6, mode: 'number' }),
  defaultZoom: numeric('default_zoom', { precision: 5, scale: 2, mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
