import proj4 from 'proj4';

/**
 * Canonical spatial reference identifiers for MarkMap.
 *
 * - Storage (PostGIS): EPSG:4674 (SIRGAS 2000), per 00-MASTER-PRD section 9.
 * - Browser / GeoJSON transport: EPSG:4326 (WGS 84), per web interoperability.
 *
 * No component may create PROJ strings inline; every transform goes through
 * this module.
 */

export const EPSG_WGS84 = 4326;
export const EPSG_SIRGAS2000 = 4674;

/** SRID used for canonical storage in PostGIS. */
export const SRID_CANONICAL = EPSG_SIRGAS2000;

/** CRS used for GeoJSON exchanged with the browser. */
export const CRS_TRANSPORT = EPSG_WGS84;

/** PROJ definition for SIRGAS 2000 (GRS 80 ellipsoid, zero Bursa-Wolf shift). */
export const SIRGAS2000_PROJ =
  '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs';

export type LngLat = [number, number];

function projKey(epsg: number): string {
  return `EPSG:${epsg}`;
}

let registered = false;

/**
 * SIRGAS 2000 / UTM zones 11S..23S, EPSG:31978..31990.
 *
 * These are the projections a Brazilian field survey actually receives, so they
 * are generated rather than listed: a file in UTM 22S must not be rejected just
 * because the zone was not hardcoded.
 */
const sirgasUtmSouth = (zone: number): string =>
  `+proj=utm +zone=${zone} +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs`;

/** EPSG code of SIRGAS 2000 / UTM zone N S, or null when outside 11S..23S. */
export function sirgasUtmSouthEpsg(zone: number): number | null {
  if (!Number.isInteger(zone) || zone < 11 || zone > 23) return null;
  return 31978 + (zone - 11);
}

const reprojectable: Record<number, string> = {
  [EPSG_WGS84]: '+proj=longlat +datum=WGS84 +no_defs',
  3857: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs',
  [EPSG_SIRGAS2000]: SIRGAS2000_PROJ,
  4618: '+proj=longlat +ellps=aust_SA +towgs84=-66.87,4.37,-38.52,0,0,0,0 +no_defs',
};
for (let zone = 11; zone <= 23; zone += 1) {
  const epsg = sirgasUtmSouthEpsg(zone);
  if (epsg !== null) reprojectable[epsg] = sirgasUtmSouth(zone);
}

/** PROJ definitions for every CRS the application can reproject from. */
export const REPROJECTABLE_PROJ: Readonly<Record<number, string>> = reprojectable;

/** Register known CRS definitions with proj4. Idempotent. */
export function ensureCrsRegistered(): void {
  if (registered) {
    return;
  }
  for (const [epsg, definition] of Object.entries(REPROJECTABLE_PROJ)) {
    proj4.defs(projKey(Number(epsg)), definition);
  }
  registered = true;
}

/**
 * Transform a [lng, lat] position between two EPSG codes.
 * Returns null when the input is not a finite pair.
 */
export function transformPosition(
  position: readonly number[],
  fromEpsg: number,
  toEpsg: number,
): LngLat | null {
  const lng = position[0];
  const lat = position[1];
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    return null;
  }
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  if (fromEpsg === toEpsg) {
    return [lng, lat];
  }
  ensureCrsRegistered();
  const out = proj4(projKey(fromEpsg), projKey(toEpsg), [lng, lat]);
  const x = out[0];
  const y = out[1];
  if (typeof x !== 'number' || typeof y !== 'number') {
    return null;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return [x, y];
}

/** WGS 84 (browser) -> SIRGAS 2000 (canonical storage). */
export function wgs84ToSirgas2000(position: readonly number[]): LngLat | null {
  return transformPosition(position, EPSG_WGS84, EPSG_SIRGAS2000);
}

/** SIRGAS 2000 (canonical storage) -> WGS 84 (browser). */
export function sirgas2000ToWgs84(position: readonly number[]): LngLat | null {
  return transformPosition(position, EPSG_SIRGAS2000, EPSG_WGS84);
}

/** Normalize any known input CRS position to canonical storage CRS. */
export function toCanonical(
  position: readonly number[],
  fromEpsg: number,
): LngLat | null {
  return transformPosition(position, fromEpsg, SRID_CANONICAL);
}

/** True when the EPSG code is one of the CRS supported by GeoNexo. */
export function isSupportedEpsg(epsg: number): boolean {
  return epsg === EPSG_WGS84 || epsg === EPSG_SIRGAS2000;
}

/** True when GeoNexo can actually reproject coordinates from this EPSG code. */
export function isReprojectableEpsg(epsg: number): boolean {
  return Object.prototype.hasOwnProperty.call(REPROJECTABLE_PROJ, epsg);
}

/**
 * Extract the EPSG code from a GeoJSON `crs` member.
 *
 * Accepts the shapes seen in the wild: `urn:ogc:def:crs:EPSG::31983`,
 * `EPSG:31983` and the legacy `{ type: "name", properties: { name: "urn:...::31983" } }`.
 * Returns null when no EPSG code can be read, which callers treat as WGS 84.
 */
export function parseGeoJsonCrsEpsg(crs: unknown): number | null {
  if (crs === undefined || crs === null) return null;
  if (typeof crs === 'string' || typeof crs === 'number') {
    return readEpsgCode(String(crs));
  }
  if (typeof crs !== 'object') return null;
  const container = crs as { name?: unknown; properties?: unknown };
  for (const candidate of [container.properties, container]) {
    if (!candidate || typeof candidate !== 'object') continue;
    const name = (candidate as { name?: unknown }).name;
    if (typeof name === 'string' || typeof name === 'number') {
      const code = readEpsgCode(String(name));
      if (code !== null) return code;
    }
  }
  return null;
}

function readEpsgCode(value: string): number | null {
  const match = /(?:^|[^0-9])(\d{4,6})\s*$/.exec(value.trim());
  if (!match?.[1]) return null;
  const code = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(code) && code > 0 ? code : null;
}
