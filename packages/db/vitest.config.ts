import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests reset and migrate a real PostGIS database.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Every integration file migrates and TRUNCATEs the same database, so they
    // must not overlap. In parallel they race on the drizzle migrations table
    // ("duplicate key ... __drizzle_migrations_id_seq") and would also truncate
    // each other's fixtures mid-assertion.
    fileParallelism: false,
  },
});
