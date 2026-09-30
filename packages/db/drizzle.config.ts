import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated from `src/schema` and versioned in `drizzle/`.
 * `DATABASE_URL` is only needed for `db:migrate`/`db:studio`; `db:generate`
 * works offline. Never point these commands at production (00-MASTER-PRD.md:14).
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
