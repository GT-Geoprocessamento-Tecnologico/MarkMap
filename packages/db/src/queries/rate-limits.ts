import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import type { Db } from "../client.js";

export type ConsumeRateLimitInput = {
  bucketKey: string;
  action: string;
  requestId: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
};

const bucketUuid = (key: string): string => {
  const hex = createHash("sha256").update(key, "utf8").digest("hex");
  const variantByte = (
    (Number.parseInt(hex.slice(16, 18), 16) & 0x3f) |
    0x80
  )
    .toString(16)
    .padStart(2, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variantByte}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
};

/**
 * Distributed fixed-window limiter backed by the existing audit_events table.
 * A PostgreSQL advisory lock serializes the bucket across API instances.
 * Blocked requests are not inserted, so an attacker cannot amplify audit rows
 * after a bucket reaches its limit.
 */
export const consumeRateLimit = async (
  db: Db,
  input: ConsumeRateLimitInput,
): Promise<RateLimitDecision> => {
  if (!Number.isInteger(input.limit) || input.limit < 1)
    throw new Error("rate limit must be a positive integer");
  if (!Number.isInteger(input.windowSeconds) || input.windowSeconds < 1)
    throw new Error("rate limit window must be a positive integer");

  const stableKey = `${input.action}:${input.bucketKey}`;
  const entityId = bucketUuid(stableKey);

  const rows = await db.execute(sql`
    WITH advisory AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtextextended(${stableKey}, 0))
    ),
    recent AS MATERIALIZED (
      SELECT count(*)::int AS used
      FROM audit_events
      CROSS JOIN advisory
      WHERE entity_type = 'rate_limit'
        AND entity_id = ${entityId}::uuid
        AND action = ${input.action}
        AND created_at >= now() - (${input.windowSeconds} * interval '1 second')
    ),
    inserted AS (
      INSERT INTO audit_events (
        entity_type,
        entity_id,
        action,
        actor_type,
        request_id
      )
      SELECT
        'rate_limit',
        ${entityId}::uuid,
        ${input.action},
        'system',
        ${input.requestId}::uuid
      FROM recent
      WHERE used < ${input.limit}
      RETURNING 1
    )
    SELECT
      recent.used::int AS used_before,
      EXISTS (SELECT 1 FROM inserted) AS allowed
    FROM recent
  `);

  const row = rows[0] as
    | { used_before?: number | string; allowed?: boolean }
    | undefined;
  const usedBefore = Number(row?.used_before ?? input.limit);
  const allowed = row?.allowed === true;
  return {
    allowed,
    remaining: allowed ? Math.max(input.limit - usedBefore - 1, 0) : 0,
  };
};
