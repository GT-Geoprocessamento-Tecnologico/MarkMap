import { describe, it, expect } from "vitest";
import { inspectGeoPackageHeader } from "../../src/formats/geopackage.js";

describe("GeoPackage Header Reader", () => {
  it("validates SQLite / GPKG magic header bytes", async () => {
    const mockSqliteHeader = new TextEncoder().encode("SQLite format 3\0");
    const result = inspectGeoPackageHeader(mockSqliteHeader.buffer);
    expect(result.isValidSqlite).toBe(true);
  });
});
