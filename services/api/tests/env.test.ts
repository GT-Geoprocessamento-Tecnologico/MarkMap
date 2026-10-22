import { describe, expect, it } from "vitest";

import { loadEnv } from "../src/env.js";

const source = (overrides: Record<string, string | undefined> = {}) => ({
  NODE_ENV: "test",
  CORS_ORIGINS: "http://localhost:5173",
  ...overrides,
});

describe("database environment aliases", () => {
  it("requires an explicit runtime mode", () => {
    const input: Record<string, string | undefined> = source();
    delete input.NODE_ENV;
    expect(() => loadEnv(input)).toThrow(/NODE_ENV/);
  });

  it.each(["development", "test", "production"] as const)(
    "accepts explicit %s mode",
    (nodeEnv) => {
      expect(loadEnv(source({ NODE_ENV: nodeEnv })).NODE_ENV).toBe(nodeEnv);
    },
  );

  it("normalizes NEON_DB_URL to DATABASE_URL", () => {
    const env = loadEnv(source({ NEON_DB_URL: "postgres://alias" }));
    expect(env.DATABASE_URL).toBe("postgres://alias");
    expect(env.hasDatabase).toBe(true);
  });

  it("prefers DATABASE_URL when both names are present", () => {
    const env = loadEnv(
      source({
        DATABASE_URL: "postgres://canonical",
        NEON_DB_URL: "postgres://alias",
      }),
    );
    expect(env.DATABASE_URL).toBe("postgres://canonical");
    expect(env.hasDatabase).toBe(true);
  });
});
