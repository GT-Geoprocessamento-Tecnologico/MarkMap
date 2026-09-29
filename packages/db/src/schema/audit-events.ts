import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * 10-BACKEND-VISIONARIO-PRD.md:210-225. Critical changes are recorded even
 * without auth (`actor_type` defaults to `system`). `before`/`after` must never
 * hold blobs, files or secrets (PRD:225) — the writer decides what goes in.
 *
 * The `(entity_type, entity_id)` index backs the milestone check that an edit
 * was audited (00-MASTER-PRD.md:130).
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    actorType: varchar('actor_type', { length: 32 })
      .notNull()
      .default('system'),
    actorId: uuid('actor_id'),
    requestId: uuid('request_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('audit_events_entity_idx').on(t.entityType, t.entityId)],
);
