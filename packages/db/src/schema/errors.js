/**
 * Stub for ErrorSchema used in Drizzle schema definitions.
 * This file provides a minimal definition to satisfy type checks.
 * It exports a table configuration for the 'error' table.
 */
import { table, column, timestamp, uuid, sql } from 'drizzle-orm';

export const error = table('error', {
  id: uuid('id').primaryKey(),
  code: sql.varChar('code', { length: 64 }),
  message: sql.varChar('message', { length: 255 }),
  requestId: sql.varChar('request_id', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export default error;