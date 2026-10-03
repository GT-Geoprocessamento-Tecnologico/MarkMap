import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getDb: vi.fn(() => ({})),
  consumeRateLimit: vi.fn(),
  provisionWorkspace: vi.fn(),
  recoverWorkspaceCapability: vi.fn(),
}));

vi.mock("@geonexo/db", async () => ({
  ...(await vi.importActual<typeof import("@geonexo/db")>("@geonexo/db")),
  ...dbMocks,
}));

import { workspaceRoutes } from "../src/routes/workspace.js";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const installationId = "22222222-2222-4222-8222-222222222222";
const bootstrapProof = "A".repeat(43);
const requestId = "33333333-3333-4333-8333-333333333333";

const createWorkspaceApp = () => {
  const app = new Hono();
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

    const response = await createWorkspaceApp().request("/workspace/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bootstrapProof, installationId, workspaceId }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
    expect(dbMocks.provisionWorkspace).not.toHaveBeenCalled();
  });

  it("consumes identity and global buckets before provisioning", async () => {
    dbMocks.consumeRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 9 })
      .mockResolvedValueOnce({ allowed: true, remaining: 199 });

    const response = await createWorkspaceApp().request("/workspace/provision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bootstrapProof, installationId, workspaceId }),
    });

    expect(response.status).toBe(201);
    expect(dbMocks.consumeRateLimit).toHaveBeenCalledTimes(2);
    expect(dbMocks.provisionWorkspace).toHaveBeenCalledTimes(1);
    const rawCalls = JSON.stringify(dbMocks.consumeRateLimit.mock.calls);
    expect(rawCalls).not.toContain(bootstrapProof);
  });
});
