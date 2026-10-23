import { Hono } from "hono";
import { describe, it, expect } from "vitest";

import type { Env } from "../env.js";
import { createCorsMiddleware } from "./cors";

describe("CORS Middleware", () => {
  it("should allow origin if it is present in env.corsOrigins", async () => {
    const app = new Hono();
    const env = {
      corsOrigins: ["http://localhost:5173", "https://example.com"],
    } as unknown as Env;
    app.use("*", createCorsMiddleware(env));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      method: "GET",
      headers: { Origin: "https://example.com" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://example.com",
    );
  });

  it("should not allow origin if it is absent from env.corsOrigins", async () => {
    const app = new Hono();
    const env = { corsOrigins: ["http://localhost:5173"] } as unknown as Env;
    app.use("*", createCorsMiddleware(env));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      method: "GET",
      headers: { Origin: "http://evil.com" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("should return correct headers for OPTIONS preflight request", async () => {
    const app = new Hono();
    const env = { corsOrigins: ["http://localhost:5173"] } as unknown as Env;
    app.use("*", createCorsMiddleware(env));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "Content-Type,Authorization,X-Request-Id",
    );
    expect(res.headers.get("access-control-expose-headers")).toBe(
      "X-Request-Id",
    );
    expect(res.headers.get("access-control-max-age")).toBe("600");
  });
});
