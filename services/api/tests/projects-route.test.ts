import { Hono } from "hono";
import { vi, describe, expect, it } from "vitest";

const dbMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getDb: vi.fn(() => ({})),
}));

vi.mock("@geonexo/db", async () => ({
  ...(await vi.importActual<typeof import("@geonexo/db")>("@geonexo/db")),
  listProjects: dbMocks.listProjects,
  getDb: dbMocks.getDb,
}));

import { projectRoutes } from "../src/routes/projects.js";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const project = {
  id: uuid,
  name: "Survey",
  description: null,
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("projects route pagination", () => {
  it("forwards validated cursor and relays the DB nextCursor", async () => {
    const cursor = Buffer.from(
      "2026-01-01T00:00:00.000Z|3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    ).toString("base64url");
    dbMocks.listProjects.mockResolvedValueOnce({
      items: [project],
      nextCursor: "next-page",
    });
    const app = new Hono();
    projectRoutes(app);

    const response = await app.request(`/projects?limit=25&cursor=${cursor}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: uuid,
          name: "Survey",
          status: "active",
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
        },
      ],
      nextCursor: "next-page",
    });
    expect(dbMocks.listProjects).toHaveBeenCalledWith(
      {},
      { limit: 25, cursor },
    );
  });

  it("rejects an invalid cursor before obtaining the DB", async () => {
    dbMocks.getDb.mockClear();
    const app = new Hono();
    app.onError(() => new Response("validation", { status: 400 }));
    projectRoutes(app);
    const response = await app.request("/projects?cursor=invalid");
    expect(response.status).toBe(400);
    expect(dbMocks.getDb).not.toHaveBeenCalled();
  });
});
