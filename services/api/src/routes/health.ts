import { createDb } from "@geonexo/db";
import { sql } from "drizzle-orm";
import { Hono } from "hono";

import type { Env } from "../env.js";

const VERSION = "0.1.0";
const DATABASE_UNAVAILABLE = "Database unavailable";

export type DatabaseProbe = () => Promise<void>;

const probeConfiguredDatabase = async (url: string): Promise<void> => {
  const handle = createDb(url, {
    connectTimeoutSeconds: 2,
    statementTimeoutMs: 2_000,
  });
  try {
    await handle.db.execute(sql`SELECT 1`);
  } finally {
    await handle.close();
  }
};

/**
 * Health probes. Reports whether a database is configured but never exposes the
 * connection string or any credential.
 */
export const healthRoutes = (env: Env, probeDatabase?: DatabaseProbe) => {
  const routes = new Hono();

  routes.get("/health", async (c) => {
    let dbStatus = env.hasDatabase ? "configured" : "not_configured";
    let dbError: string | undefined;

    if (env.hasDatabase) {
      try {
        if (probeDatabase) {
          await probeDatabase();
        } else {
          await probeConfiguredDatabase(env.DATABASE_URL!);
        }
        dbStatus = "connected";
      } catch {
        dbStatus = "error";
        dbError = DATABASE_UNAVAILABLE;
      }
    }

    return c.json(
      {
        status: dbStatus === "error" ? "degraded" : "ok",
        version: VERSION,
        database: dbStatus,
        dbError,
        timestamp: new Date().toISOString(),
      },
      dbStatus === "error" ? 503 : 200,
    );
  });

  routes.get("/api/v1", (c) =>
    c.json({
      name: "GeoNexo API",
      version: VERSION,
      endpoints: {
        health: "/health",
      },
    }),
  );

  return routes;
};
