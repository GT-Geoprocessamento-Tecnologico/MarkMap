import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feature, Layer } from "@geonexo/contracts";

import { listLocalFeatures } from "../../lib/hooks/features";
import { featureBounds, loadProjectFeatures, matchesFeature } from "./map-data";

vi.mock("../../lib/hooks/features", () => ({
  listLocalFeatures: vi.fn(),
}));

const layers = [{ id: "layer-a" }, { id: "layer-b" }] as Layer[];
const feature = (id: string, layerId = "layer-a"): Feature => ({
  id,
  layerId,
  version: 1,
  createdAt: "2026-09-30T00:00:00Z",
  updatedAt: "2026-09-30T00:00:00Z",
  geometry: { type: "Point", coordinates: [-50, -10] },
  properties: { name: "Levantamento" },
});

beforeEach(() => vi.mocked(listLocalFeatures).mockReset());

describe("project map data", () => {
  it("loads local-first features and converts them to GeoJSON", async () => {
    vi.mocked(listLocalFeatures).mockResolvedValue([
      feature("a"),
      feature("b"),
    ]);

    const result = await loadProjectFeatures(
      [layers[0]!],
      new AbortController().signal,
    );

    expect(result.features).toHaveLength(2);
    expect(result.features[0]).toMatchObject({
      type: "Feature",
      layerId: "layer-a",
    });
    expect(listLocalFeatures).toHaveBeenCalledWith("layer-a");
    expect(result.truncated).toBe(false);
  });

  it("caps the combined feature count and reports remaining layers", async () => {
    vi.mocked(listLocalFeatures).mockResolvedValue([feature("a")]);

    const result = await loadProjectFeatures(
      layers,
      new AbortController().signal,
      1,
    );

    expect(result.features).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(listLocalFeatures).toHaveBeenCalledTimes(1);
  });

  it("loads each layer once when below the cap", async () => {
    vi.mocked(listLocalFeatures)
      .mockResolvedValueOnce([feature("a", "layer-a")])
      .mockResolvedValueOnce([feature("b", "layer-b")]);

    const result = await loadProjectFeatures(
      layers,
      new AbortController().signal,
    );

    expect(result.features.map((item) => item.layerId)).toEqual([
      "layer-a",
      "layer-b",
    ]);
    expect(listLocalFeatures).toHaveBeenCalledTimes(2);
  });

  it("does not publish responses after cancellation", async () => {
    const controller = new AbortController();
    vi.mocked(listLocalFeatures).mockImplementation(async () => {
      controller.abort();
      return [feature("a")];
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
