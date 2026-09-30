import { Hono } from "hono";
import { describe, it, expect } from "vitest";
import { z } from "zod";

import { validate } from "./validation";

describe("Validation Middleware", () => {
  it("should return 200 and attach validated data on success", async () => {
    const app = new Hono<{ Variables: { validatedBody: any } }>();
    const schema = z.object({ name: z.string(), age: z.number() });

    app.post("/test", validate(schema), async (c) => {
      const data = c.get("validatedBody");
      return c.json({ data }, 200);
    });

    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Claude", age: 30 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ name: "Claude", age: 30 });
  });

  it("should return 400 and contract-compliant ValidationError on Zod failure", async () => {
    const app = new Hono();
    const schema = z.object({
      name: z.string(),
      age: z.number().positive(),
    });

    app.post("/test", validate(schema), async (c) => {
      return c.json({ success: true });
    });

    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: 123, age: -1 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();

    expect(body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          requestId: expect.any(String),
          details: expect.arrayContaining([
            expect.objectContaining({ path: "name" }),
            expect.objectContaining({ path: "age" }),
          ]),
        }),
      }),
    );
  });

  it("should return 400 on malformed JSON", async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post("/test", validate(schema), async (c) => {
      return c.json({ success: true });
    });

    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json }",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("JSON");
  });
});
