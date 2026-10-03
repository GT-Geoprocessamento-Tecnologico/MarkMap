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
  const variantByte = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
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

  return db.transaction(async (tx) => {
    // Acquire the transaction-scoped lock in its own statement. Under
    // READ COMMITTED the following count sees commits from the previous lock
    // holder, which avoids stale-snapshot races across API instances.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${stableKey}, 0))`,
    );

    const rows = await tx.execute(sql`
      SELECT count(*)::int AS used
      FROM audit_events
      WHERE entity_type = 'rate_limit'
        AND entity_id = ${entityId}::uuid
        AND action = ${input.action}
        AND created_at >= now() - (${input.windowSeconds} * interval '1 second')
    `);
    const row = rows[0] as { used?: number | string } | undefined;
    const used = Number(row?.used ?? input.limit);
    if (used >= input.limit) {
      return { allowed: false, remaining: 0 };
    }

    await tx.execute(sql`
      INSERT INTO audit_events (
        entity_type,
        entity_id,
        action,
        actor_type,
        request_id
      )
      VALUES (
        'rate_limit',
        ${entityId}::uuid,
        ${input.action},
        'system',
        ${input.requestId}::uuid
      )
    `);

    return {
      allowed: true,
      remaining: Math.max(input.limit - used - 1, 0),
    };
  });
};
