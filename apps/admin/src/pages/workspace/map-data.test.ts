import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feature, Layer } from "@markmap/contracts";

import { listLocalFeatures } from "../../lib/hooks/features";
import { featureBounds, loadProjectFeatures, matchesFeature, hasPolygonGeometry, hasPointGeometry, shouldDisplayDatasetPoints, filterDatasetFeatures } from "./map-data";

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

  it("preserves exact property name searching semantics of the previous JSON-based matchesFeature implementation", () => {
      const item: GeoJSON.Feature = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [0, 0] },
          properties: { area_ha: 42, active: true, name: "Null area", metadata: { key: "my val" }, uninitialized: null },
      };

      // Values
      expect(matchesFeature(item, "42", "todos")).toBe(true);
      expect(matchesFeature(item, "true", "todos")).toBe(true);
      expect(matchesFeature(item, "null area", "todos")).toBe(true);
      expect(matchesFeature(item, "my val", "todos")).toBe(true);

      // Keys
      expect(matchesFeature(item, "area_ha", "todos")).toBe(true);
      expect(matchesFeature(item, "metadata", "todos")).toBe(true);

      // Non-matches
      expect(matchesFeature(item, "foo", "todos")).toBe(false);
  });

  it("hides dataset points by default when polygon area is present, keeping area demarcations clean", () => {
    const polygonFeature: GeoJSON.Feature = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-48.2, -7.19],
            [-48.2, -7.2],
            [-48.21, -7.2],
            [-48.21, -7.19],
            [-48.2, -7.19],
          ],
        ],
      },
      properties: { name: "Área Demarcada" },
    };
    const vertexPoint: GeoJSON.Feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-48.2, -7.19] },
      properties: { name: "Vértice V-01" },
    };
    const collection = [polygonFeature, vertexPoint];

    expect(hasPolygonGeometry(collection)).toBe(true);
    expect(hasPointGeometry(collection)).toBe(true);

    // Default must be false when polygon is present (points hidden to preserve demarcation view)
    expect(shouldDisplayDatasetPoints(collection)).toBe(false);

    // Filter should omit point features when points are hidden
    const filteredHidden = filterDatasetFeatures(collection, { showPoints: false });
    expect(filteredHidden).toHaveLength(1);
    expect(filteredHidden[0]?.geometry.type).toBe("Polygon");

    // Filter should include points when user explicitly turns them on
    const filteredShown = filterDatasetFeatures(collection, { showPoints: true });
    expect(filteredShown).toHaveLength(2);
  });

  it("shows dataset points by default when dataset has only points or lines without polygons", () => {
    const waypoints: GeoJSON.Feature[] = [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-48.2, -7.19] },
        properties: { name: "Ponto 1" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-48.21, -7.2] },
        properties: { name: "Ponto 2" },
      },
    ];

    expect(hasPolygonGeometry(waypoints)).toBe(false);
    expect(hasPointGeometry(waypoints)).toBe(true);
    // When there are no polygons, points are shown by default
    expect(shouldDisplayDatasetPoints(waypoints)).toBe(true);
    expect(filterDatasetFeatures(waypoints, { showPoints: true })).toHaveLength(2);
  });

});
