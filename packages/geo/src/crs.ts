import proj4 from 'proj4';

/**
 * Canonical spatial reference identifiers for GeoNexo.
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

/** Register known CRS definitions with proj4. Idempotent. */
export function ensureCrsRegistered(): void {
  if (registered) {
    return;
  }
  proj4.defs(projKey(EPSG_SIRGAS2000), SIRGAS2000_PROJ);
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
