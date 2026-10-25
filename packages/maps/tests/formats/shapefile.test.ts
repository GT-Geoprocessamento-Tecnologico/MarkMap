import { describe, it, expect } from "vitest";
import { parseShapefileZip } from "../../src/formats/shapefile.js";

/** Helper to build a minimal zip containing files without compression (method 0) */
function createSyntheticZip(files: Record<string, Uint8Array>): ArrayBuffer {
  const fileEntries: {
    name: string;
    bytes: Uint8Array;
    offset: number;
    crc: number;
  }[] = [];

  let offset = 0;
  const parts: Uint8Array[] = [];

  function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const b of bytes) {
      crc ^= b;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  for (const [name, bytes] of Object.entries(files)) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(bytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true); // Version
    view.setUint16(6, 0, true); // Flags
    view.setUint16(8, 0, true); // Method: Stored (0)
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true); // Compressed
    view.setUint32(22, bytes.length, true); // Uncompressed
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(bytes);

    fileEntries.push({ name, bytes, offset, crc });
    offset += localHeader.length + bytes.length;
  }

  const centralStart = offset;
  for (const entry of fileEntries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(centralHeader.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true); // Stored
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.bytes.length, true);
    view.setUint32(24, entry.bytes.length, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint32(42, entry.offset, true);
    centralHeader.set(nameBytes, 46);

    parts.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralSize = offset - centralStart;
  const endHeader = new Uint8Array(22);
  const endView = new DataView(endHeader.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, fileEntries.length, true);
  endView.setUint16(10, fileEntries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);
  parts.push(endHeader);

  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const finalZip = new Uint8Array(totalLength);
  let cur = 0;
  for (const p of parts) {
    finalZip.set(p, cur);
    cur += p.length;
  }
  return finalZip.buffer;
}

/** Builds minimal .shp bytes with a single point */
function createPointShp(x: number, y: number): Uint8Array {
  const buffer = new ArrayBuffer(100 + 8 + 20); // 100 bytes header + 28 bytes record
  const view = new DataView(buffer);
  // Header
  view.setInt32(0, 9994, false); // File Code
  view.setInt32(24, buffer.byteLength / 2, false); // File length in 16-bit words
  view.setInt32(28, 1000, true); // Version
  view.setInt32(32, 1, true); // Shape type: Point (1)
  view.setFloat64(36, x, true); // Xmin
  view.setFloat64(44, y, true); // Ymin
  view.setFloat64(52, x, true); // Xmax
  view.setFloat64(60, y, true); // Ymax

  // Record Header
  view.setInt32(100, 1, false); // Record #1
  view.setInt32(104, 10, false); // Content length (20 bytes = 10 words)

  // Record Contents
  view.setInt32(108, 1, true); // Point
  view.setFloat64(112, x, true);
  view.setFloat64(120, y, true);

  return new Uint8Array(buffer);
}

/** Builds minimal .dbf bytes with a name field */
function createDbf(nameValue: string): Uint8Array {
  const headerLen = 32 + 32 + 1; // Base + 1 field + 0x0D terminator
  const recordLen = 1 + 20; // 1 byte delete flag + 20 bytes name
  const buffer = new ArrayBuffer(headerLen + recordLen);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  // DBF Header
  u8[0] = 0x03; // dBASE III
  view.setInt32(4, 1, true); // 1 record
  view.setInt16(8, headerLen, true);
  view.setInt16(10, recordLen, true);

  // Field 1: NAME (Character, 20 bytes)
  const nameBytes = new TextEncoder().encode("NAME");
  u8.set(nameBytes, 32);
  u8[32 + 11] = 0x43; // 'C'
  u8[32 + 16] = 20; // Length: 20

  u8[headerLen - 1] = 0x0d; // Header terminator

  // Record 1
  u8[headerLen] = 0x20; // Space = active record
  const valBytes = new TextEncoder().encode(nameValue.padEnd(20, " "));
  u8.set(valBytes.subarray(0, 20), headerLen + 1);

  return u8;
}

