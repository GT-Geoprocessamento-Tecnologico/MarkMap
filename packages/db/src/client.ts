/**
 * PostgreSQL client setup using the Node postgres-js driver.
 *
 * The postgres-js Drizzle adapter speaks PostgreSQL over TCP, so the same
 * client works with local PostGIS and Neon TCP connection strings. The Neon
 * HTTP client is intentionally not used here: it is not a Drizzle postgres
 * client and cannot support local PostGIS connections.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL ?? process.env.NEON_DB_URL;

type PostgresClient = ReturnType<typeof postgres>;
export type Db = ReturnType<typeof drizzle>;
export type DbHandle = { db: Db; close: () => Promise<void> };
export type DbOptions = {
  connectTimeoutSeconds?: number;
  statementTimeoutMs?: number;
};

const openDb = (url: string, options: DbOptions = {}): DbHandle => {
  const client: PostgresClient = postgres(url, {
    connect_timeout: options.connectTimeoutSeconds ?? 5,
    max: 1,
    connection: { statement_timeout: options.statementTimeoutMs ?? 10_000 },
  });
  return {
    db: drizzle(client),
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
};

let defaultHandle =
  connectionString !== undefined ? openDb(connectionString) : undefined;

export const db = defaultHandle?.db;

export const getDb = (): Db => {
  if (!defaultHandle) {
    throw new Error("DATABASE_URL or NEON_DB_URL must be set in environment");
  }
  return defaultHandle.db;
};

export const createDb = (url?: string, options: DbOptions = {}): DbHandle => {
  const targetUrl = url ?? connectionString;
  if (targetUrl === undefined || targetUrl.length === 0) {
    throw new Error("DATABASE_URL or NEON_DB_URL must be set in environment");
  }
  return openDb(targetUrl, options);
};

export const closeDb = async (): Promise<void> => {
  const handle = defaultHandle;
  defaultHandle = undefined;
  await handle?.close();
};
