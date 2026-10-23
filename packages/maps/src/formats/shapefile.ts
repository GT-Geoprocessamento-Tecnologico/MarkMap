import {
  transformCoordinates,
  parseEpsgCode,
  EPSG_WGS84,
} from "../crs/epsg.js";

export const MAX_VECTOR_IMPORT_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const SIG_END = 0x06054b50;

interface ZipEntry {
  name: string;
  offset: number;
  packed: number;
  unpacked: number;
  method: number;
  flags: number;
}

interface ZipFiles {
  shp?: Uint8Array;
  dbf?: Uint8Array;
  shx?: Uint8Array;
  prj?: string;
}

/**
 * Extracts entry files from a zip buffer.
 */
async function unzipShapefileArchive(zipBuffer: ArrayBuffer): Promise<ZipFiles> {
  const bytes = new Uint8Array(zipBuffer);
  if (bytes.length < 22) throw new Error("Arquivo ZIP inválido ou corrompido");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  const decoder = new TextDecoder("utf-8");

  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(i) === SIG_END && i + 22 + u16(i + 20) === bytes.length) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Diretório central do ZIP não encontrado");

  const count = u16(end + 10);
  const size = u32(end + 12);
  const start = u32(end + 16);
  if (start + size !== end) throw new Error("Tabela ZIP corrompida ou formato ZIP64 não suportado");

  let cursor = start;
  let totalUnpacked = 0;
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== SIG_CENTRAL) {
      throw new Error("Entrada do diretório ZIP corrompida");
    }
    const flags = u16(cursor + 8);
    const method = u16(cursor + 10);
    const packed = u32(cursor + 20);
    const unpacked = u32(cursor + 24);
    const nameLength = u16(cursor + 28);
    const extraLength = u16(cursor + 30);
    const commentLength = u16(cursor + 32);
    const offset = u32(cursor + 42);

    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    totalUnpacked += unpacked;
    if (totalUnpacked > MAX_UNCOMPRESSED_BYTES) {
      throw new Error("Arquivo ZIP expandido excede limite de segurança de 64MB");
    }

    entries.push({ name, offset, packed, unpacked, method, flags });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  const result: ZipFiles = {};

  for (const entry of entries) {
    const ext = entry.name.toLowerCase().split(".").pop();
    if (!ext || !["shp", "dbf", "shx", "prj"].includes(ext)) continue;

    const local = entry.offset;
    if (local + 30 > start || u32(local) !== SIG_LOCAL) {
      throw new Error(`Cabeçalho local corrompido para entrada ${entry.name}`);
    }
    const nameLen = u16(local + 26);
    const extraLen = u16(local + 28);
    const dataStart = local + 30 + nameLen + extraLen;
    const compressed = bytes.subarray(dataStart, dataStart + entry.packed);

    let decompressed: Uint8Array;
    if (entry.method === 0) {
      decompressed = compressed;
    } else if (entry.method === 8) {
      // Deflate
      if (typeof DecompressionStream !== "undefined") {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(compressed);
            controller.close();
          },
        }).pipeThrough(new DecompressionStream("deflate-raw"));
        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const total = chunks.reduce((acc, c) => acc + c.length, 0);
        decompressed = new Uint8Array(total);
        let ptr = 0;
        for (const c of chunks) {
          decompressed.set(c, ptr);
          ptr += c.length;
        }
      } else {
        throw new Error("Descompressão Deflate indisponível neste ambiente");
      }
    } else {
      throw new Error(`Método de compressão ZIP ${entry.method} não suportado`);
    }

    if (ext === "shp") result.shp = decompressed;
    else if (ext === "dbf") result.dbf = decompressed;
    else if (ext === "shx") result.shx = decompressed;
    else if (ext === "prj") result.prj = new TextDecoder().decode(decompressed);
  }

  return result;
}

/**
 * Extracts EPSG code from PRJ text or registers WKT definition.
 */