describe("Shapefile Parser", () => {
  it("rejects zip files exceeding 25MB safety limit", async () => {
    const hugeBuffer = new ArrayBuffer(26 * 1024 * 1024);
    await expect(parseShapefileZip(hugeBuffer)).rejects.toThrow(
      "Dataset exceeds maximum allowed size of 25MB",
    );
  });

  it("rejects corrupted or non-zip buffers gracefully", async () => {
    await expect(parseShapefileZip(new ArrayBuffer(4))).rejects.toThrow(
      "Arquivo ZIP inválido ou corrompido",
    );
  });

  it("parses valid synthetic Shapefile zip with .shp, .dbf, and .prj", async () => {
    const shp = createPointShp(-48.2, -7.19);
    const dbf = createDbf("Ponto 01");
    const prj = new TextEncoder().encode(
      'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]',
    );

    const zip = createSyntheticZip({
      "survey.shp": shp,
      "survey.dbf": dbf,
      "survey.prj": prj,
    });

    const result = await parseShapefileZip(zip);
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(1);
    expect(result.features[0]!.geometry).toEqual({
      type: "Point",
      coordinates: [-48.2, -7.19],
    });
    expect(result.features[0]!.properties).toMatchObject({
      NAME: "Ponto 01",
    });
  });

  it("resolves SIRGAS 2000 UTM Zone 23S fallback when EPSG authority header is absent", async () => {
    const shp = createPointShp(500000, 7500000);
    const dbf = createDbf("UTM 23S Point");
    const prj = new TextEncoder().encode('PROJCS["SIRGAS 2000 / UTM zone 23S",GEOGCS["SIRGAS 2000"]]');

    const zip = createSyntheticZip({
      "utm23.shp": shp,
      "utm23.dbf": dbf,
      "utm23.prj": prj,
    });

    const result = await parseShapefileZip(zip);
    expect(result.features).toHaveLength(1);
  });

  it("resolves geographic SAD69 fallback when EPSG authority header is absent", async () => {
    const shp = createPointShp(-48.2, -7.19);
    const dbf = createDbf("SAD69 Point");
    const prj = new TextEncoder().encode('GEOGCS["SAD69",DATUM["South_American_Datum_1969"]]');

    const zip = createSyntheticZip({
      "sad69.shp": shp,
      "sad69.dbf": dbf,
      "sad69.prj": prj,
    });

    const result = await parseShapefileZip(zip);
    expect(result.features).toHaveLength(1);
  });

  it("reprojects Shapefile features when .prj specifies SIRGAS 2000 UTM Zone 22S", async () => {
    // Easting ~ 800,000, Northing ~ 9,200,000 in UTM 22S (Araguaína region)
    const shp = createPointShp(808500, 9204500);
    const dbf = createDbf("Marco Geodésico");
    const prj = new TextEncoder().encode(
      'PROJCS["SIRGAS 2000 / UTM zone 22S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["false_easting",500000.0],PARAMETER["false_northing",10000000.0],PARAMETER["central_meridian",-51.0],PARAMETER["scale_factor",0.9996],PARAMETER["latitude_of_origin",0.0],UNIT["Meter",1.0],AUTHORITY["EPSG","31982"]]',
    );

    const zip = createSyntheticZip({
      "marco.shp": shp,
      "marco.dbf": dbf,
      "marco.prj": prj,
    });

    const result = await parseShapefileZip(zip);
    expect(result.features).toHaveLength(1);
    const coords = (result.features[0]!.geometry as GeoJSON.Point).coordinates;
    // Expected reprojected longitude ~ -48.2 and latitude ~ -7.19
    expect(coords[0]).toBeCloseTo(-48.2, 1);
    expect(coords[1]).toBeCloseTo(-7.19, 1);
    expect(result.features[0]!.properties?.NAME).toBe("Marco Geodésico");
  });
  it("rejects Shapefile without .prj instead of guessing WGS84", async () => {
    const zip = createSyntheticZip({
      "survey.shp": createPointShp(808500, 9204500),
      "survey.dbf": createDbf("Sem CRS"),
    });
    await expect(parseShapefileZip(zip)).rejects.toThrow("sem .prj");
  });

  it("rejects unknown projected coordinate reference systems", async () => {
    const zip = createSyntheticZip({
      "survey.shp": createPointShp(808500, 9204500),
      "survey.prj": new TextEncoder().encode('PROJCS["Sistema local desconhecido",UNIT["Meter",1]]'),
    });
    await expect(parseShapefileZip(zip)).rejects.toThrow("identificar o CRS");
  });

  it("prefers the outer projected EPSG over nested geographic CRS in WKT", async () => {
    const zip = createSyntheticZip({
      "survey.shp": createPointShp(808500, 9204500),
      "survey.prj": new TextEncoder().encode(
        'PROJCS["SIRGAS 2000 / UTM zone 22S",GEOGCS["SIRGAS 2000",AUTHORITY["EPSG","4674"]],PROJECTION["Transverse_Mercator"],AUTHORITY["EPSG","31982"]]',
      ),
    });
    const result = await parseShapefileZip(zip);
    const coords = (result.features[0]!.geometry as GeoJSON.Point).coordinates;
    expect(coords[0]).toBeCloseTo(-48.2, 1);
    expect(coords[1]).toBeCloseTo(-7.19, 1);
  });

  it("rejects unsupported geometry types rather than dropping features", async () => {
    const shp = createPointShp(-48.2, -7.19);
    new DataView(shp.buffer).setInt32(108, 8, true); // MultiPoint unsupported by this parser
    const zip = createSyntheticZip({
      "survey.shp": shp,
      "survey.prj": new TextEncoder().encode('GEOGCS["WGS 84",AUTHORITY["EPSG","4326"]]'),
    });
    await expect(parseShapefileZip(zip)).rejects.toThrow("tipo 8 não suportada");
  });

});
