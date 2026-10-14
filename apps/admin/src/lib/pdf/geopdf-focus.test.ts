import { describe, expect, it } from "vitest";
import { evaluateGeoPdfGps, describeGeoPdfGps } from "./geopdf-focus.mjs";

const corners = [
  [-48.24, -7.18], [-48.20, -7.18],
  [-48.20, -7.22], [-48.24, -7.22],
] as const;

describe("GPS alignment within georeferenced GeoPDF footprint", () => {
  it("focuses on a fresh precise point that lies within the real raster", () => {
    expect(evaluateGeoPdfGps({ lon: -48.22, lat: -7.20, accuracyM: 12 }, corners))
      .toEqual({ status: "inside", center: [-48.22, -7.20], accuracyM: 12 });
  });
  it("refuses kilometre-level desktop Wi-Fi/IP coordinates", () => {
    const result = evaluateGeoPdfGps({ lon: -48.22, lat: -7.20, accuracyM: 3200 }, corners);
    expect(result).toEqual({ status: "imprecise", accuracyM: 3200 });
    expect(describeGeoPdfGps(result)).toMatch(/GPS aproximado.*3200 m/);
  });
  it("does not move the PDF to a reliable point outside its actual coverage", () => {
    expect(evaluateGeoPdfGps({ lon: -48.19, lat: -7.20, accuracyM: 6 }, corners))
      .toEqual({ status: "outside", accuracyM: 6 });
  });
  it("uses the true quadrilateral, not only an axis-aligned bounding box", () => {
    const rotated = [[0, 2], [2, 3], [4, 2], [2, 1]] as const;
    expect(evaluateGeoPdfGps({ lon: 0.1, lat: 1, accuracyM: 5 }, rotated).status)
      .toBe("outside");
  });
  it("accepts boundary locations but rejects invalid fixes", () => {
    expect(evaluateGeoPdfGps({ lon: -48.24, lat: -7.2, accuracyM: 8 }, corners).status).toBe("inside");
    expect(evaluateGeoPdfGps({ lon: NaN, lat: -7.2, accuracyM: 8 }, corners).status).toBe("unavailable");
    expect(evaluateGeoPdfGps({ lon: -48.22, lat: -7.2, accuracyM: NaN }, corners).status).toBe("unavailable");
  });
});
