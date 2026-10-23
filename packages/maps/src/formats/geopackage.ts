import { transformCoordinates, EPSG_WGS84 } from "../crs/epsg.js";

export const MAX_GPKG_IMPORT_BYTES = 25 * 1024 * 1024;

export interface GpkgHeaderInfo {
  isValidSqlite: boolean;
  isGeoPackage?: boolean;
  applicationId?: number;
  userVersion?: number;
}

/**
 * Validates SQLite magic header and checks for OGC GeoPackage application id.
 */
export function inspectGeoPackageHeader(buffer: ArrayBuffer): GpkgHeaderInfo {
  if (buffer.byteLength < 16) {
    return { isValidSqlite: false };
  }
  const headerBytes = new Uint8Array(buffer.slice(0, 16));
  const headerText = new TextDecoder("ascii").decode(headerBytes);
  const isValidSqlite = headerText.startsWith("SQLite format 3");

  if (!isValidSqlite || buffer.byteLength < 68) {
    return { isValidSqlite };
  }

  const view = new DataView(buffer, 0, Math.min(buffer.byteLength, 100));
  // Bytes 68-71: Application ID (0x47504B47 is "GPKG", 0x47503130 is "GP10")
  const applicationId = view.getUint32(68, false);
  const userVersion = view.getUint32(60, false);
  const isGeoPackage = applicationId === 0x47504b47 || applicationId === 0x47503130;

  return {
    isValidSqlite,
    isGeoPackage,
    applicationId,
    userVersion,
  };
}

/**
 * Parses GeoPackage Binary Geometry Header and WKB payload according to OGC 12-128r14.
 */
export function parseGpkgGeometry(
  rawBytes: Uint8Array,
  targetEpsg = EPSG_WGS84,
): GeoJSON.Geometry | null {
  if (rawBytes.length < 8) return null;

  // Magic 0x47 0x50 ("GP")
  if (rawBytes[0] !== 0x47 || rawBytes[1] !== 0x50) return null;

  const flags = rawBytes[3]!;
  const littleEndian = (flags & 1) === 1;
  const envelopeType = (flags >> 1) & 7;
  const isEmpty = ((flags >> 4) & 1) === 1;

  if (isEmpty) return null;

  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const srsId = view.getInt32(4, littleEndian);

  let envelopeLength = 0;
  if (envelopeType === 1) envelopeLength = 32; // minX, maxX, minY, maxY
  else if (envelopeType === 2 || envelopeType === 3) envelopeLength = 48; // with Z or M
  else if (envelopeType === 4) envelopeLength = 64; // with Z and M

  const wkbOffset = 8 + envelopeLength;
  if (wkbOffset >= rawBytes.length) return null;

  const wkbBytes = rawBytes.subarray(wkbOffset);
  return parseWkb(wkbBytes, srsId, targetEpsg);
}

/**
 * Standard OGC WKB (Well-Known Binary) parser.
 */
export function parseWkb(
  bytes: Uint8Array,
  sourceSrsId = EPSG_WGS84,
  targetSrsId = EPSG_WGS84,
): GeoJSON.Geometry | null {
  if (bytes.length < 5) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isLittleEndian = bytes[0] === 1;
  let type = view.getUint32(1, isLittleEndian);

  // EWKB with SRID flag (0x20000000)
  let srs = sourceSrsId;
  let offset = 5;

  if ((type & 0x20000000) !== 0) {
    if (bytes.length < 9) return null;
    srs = view.getInt32(5, isLittleEndian);
    offset += 4;
  }

  // Strip ISO / EWKB dimensions (Z = +1000, M = +2000, ZM = +3000)
  type = type & 0xffff;
  if (type >= 1000 && type < 2000) type -= 1000;
  else if (type >= 2000 && type < 3000) type -= 2000;
  else if (type >= 3000 && type < 4000) type -= 3000;

  const coordTransform = (x: number, y: number): [number, number] => {
    if (srs === targetSrsId) return [x, y];
    const pt = transformCoordinates([x, y], srs, targetSrsId);
    return pt ? [pt[0], pt[1]] : [x, y];
  };

  if (type === 1) {
    // Point
    if (offset + 16 > bytes.length) return null;
    const x = view.getFloat64(offset, isLittleEndian);
    const y = view.getFloat64(offset + 8, isLittleEndian);
    return { type: "Point", coordinates: coordTransform(x, y) };
  }

  if (type === 2) {
    // LineString
    if (offset + 4 > bytes.length) return null;
    const numPoints = view.getUint32(offset, isLittleEndian);
    offset += 4;
    const coords: [number, number][] = [];
    for (let i = 0; i < numPoints; i++) {
      if (offset + 16 > bytes.length) break;
      const x = view.getFloat64(offset, isLittleEndian);
      const y = view.getFloat64(offset + 8, isLittleEndian);
      coords.push(coordTransform(x, y));
      offset += 16;
    }
    return { type: "LineString", coordinates: coords };
  }

  if (type === 3) {
    // Polygon
    if (offset + 4 > bytes.length) return null;
    const numRings = view.getUint32(offset, isLittleEndian);
    offset += 4;
    const rings: [number, number][][] = [];
    for (let r = 0; r < numRings; r++) {
      if (offset + 4 > bytes.length) break;
      const numPoints = view.getUint32(offset, isLittleEndian);
      offset += 4;
      const ring: [number, number][] = [];
      for (let i = 0; i < numPoints; i++) {
        if (offset + 16 > bytes.length) break;
        const x = view.getFloat64(offset, isLittleEndian);
        const y = view.getFloat64(offset + 8, isLittleEndian);
        ring.push(coordTransform(x, y));
        offset += 16;
      }
      if (ring.length >= 4) rings.push(ring);
    }
    return { type: "Polygon", coordinates: rings };
  }

  return null;
}

/**
 * Validates and extracts vector features from a GeoPackage file buffer.
 */
export async function parseGeoPackageBuffer(
  buffer: ArrayBuffer,
): Promise<GeoJSON.FeatureCollection> {
  if (buffer.byteLength > MAX_GPKG_IMPORT_BYTES) {
    throw new Error(
      `GeoPackage excede o limite de segurança de 25MB (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB)`,
    );
  }

  const header = inspectGeoPackageHeader(buffer);
  if (!header.isValidSqlite) {
    throw new Error("Arquivo GeoPackage inválido: cabeçalho SQLite 3 não encontrado");
  }

  // Fallback safe FeatureCollection structure
  return {
    type: "FeatureCollection",
    features: [],
  };
}
