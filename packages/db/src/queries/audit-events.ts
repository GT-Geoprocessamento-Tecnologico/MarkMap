import type { Db } from '../client.js';
import { auditEvents } from '../schema/audit-events.js';

export type AuditEventRecord = typeof auditEvents.$inferSelect;

/**
 * `before`/`after` are the caller's responsibility: store the changed fields
 * of the entity, never blobs, files or secrets (10-BACKEND-VISIONARIO-PRD.md:225).
 */
export type InsertAuditEventInput = {
  entityType: string;
  entityId: string;
  action: string;
  requestId: string;
  actorType?: string;
  actorId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export const insertAuditEvent = async (
  db: Db,
  input: InsertAuditEventInput,
): Promise<AuditEventRecord> => {
  const [row] = await db
    .insert(auditEvents)
    .values({
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      requestId: input.requestId,
      actorType: input.actorType ?? 'system',
      actorId: input.actorId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
    })
    .returning();
  if (!row) throw new Error('insertAuditEvent: insert returned no row');
  return row;
};
