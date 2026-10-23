import { describe, it, expect } from "vitest";
import {
  inspectGeoPackageHeader,
  parseGpkgGeometry,
  parseWkb,
  parseGeoPackageBuffer,
  MAX_GPKG_IMPORT_BYTES,
} from "../../src/formats/geopackage.js";
import { inspectVectorDatasetAsset } from "../../src/offline/package.js";

/** Helper to create synthetic GPKG Binary Geometry */
function createSyntheticGpkgPoint(x: number, y: number, srsId = 4326): Uint8Array {
  // GPKG Binary Header:
  // [0..1]: 0x47 0x50 ('GP')
  // [2]: 0 (version)
  // [3]: flags (0x01 = little endian, no envelope)
  // [4..7]: srs_id (int32 little endian)
  // WKB Point:
  // [8]: 0x01 (little endian)
  // [9..12]: 1 (WKB Point type, little endian)
  // [13..20]: x (double little endian)
  // [21..28]: y (double little endian)
  const buffer = new ArrayBuffer(8 + 21);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  u8[0] = 0x47;
  u8[1] = 0x50;
  u8[2] = 0;
  u8[3] = 0x01; // little endian, no envelope
  view.setInt32(4, srsId, true);

  // WKB
  u8[8] = 0x01; // little endian
  view.setUint32(9, 1, true); // Point
  view.setFloat64(13, x, true);
  view.setFloat64(21, y, true);

  return u8;
}

describe("GeoPackage Reader & WKB Geometry Parser", () => {
  it("validates SQLite and detects OGC GeoPackage application id", () => {
    const buffer = new ArrayBuffer(100);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // SQLite header
    const sqliteMagic = new TextEncoder().encode("SQLite format 3\0");
    u8.set(sqliteMagic, 0);

    // GPKG Application ID at byte 68: 0x47504B47 ("GPKG")
    view.setUint32(68, 0x47504b47, false);

    const result = inspectGeoPackageHeader(buffer);
    expect(result.isValidSqlite).toBe(true);
    expect(result.isGeoPackage).toBe(true);
  });

  it("rejects non-sqlite buffers gracefully", () => {
    const invalid = new TextEncoder().encode("NOT AN SQLITE FILE").buffer;
    expect(inspectGeoPackageHeader(invalid).isValidSqlite).toBe(false);
  });

  it("parses GeoPackage binary geometry points into GeoJSON WGS 84", () => {
    const gpkgGeom = createSyntheticGpkgPoint(-48.2, -7.19, 4326);
    const parsed = parseGpkgGeometry(gpkgGeom);

    expect(parsed).toEqual({
      type: "Point",
      coordinates: [-48.2, -7.19],
    });
  });

  it("reprojects GeoPackage binary geometry when SRS is SIRGAS 2000 UTM Zone 22S", () => {
    // Easting 808500, Northing 9204500 in Zone 22S
    const gpkgUtmGeom = createSyntheticGpkgPoint(808500, 9204500, 31982);
    const parsed = parseGpkgGeometry(gpkgUtmGeom);

    expect(parsed).not.toBeNull();
    expect(parsed!.type).toBe("Point");
    const coords = (parsed as GeoJSON.Point).coordinates;
    expect(coords[0]).toBeCloseTo(-48.2, 1);
    expect(coords[1]).toBeCloseTo(-7.19, 1);
  });

  it("rejects files exceeding 25MB safety quota", async () => {
    const hugeBuffer = new ArrayBuffer(26 * 1024 * 1024);
    await expect(parseGeoPackageBuffer(hugeBuffer)).rejects.toThrow("25MB");
  });

  it("integrates with offline package asset inspection", async () => {
    const sqliteHeader = new TextEncoder().encode("SQLite format 3\0");
    const inspection = await inspectVectorDatasetAsset(sqliteHeader.buffer);
    expect(inspection.ok).toBe(true);
    expect(inspection.format).toBe("geopackage");
  });
});
