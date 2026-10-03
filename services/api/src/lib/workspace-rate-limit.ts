import { consumeRateLimit, getDb } from "@geonexo/db";

const IDENTITY_LIMIT_PER_MINUTE = 10;
const GLOBAL_LIMIT_PER_MINUTE = 200;
const WINDOW_SECONDS = 60;

export type WorkspaceRateLimitScope = "provision" | "recover";

export type WorkspaceRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Two distributed buckets are consumed:
 * - identity: stops repeated abuse of the same bootstrap identity;
 * - global: bounds abuse even if an attacker rotates bootstrap values.
 *
 * No client-provided IP header is trusted, so spoofed X-Forwarded-For values
 * cannot bypass or fragment the limiter.
 */
export const checkWorkspaceRateLimit = async (input: {
  scope: WorkspaceRateLimitScope;
  identityDigest: string;
  requestId: string;
}): Promise<WorkspaceRateLimitResult> => {
  const db = getDb();
  const action = `workspace_${input.scope}`;

  const identity = await consumeRateLimit(db, {
    bucketKey: `identity:${input.identityDigest}`,
    action,
    requestId: input.requestId,
    limit: IDENTITY_LIMIT_PER_MINUTE,
    windowSeconds: WINDOW_SECONDS,
  });
  if (!identity.allowed) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: WINDOW_SECONDS,
    };
  }

  const global = await consumeRateLimit(db, {
    bucketKey: "global",
    action,
    requestId: input.requestId,
    limit: GLOBAL_LIMIT_PER_MINUTE,
    windowSeconds: WINDOW_SECONDS,
  });

  return {
    allowed: global.allowed,
    remaining: Math.min(identity.remaining, global.remaining),
    retryAfterSeconds: WINDOW_SECONDS,
  };
};
