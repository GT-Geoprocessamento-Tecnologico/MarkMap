import { describe, it, expect } from "vitest";
import { convertDatumToSirgas2000, transformGeoJsonToSirgas2000 } from "../../src/crs/datum.js";

describe("Geodetic Datum Transformations (SAD69 / Córrego Alegre -> SIRGAS 2000)", () => {
  it("converts SAD69 coordinate to SIRGAS 2000 accurately", () => {
    const original: [number, number] = [-47.9292, -15.7801]; // Brasília
    const converted = convertDatumToSirgas2000(original, "SAD69");

    expect(converted[0]).toBeLessThan(original[0]); // dx is negative
    expect(converted[1]).toBeGreaterThan(original[1]); // dy is positive
    expect(converted[0]).toBeCloseTo(-47.9298, 3);
    expect(converted[1]).toBeCloseTo(-15.7800, 3);
  });

  it("leaves SIRGAS 2000 and WGS84 coordinates unchanged", () => {
    const original: [number, number] = [-46.6333, -23.5505];
    expect(convertDatumToSirgas2000(original, "SIRGAS2000")).toEqual(original);
    expect(convertDatumToSirgas2000(original, "WGS84")).toEqual(original);
  });

  it("reprojects a GeoJSON FeatureCollection from Córrego Alegre to SIRGAS 2000", () => {
    const featureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Fazenda Primavera" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-48.0, -16.0],
                [-48.0, -16.1],
                [-48.1, -16.1],
                [-48.1, -16.0],
                [-48.0, -16.0],
              ],
            ],
          },
        },
      ],
    };

    const transformed = transformGeoJsonToSirgas2000(featureCollection, "CORREGO_ALEGRE");
    expect(transformed.features[0].geometry.coordinates[0][0][0]).not.toBe(-48.0);
    expect(transformed.features[0].properties.name).toBe("Fazenda Primavera");
  });

  it("throws errors on invalid coordinates or invalid inputs", () => {
    expect(() => convertDatumToSirgas2000([200, 0], "SAD69")).toThrow(RangeError);
    expect(() => convertDatumToSirgas2000([NaN, 0], "SAD69")).toThrow(TypeError);
  });
});
