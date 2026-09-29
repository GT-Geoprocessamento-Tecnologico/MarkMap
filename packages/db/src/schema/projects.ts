import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * 10-BACKEND-VISIONARIO-PRD.md:114-126. No indexes yet: `status`/`deleted_at`
 * get one only when a real query needs them.
 */
export const projects = pgTable('projects', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 160 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 32 })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
