import proj4 from "proj4";

/** Canonical definitions for common and Brazilian reference systems */
export const EPSG_WGS84 = 4326;
export const EPSG_WEB_MERCATOR = 3857;
export const EPSG_SIRGAS2000 = 4674;
export const EPSG_SAD69 = 4618;
export const EPSG_CORREGO_ALEGRE = 4225;
export const EPSG_ARATU = 4208;

const BUILTIN_DEFINITIONS: Record<number, string> = {
  [EPSG_WGS84]: "+proj=longlat +datum=WGS84 +no_defs",
  [EPSG_WEB_MERCATOR]:
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs",
  [EPSG_SIRGAS2000]: "+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs",
  [EPSG_SAD69]: "+proj=longlat +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +no_defs",
  [EPSG_CORREGO_ALEGRE]: "+proj=longlat +ellps=intl +towgs84=-206.05,168.28,-3.28,0,0,0,0 +no_defs",
  [EPSG_ARATU]: "+proj=longlat +ellps=intl +towgs84=-154.3,161.7,-10.8,0,0,0,0 +no_defs",
};

// Generate SIRGAS 2000 UTM zones 11S..25S (EPSG 31971..31985)
// EPSG 31978 = Zone 18S, EPSG 31979 = Zone 19S ... EPSG 31982 = Zone 22S, EPSG 31983 = Zone 23S
for (let zone = 11; zone <= 25; zone++) {
  const epsg = 31960 + zone;
  BUILTIN_DEFINITIONS[epsg] =
    `+proj=utm +zone=${zone} +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`;
}

// Generate SAD69 UTM zones 18S..25S (EPSG 29188..29195)
for (let zone = 18; zone <= 25; zone++) {
  const epsg = 29170 + zone; // zone 18 -> 29188, zone 25 -> 29195
  BUILTIN_DEFINITIONS[epsg] =
    `+proj=utm +zone=${zone} +south +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +units=m +no_defs`;
}

// Generate WGS 84 UTM North (32601..32660) and South (32701..32760)
for (let zone = 1; zone <= 60; zone++) {
  BUILTIN_DEFINITIONS[32600 + zone] = `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`;
  BUILTIN_DEFINITIONS[32700 + zone] = `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`;
}

const registeredDefs = new Map<number, string>(Object.entries(BUILTIN_DEFINITIONS).map(([k, v]) => [Number(k), v]));

// Prime proj4 with built-in defs
for (const [epsg, def] of registeredDefs) {
  proj4.defs(`EPSG:${epsg}`, def);
}

/**
 * Extracts numeric EPSG code from various representations:
 * - 4326
 * - "4326"
 * - "EPSG:4326"
 * - "urn:ogc:def:crs:EPSG::4326"
 * - "http://www.opengis.net/def/crs/EPSG/0/4326"
 */
