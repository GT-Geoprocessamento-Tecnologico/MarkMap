import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({})),
  consumeRateLimit: vi.fn(),
  provisionWorkspace: vi.fn(),
  recoverWorkspaceCapability: vi.fn(),
}));

vi.mock("@markmap/db", async () => ({
  ...(await vi.importActual<typeof import("@markmap/db")>("@markmap/db")),
  ...dbMocks,
}));

import { workspaceRoutes } from "../src/routes/workspace.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const installationId = "22222222-2222-4222-8222-222222222222";
const bootstrapProof = "A".repeat(43);
const requestId = "33333333-3333-4333-8333-333333333333";

const createWorkspaceApp = () => {
  const app = new Hono<{ Variables: { requestId: string } }>();
  app.use("*", async (c, next) => {
    c.set("requestId", requestId);
    await next();
  });
  workspaceRoutes(app);
  return app;
};

describe("workspace abuse protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.provisionWorkspace.mockResolvedValue({
      workspaceId,
      generation: "1",
    });
    dbMocks.recoverWorkspaceCapability.mockResolvedValue({
      workspaceId,
      generation: "2",
    });
  });

  it("returns 429 before provisioning when the identity bucket is exhausted", async () => {
    dbMocks.consumeRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
    });

    const response = await createWorkspaceApp().request(
      "/workspace/provision",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bootstrapProof, installationId, workspaceId }),
      },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
    expect(dbMocks.provisionWorkspace).not.toHaveBeenCalled();
  });

  it("consumes identity and global buckets before provisioning", async () => {
    dbMocks.consumeRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9 })
      .mockResolvedValueOnce({ allowed: true, remaining: 199 });

    const response = await createWorkspaceApp().request(
      "/workspace/provision",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bootstrapProof, installationId, workspaceId }),
      },
    );

    expect(response.status).toBe(201);
    expect(dbMocks.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(dbMocks.provisionWorkspace).toHaveBeenCalledTimes(1);
    const rawCalls = JSON.stringify(dbMocks.consumeRateLimit.mock.calls);
    expect(rawCalls).not.toContain(bootstrapProof);
  });

  it("returns 429 before recovering capability when the identity bucket is exhausted", async () => {
    dbMocks.consumeRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
    });

    const response = await createWorkspaceApp().request("/workspace/recover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bootstrapProof }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
    expect(response.headers.get("retry-after")).toBe("60");
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toBe("Too many workspace recovery attempts");
    expect(body.error.requestId).toBe(requestId);
    expect(dbMocks.recoverWorkspaceCapability).not.toHaveBeenCalled();
  });

  it("consumes identity and global buckets before recovering capability", async () => {
    dbMocks.consumeRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9 })
      .mockResolvedValueOnce({ allowed: true, remaining: 199 });

    const response = await createWorkspaceApp().request("/workspace/recover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bootstrapProof }),
    });

    expect(response.status).toBe(200);
    expect(dbMocks.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(dbMocks.recoverWorkspaceCapability).toHaveBeenCalledTimes(1);
    const rawCalls = JSON.stringify(dbMocks.consumeRateLimit.mock.calls);
    expect(rawCalls).not.toContain(bootstrapProof);
  });
});
