import { cors } from "hono/cors";

import type { Env } from "../env.js";

/**
 * CORS restricted to an env-provided allowlist. No wildcard and no credentials,
 * so a stray origin cannot read responses from the local admin session.
 */
export const createCorsMiddleware = (env: Env) =>
  cors({
    origin: (origin) => (env.corsOrigins.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
    credentials: false,
    maxAge: 600,
  });
