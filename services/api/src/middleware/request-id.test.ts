import { Hono } from "hono";
import { describe, it, expect } from "vitest";
import { requestId, getRequestId, REQUEST_ID_HEADER } from "./request-id.js";
import { randomUUID } from "node:crypto";

describe("Request ID Middleware", () => {
  it("should generate a new UUID if no request ID is provided", async () => {
    const app = new Hono();
    app.use("*", requestId());
    app.get("/test", (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    const body = await res.json();

    // UUID regex check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(body.id).toMatch(uuidRegex);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(body.id);
  });

  it("should reuse client-supplied valid UUID", async () => {
    const clientUuid = randomUUID();
    const app = new Hono();
    app.use("*", requestId());
    app.get("/test", (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const res = await app.request("/test", {
      headers: {
        [REQUEST_ID_HEADER]: clientUuid,
      }
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe(clientUuid);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(clientUuid);
  });

  it("should generate a new UUID if client-supplied ID is not a valid UUID", async () => {
    const invalidId = "not-a-valid-uuid";
    const app = new Hono();
    app.use("*", requestId());
    app.get("/test", (c) => {
      const id = getRequestId(c);
      return c.json({ id });
    });

    const res = await app.request("/test", {
      headers: {
        [REQUEST_ID_HEADER]: invalidId,
      }
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(body.id).toMatch(uuidRegex);
    expect(body.id).not.toBe(invalidId);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe(body.id);
  });
});
