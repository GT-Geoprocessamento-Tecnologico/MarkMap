import { LayerNotFoundError, ProjectNotFoundError } from "@geonexo/db";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProject: vi.fn(),
  getLayer: vi.fn(),
  listLayers: vi.fn(),
  createLayer: vi.fn(),
  listFeatures: vi.fn(),
  createFeature: vi.fn(),
  getDb: vi.fn(() => ({})),
}));

vi.mock("@geonexo/db", async () => ({
  ...(await vi.importActual<typeof import("@geonexo/db")>("@geonexo/db")),
  ...mocks,
}));

import { featureRoutes } from "../src/routes/features.js";
import { layerRoutes } from "../src/routes/layers.js";
import { projectRoutes } from "../src/routes/projects.js";

const projectId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const layerId = "3f2504e0-4f89-41d3-9a0c-0305e82c3302";
const featureId = "3f2504e0-4f89-41d3-9a0c-0305e82c3303";
const project = {
  id: projectId,
  name: "Survey",
  description: null,
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};
const layer = {
  id: layerId,
  projectId,
  name: "Parcels",
  description: null,
  kind: "polygon",
  geometryType: "Polygon",
  srid: 4674,
  style: {},
  metadata: {},
  visibleByDefault: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};
const feature = {
  id: featureId,
  layerId,
  geometry: { type: "Point", coordinates: [-46.6, -23.5] },
  properties: {},
  version: 1,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function routeApp() {
  const app = new Hono();
  app.onError((error, c) => {
    if (error instanceof ProjectNotFoundError)
      return c.json({ error: { code: error.code } }, 404);
    if (error instanceof LayerNotFoundError)
      return c.json({ error: { code: error.code } }, 404);
    return c.json({ error: { code: "VALIDATION_ERROR" } }, 400);
  });
  projectRoutes(app);
  layerRoutes(app);
  featureRoutes(app);
  return app;
}

describe("nested project, layer, and feature routes", () => {
  it("returns an active project and maps missing/deleted projects to 404", async () => {
    mocks.getProject.mockResolvedValueOnce(project).mockResolvedValueOnce(null);
    const app = routeApp();
    const active = await app.request(`/projects/${projectId}`);
    expect(active.status).toBe(200);
    expect((await active.json()).createdAt).toBe("2026-01-01T00:00:00.000Z");
    const missing = await app.request(`/projects/${projectId}`);
    expect(missing.status).toBe(404);
  });

  it("uses path project ID for nested layer create/list and rejects conflicting body IDs", async () => {
    mocks.listLayers.mockResolvedValue({ items: [layer], nextCursor: null });
    mocks.createLayer.mockResolvedValue(layer);
    const app = routeApp();
    const listed = await app.request(`/projects/${projectId}/layers?limit=1`);
    expect(listed.status).toBe(200);
    expect(mocks.listLayers).toHaveBeenCalledWith({}, { projectId, limit: 1 });
    const created = await app.request(`/projects/${projectId}/layers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Parcels",
        kind: "polygon",
        geometryType: "Polygon",
      }),
    });
    expect(created.status).toBe(201);
    expect(mocks.createLayer).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ projectId }),
    );
    const conflict = await app.request(`/projects/${projectId}/layers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: layerId,
        name: "Wrong",
        kind: "polygon",
      }),
    });
    expect(conflict.status).toBe(400);
  });

  it("reads nested layers and creates/lists features with authoritative path IDs", async () => {
    mocks.getLayer.mockResolvedValue(layer);
    mocks.listFeatures.mockResolvedValue({
      items: [feature],
      nextCursor: null,
    });
    mocks.createFeature.mockResolvedValue(feature);
    const app = routeApp();
    expect((await app.request(`/layers/${layerId}`)).status).toBe(200);
    const listed = await app.request(
      `/layers/${layerId}/features?limit=2&bbox=-47,-24,-46,-23`,
    );
    expect(listed.status).toBe(200);
    expect(mocks.listFeatures).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ layerId, limit: 2 }),
    );
    const created = await app.request(`/layers/${layerId}/features`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ geometry: feature.geometry, properties: {} }),
    });
    expect(created.status).toBe(201);
    const conflict = await app.request(`/layers/${layerId}/features`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ layerId: projectId, geometry: feature.geometry }),
    });
    expect(conflict.status).toBe(400);
  });
});
