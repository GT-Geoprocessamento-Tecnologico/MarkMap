import { describe, expect, it, vi } from "vitest";

import { createDb } from "../src/index.js";

describe("database handle ownership", () => {
  it("creates independent handles for explicit URLs", async () => {
    const first = createDb("postgres://first");
    const second = createDb("postgres://second");

    expect(first.db).not.toBe(second.db);
    await first.close();
    await second.close();
  });

  it("invalidates the singleton after closeDb", async () => {
    const previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://singleton";
    vi.resetModules();
    try {
      const client = await import("../src/client.js");
      expect(client.getDb()).toBeDefined();
      await client.closeDb();
      expect(() => client.getDb()).toThrow(
        "DATABASE_URL or NEON_DB_URL must be set in environment",
      );
    } finally {
      if (previousUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousUrl;
      }
      vi.resetModules();
    }
  });
});