export function parseEpsgCode(input: string | number): number | null {
  if (typeof input === "number") {
    return Number.isInteger(input) && input > 0 ? input : null;
  }
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  const directMatch = trimmed.match(/(?:epsg:?|crs:epsg::?|epsg\/0\/)?(\d+)\b/i);
  if (!directMatch || !directMatch[1]) return null;
  const num = parseInt(directMatch[1], 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Returns definition for an EPSG code or null if not yet registered.
 */
export function getEpsgDefinition(epsg: number | string): string | null {
  const code = parseEpsgCode(epsg);
  if (!code) return null;
  return registeredDefs.get(code) ?? null;
}

/**
 * Dynamically registers a PROJ.4 projection definition for a given EPSG code.
 */
export function registerEpsgDefinition(epsg: number | string, definition: string): void {
  const code = parseEpsgCode(epsg);
  if (!code) throw new TypeError(`Invalid EPSG code: ${epsg}`);
  if (!definition || typeof definition !== "string") throw new TypeError("Invalid projection definition");
  registeredDefs.set(code, definition);
  proj4.defs(`EPSG:${code}`, definition);
}

/**
 * Ensures a projection is registered in proj4. If unknown, attempts standard UTM or fails gracefully.
 */
export function ensureEpsgRegistered(epsg: number | string, customDef?: string): void {
  const code = parseEpsgCode(epsg);
  if (!code) throw new TypeError(`Invalid EPSG code: ${epsg}`);

  if (customDef) {
    registerEpsgDefinition(code, customDef);
    return;
  }

  if (registeredDefs.has(code)) return;

  // Auto-generate standard WGS84 UTM if requested and not present
  if (code >= 32601 && code <= 32660) {
    const zone = code - 32600;
    registerEpsgDefinition(code, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
    return;
  }
  if (code >= 32701 && code <= 32760) {
    const zone = code - 32700;
    registerEpsgDefinition(code, `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`);
    return;
  }

  throw new Error(`EPSG:${code} definition not found. Register it with registerEpsgDefinition(epsg, projDef).`);
}

/**
 * Transforms a single position between two coordinate reference systems.
 * Preserves elevation if present.
 */
export function transformCoordinates(
  coord: readonly number[],
  fromEpsg: number | string,
  toEpsg: number | string,
): [number, number] | [number, number, number] | null {
  const from = parseEpsgCode(fromEpsg);
  const to = parseEpsgCode(toEpsg);
  if (!from || !to) return null;

  if (
    !Array.isArray(coord) ||
    coord.length < 2 ||
    !Number.isFinite(coord[0]) ||
    !Number.isFinite(coord[1])
  ) {
    return null;
  }

  if (from === to) {
    return coord.length > 2 && Number.isFinite(coord[2])
      ? [coord[0]!, coord[1]!, coord[2]!]
      : [coord[0]!, coord[1]!];
  }

  ensureEpsgRegistered(from);
  ensureEpsgRegistered(to);

  const out = proj4(`EPSG:${from}`, `EPSG:${to}`, [coord[0]!, coord[1]!]);
  const x = out[0];
  const y = out[1];
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return coord.length > 2 && Number.isFinite(coord[2])
    ? [x, y, coord[2]!]
    : [x, y];
}

/**
 * Recursively reprojects coordinates inside GeoJSON geometry structures.
 */
function reprojectCoords(
  coords: unknown,
  fromEpsg: number,
  toEpsg: number,
): unknown {
  if (!Array.isArray(coords)) return coords;
  if (
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    const transformed = transformCoordinates(coords as number[], fromEpsg, toEpsg);
    return transformed ?? coords;
  }
  return coords.map((c) => reprojectCoords(c, fromEpsg, toEpsg));
}

/**
 * Reprojects a GeoJSON geometry from one EPSG to another.
 */
export function reprojectGeoJsonGeometry<T extends GeoJSON.Geometry>(
  geometry: T,
  fromEpsg: number | string,
  toEpsg: number | string,
): T {
  const from = parseEpsgCode(fromEpsg);
  const to = parseEpsgCode(toEpsg);
  if (!from || !to || from === to || !geometry) return geometry;

  if (geometry.type === "GeometryCollection") {
    return {
      ...geometry,
      geometries: geometry.geometries.map((g) =>
        reprojectGeoJsonGeometry(g, from, to),
      ),
    } as T;
  }

  return {
    ...geometry,
    coordinates: reprojectCoords(geometry.coordinates, from, to),
  } as T;
}

/**
 * Reprojects an entire GeoJSON FeatureCollection between reference systems.
 */
export function reprojectFeatureCollection(
  collection: GeoJSON.FeatureCollection,
  fromEpsg: number | string,
  toEpsg: number | string,
): GeoJSON.FeatureCollection {
  const from = parseEpsgCode(fromEpsg);
  const to = parseEpsgCode(toEpsg);
  if (!from || !to || from === to || !collection || !Array.isArray(collection.features)) {
    return collection;
  }

  return {
    ...collection,
    features: collection.features.map((feature) => ({
      ...feature,
      geometry: feature.geometry
        ? reprojectGeoJsonGeometry(feature.geometry, from, to)
        : feature.geometry,
    })),
  };
}
