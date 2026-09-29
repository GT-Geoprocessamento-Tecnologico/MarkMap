/**
 * PostgreSQL client setup using drizzle-orm
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

// Resolve connection string from environment
const connectionString = process.env.DATABASE_URL || process.env.NEON_DB_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or NEON_DB_URL must be set in environment');
}

// Initialize drizzle client
export const db = drizzle(neon(connectionString) as any);

export type Db = typeof db;
export type DbHandle = typeof db;

export const getDb = () => db;
export const createDb = () => db;
export const closeDb = () => Promise.resolve();