function resolvePrjEpsg(prjText?: string): number {
  const trimmed = prjText?.trim();
  if (!trimmed) {
    throw new Error("Shapefile sem .prj: informe o CRS de origem antes de importar.");
  }

  // For WKT1/WKT2, the outermost EPSG identifier is normally the final one.
  // The first identifier often describes the nested geographic datum, not
  // the projected CRS (e.g. EPSG:4674 inside EPSG:31982).
  const authorities = [...trimmed.matchAll(/\b(?:AUTHORITY|ID)\s*\[\s*["']EPSG["']\s*,\s*["']?(\d+)["']?\s*\]/gi)];
  const outer = authorities[authorities.length - 1];
  if (outer?.[1]) {
    const code = parseEpsgCode(outer[1]);
    if (code) return code;
  }

  if (/SIRGAS.*UTM.*22S/i.test(trimmed)) return 31982;
  if (/SIRGAS.*UTM.*23S/i.test(trimmed)) return 31983;

  // Never treat an unidentified projected coordinate system as latitude/longitude.
  const projected = /\b(?:PROJCS|PROJCRS|PROJECTEDCRS)\b|\bUTM\b|Transverse_Mercator|Mercator/i.test(trimmed);
  if (!projected && /SIRGAS.*2000/i.test(trimmed)) return 4674;
  if (!projected && /SAD.*69/i.test(trimmed)) return 4618;
  if (!projected && /WGS.*84/i.test(trimmed)) return EPSG_WGS84;

  throw new Error("Não foi possível identificar o CRS do arquivo .prj. Importação cancelada para evitar coordenadas incorretas.");
}

/**
 * Parses dBASE (.dbf) binary format records.
 */
function parseDbfRecords(dbfBytes: Uint8Array): Record<string, unknown>[] {
  if (dbfBytes.length < 32) return [];

  const view = new DataView(dbfBytes.buffer, dbfBytes.byteOffset, dbfBytes.byteLength);
  const recordCount = view.getInt32(4, true);
  const headerLen = view.getInt16(8, true);
  const recordLen = view.getInt16(10, true);

  if (recordCount <= 0 || headerLen <= 0 || recordLen <= 0) return [];

  // Parse field descriptors
  const fields: { name: string; type: string; length: number }[] = [];
  const textDecoder = new TextDecoder("utf-8");

  let pos = 32;
  while (pos < headerLen - 1) {
    if (dbfBytes[pos] === 0x0d) break; // Terminating byte
    const nameBytes = dbfBytes.subarray(pos, pos + 11);
    let nullIndex = nameBytes.indexOf(0);
    if (nullIndex < 0) nullIndex = 11;
    const name = textDecoder.decode(nameBytes.subarray(0, nullIndex)).trim();
    const type = String.fromCharCode(dbfBytes[pos + 11]!);
    const length = dbfBytes[pos + 16]!;
    fields.push({ name, type, length });
    pos += 32;
  }

  const records: Record<string, unknown>[] = [];
  let recordPos = headerLen;

  for (let r = 0; r < recordCount && recordPos + recordLen <= dbfBytes.length; r++) {
    const deletionFlag = dbfBytes[recordPos];
    if (deletionFlag === 0x2a) {
      // Record is marked as deleted (*)
      recordPos += recordLen;
      continue;
    }

    const row: Record<string, unknown> = {};
    let colPos = recordPos + 1; // Skip deletion flag byte

    for (const field of fields) {
      const rawText = textDecoder
        .decode(dbfBytes.subarray(colPos, colPos + field.length))
        .trim();

      if (field.type === "N" || field.type === "F") {
        const num = parseFloat(rawText);
        row[field.name] = Number.isFinite(num) ? num : null;
      } else if (field.type === "L") {
        row[field.name] = /^[yt1]/i.test(rawText);
      } else {
        row[field.name] = rawText;
      }
      colPos += field.length;
    }

    records.push(row);
    recordPos += recordLen;
  }

  return records;
}

/**
 * Parses ESRI Shapefile (.shp) binary buffer and converts to GeoJSON Features.
 */
function parseShpGeometries(
  shpBytes: Uint8Array,
  sourceEpsg: number,
): (GeoJSON.Geometry | null)[] {
  if (shpBytes.length < 100) throw new Error("Arquivo .shp menor que o cabeçalho mínimo de 100 bytes");

  const view = new DataView(shpBytes.buffer, shpBytes.byteOffset, shpBytes.byteLength);
  const fileCode = view.getInt32(0, false); // Big endian 9994
  if (fileCode !== 9994) throw new Error("Código mágico de Shapefile inválido");

  const geometries: (GeoJSON.Geometry | null)[] = [];
  let offset = 100;

  while (offset + 8 <= shpBytes.length) {
    const recordLengthWords = view.getInt32(offset + 4, false); // 16-bit words (big endian)
    const recordLengthBytes = recordLengthWords * 2;
    const contentOffset = offset + 8;
    offset += 8 + recordLengthBytes;

    if (contentOffset + 4 > shpBytes.length) break;

    const shapeType = view.getInt32(contentOffset, true); // Little endian

    if (shapeType === 0) {
      // Null shape
      geometries.push(null);
      continue;
    }

    if (shapeType === 1 || shapeType === 11 || shapeType === 21) {
      // Point (or PointZ/PointM)
      const x = view.getFloat64(contentOffset + 4, true);
      const y = view.getFloat64(contentOffset + 12, true);
      const pt = transformCoordinates([x, y], sourceEpsg, EPSG_WGS84);
      if (!pt) throw new Error("Não foi possível reprojetar um ponto do Shapefile.");
      geometries.push({ type: "Point", coordinates: [pt[0], pt[1]] });
      continue;
    }

    if (shapeType === 3 || shapeType === 13 || shapeType === 23) {
      // PolyLine
      const numParts = view.getInt32(contentOffset + 36, true);
      const numPoints = view.getInt32(contentOffset + 40, true);
      const parts: number[] = [];
      let ptr = contentOffset + 44;
      for (let p = 0; p < numParts; p++) {
        parts.push(view.getInt32(ptr, true));
        ptr += 4;
      }
      const lines: [number, number][][] = [];
      for (let p = 0; p < numParts; p++) {
        const start = parts[p]!;
        const end = p < numParts - 1 ? parts[p + 1]! : numPoints;
        const line: [number, number][] = [];
        for (let ptIdx = start; ptIdx < end; ptIdx++) {
          const ptOffset = ptr + ptIdx * 16;
          const x = view.getFloat64(ptOffset, true);
          const y = view.getFloat64(ptOffset + 8, true);
          const transformed = transformCoordinates([x, y], sourceEpsg, EPSG_WGS84);
          if (!transformed) throw new Error("Não foi possível reprojetar uma linha do Shapefile.");
          line.push([transformed[0], transformed[1]]);
        }
        if (line.length >= 2) lines.push(line);
      }
      if (lines.length === 1) {
        geometries.push({ type: "LineString", coordinates: lines[0]! });
      } else if (lines.length > 1) {
        geometries.push({ type: "MultiLineString", coordinates: lines });
      } else {
        geometries.push(null);
      }
      continue;
    }

    if (shapeType === 5 || shapeType === 15 || shapeType === 25) {
      // Polygon
      const numParts = view.getInt32(contentOffset + 36, true);
      const numPoints = view.getInt32(contentOffset + 40, true);
      const parts: number[] = [];
      let ptr = contentOffset + 44;
      for (let p = 0; p < numParts; p++) {
        parts.push(view.getInt32(ptr, true));
        ptr += 4;
      }
      const rings: [number, number][][] = [];
      for (let p = 0; p < numParts; p++) {
        const start = parts[p]!;
        const end = p < numParts - 1 ? parts[p + 1]! : numPoints;
        const ring: [number, number][] = [];
        for (let ptIdx = start; ptIdx < end; ptIdx++) {
          const ptOffset = ptr + ptIdx * 16;
          const x = view.getFloat64(ptOffset, true);
          const y = view.getFloat64(ptOffset + 8, true);
          const transformed = transformCoordinates([x, y], sourceEpsg, EPSG_WGS84);
          if (!transformed) throw new Error("Não foi possível reprojetar um polígono do Shapefile.");
          ring.push([transformed[0], transformed[1]]);
        }
        if (ring.length >= 4) rings.push(ring);
      }
      if (rings.length > 0) {
        geometries.push({ type: "Polygon", coordinates: rings });
      } else {
        geometries.push(null);
      }
      continue;
    }

    // Unsupported types must not disappear silently from imported datasets.
    throw new Error(`Geometria Shapefile de tipo ${shapeType} não suportada. Importação cancelada.`);
  }

  return geometries;
}

/**
 * Parses a zipped Shapefile (.zip) containing .shp, .dbf, and optional .prj.
 * Returns normalized GeoJSON FeatureCollection in WGS 84.
 */
export async function parseShapefileZip(zipBuffer: ArrayBuffer): Promise<GeoJSON.FeatureCollection> {
  if (zipBuffer.byteLength > MAX_VECTOR_IMPORT_BYTES) {
    throw new Error(
      `Dataset exceeds maximum allowed size of 25MB (${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`,
    );
  }

  const files = await unzipShapefileArchive(zipBuffer);

  if (!files.shp) {
    throw new Error("Shapefile ZIP inválido: arquivo .shp não encontrado");
  }

  const sourceEpsg = resolvePrjEpsg(files.prj);
  const geometries = parseShpGeometries(files.shp, sourceEpsg);
  const records = files.dbf ? parseDbfRecords(files.dbf) : [];

  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i];
    if (!geometry) continue;

    features.push({
      type: "Feature",
      id: `shp-${i + 1}`,
      geometry,
      properties: records[i] ?? {},
    });
  }

  if (!features.length) {
    throw new Error("O Shapefile não contém feições importáveis; nenhum dado foi salvo.");
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
