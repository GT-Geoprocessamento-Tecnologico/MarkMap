import { describe, expect, it } from "vitest";

import { layerSchema } from "../layer.js";

describe("canonical layer contract compatibility", () => {
  it("accepts a valid feature-bearing layer", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      layerSchema.parse({
        id,
        projectId: "00000000-0000-4000-8000-000000000002",
        name: "Points",
        description: null,
        kind: "point",
        geometryType: "Point",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }).id,
    ).toBe(id);
  });

  it("rejects geometry on raster layers", () => {
    expect(() =>
      layerSchema.parse({
        id: "00000000-0000-4000-8000-000000000001",
        projectId: "00000000-0000-4000-8000-000000000002",
        name: "Imagery",
        description: null,
        kind: "raster",
        geometryType: "Point",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });
});
