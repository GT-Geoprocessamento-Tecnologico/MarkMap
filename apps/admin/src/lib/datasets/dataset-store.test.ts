import { describe, expect, it } from "vitest";
import { MAX_DATASET_FEATURES, parseGeoJSON } from "./dataset-store";

const feature = (coordinates: unknown = [0, 0]) => ({
  type: "Feature",
  properties: { name: "local" },
  geometry: { type: "Point", coordinates },
});

const file = (value: unknown, name = "local.geojson") => {
  const text = JSON.stringify(value);
  const result = new File([text], name, { type: "application/geo+json" });
  if (typeof result.text !== "function")
    Object.defineProperty(result, "text", { value: async () => text });
  return result;
};

describe("dataset import validation", () => {
  it("accepts a valid GeoJSON feature collection", async () => {
    const result = await parseGeoJSON(
      file({ type: "FeatureCollection", features: [feature()] }),
    );
    expect(result.featuresCount).toBe(1);
    expect(result.geojson.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [0, 0],
    });
  });

  it("rejects malformed coordinates before local persistence", async () => {
    await expect(
      parseGeoJSON(
        file({ type: "FeatureCollection", features: [feature([181, 0])] }),
      ),
    ).rejects.toThrow("Geometria inválida");
  });

  it("rejects feature collections above the documented cap", async () => {
    const features = Array.from({ length: MAX_DATASET_FEATURES + 1 }, () =>
      feature(),
    );
    await expect(
      parseGeoJSON(file({ type: "FeatureCollection", features })),
    ).rejects.toThrow("10000");
  });

  it("rejects unsupported formats honestly", async () => {
    await expect(parseGeoJSON(file({}, "local.kml"))).rejects.toThrow(
      "Formato não suportado",
    );
  });

  it("rejects a conflicting declared CRS and non-finite feature id", async () => {
    await expect(
      parseGeoJSON(
        file({
          type: "FeatureCollection",
          crs: { name: "EPSG:3857" },
          features: [feature()],
        }),
      ),
    ).rejects.toThrow("CRS");
    await expect(
      parseGeoJSON(
        file({
          type: "FeatureCollection",
          features: [{ ...feature(), id: Number.NaN }],
        }),
      ),
    ).rejects.toThrow("ID inválido");
  });
});
