import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Layer, Feature } from "@geonexo/contracts";
import { listFeatures } from "../../lib/api-client";
import { featureBounds, loadProjectFeatures, matchesFeature } from "./map-data";

vi.mock("../../lib/api-client", () => ({ listFeatures: vi.fn() }));
const layers = [{ id: "layer-a" }, { id: "layer-b" }] as Layer[];
const feature = (id: string): Feature => ({
  id,
  layerId: "layer-a",
  version: 1,
  createdAt: "2026-09-30T00:00:00Z",
  updatedAt: "2026-09-30T00:00:00Z",
  geometry: { type: "Point", coordinates: [-50, -10] },
  properties: { name: "Levantamento" },
});
beforeEach(() => vi.mocked(listFeatures).mockReset());
describe("project map data", () => {
  it("paginates actual features and converts the API envelope to GeoJSON", async () => {
    vi.mocked(listFeatures)
      .mockResolvedValueOnce({ items: [feature("a")], nextCursor: "next" })
      .mockResolvedValueOnce({ items: [feature("b")], nextCursor: null });
    const result = await loadProjectFeatures(
      [layers[0]!],
      new AbortController().signal,
    );
    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toMatchObject({
      type: "Feature",
      layerId: "layer-a",
    });
    expect(listFeatures).toHaveBeenLastCalledWith(
      "layer-a",
      expect.objectContaining({ cursor: "next" }),
    );
    expect(result.truncated).toBe(false);
  });
  it("caps the combined feature count and reports remaining layers", async () => {
    vi.mocked(listFeatures).mockResolvedValue({
      items: [feature("a")],
      nextCursor: null,
    });
    const result = await loadProjectFeatures(
      layers,
      new AbortController().signal,
      1,
    );
    expect(result.features).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(listFeatures).toHaveBeenCalledTimes(1);
  });
  it("rejects repeated cursors instead of requesting endlessly", async () => {
    vi.mocked(listFeatures).mockResolvedValue({
      items: [],
      nextCursor: "same",
    });
    await expect(
      loadProjectFeatures([layers[0]!], new AbortController().signal),
    ).rejects.toThrow("repetiu");
    expect(listFeatures).toHaveBeenCalledTimes(2);
  });
  it("does not publish responses after cancellation", async () => {
    const controller = new AbortController();
    vi.mocked(listFeatures).mockImplementation(async () => {
      controller.abort();
      return { items: [feature("a")], nextCursor: null };
    });
    await expect(
      loadProjectFeatures(layers, controller.signal),
    ).rejects.toThrow();
  });
  it("fits real finite coordinates and filters all source types", () => {
    const item: GeoJSON.Feature = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-70, -20],
          [-45, -5],
        ],
      },
      properties: { name: "Survey" },
    };
    expect(featureBounds([item])).toEqual([
      [-70, -20],
      [-45, -5],
    ]);
    expect(featureBounds([])).toBeNull();
    expect(matchesFeature(item, "survey", "LineString")).toBe(true);
    expect(matchesFeature(item, "survey", "Point")).toBe(false);
  });
});
