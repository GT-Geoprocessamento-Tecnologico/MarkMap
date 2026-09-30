import proj4 from 'proj4';
import { PdfError } from './errors.js';
import type { LonLat, PdfAxisOrder, PagePoint } from './types.js';

export const UTM20N_WKT = 'PROJCS["WGS_1984_UTM_Zone_20N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-63.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';
const normalizeWkt = (value: string): string => value.replace(/\s+/g, '');

export type PdfCrs = {
  id: 'EPSG:4326' | 'EPSG:32620';
  axisOrder: PdfAxisOrder;
  unit: 'degree' | 'metre';
  nativeBounds: readonly [number, number, number, number] | null;
  fromPdf(values: readonly [number, number]): PagePoint;
  toWgs84(values: PagePoint): LonLat;
  fromWgs84(values: LonLat): PagePoint;
};

const wgs84: PdfCrs = {
  id: 'EPSG:4326', axisOrder: 'latitude-longitude', unit: 'degree', nativeBounds: null,
  fromPdf: ([latitude, longitude]) => [longitude, latitude],
  toWgs84: ([longitude, latitude]) => [longitude, latitude],
  fromWgs84: ([longitude, latitude]) => [longitude, latitude],
};

const utm20n: PdfCrs = {
  id: 'EPSG:32620', axisOrder: 'easting-northing', unit: 'metre',
  nativeBounds: [166021.4431, 0, 833978.5569, 9328094.0169],
  fromPdf: ([easting, northing]) => [easting, northing],
  toWgs84: ([easting, northing]) => {
    const [longitude, latitude] = proj4('EPSG:32620', 'EPSG:4326', [easting, northing]);
    return [longitude, latitude];
  },
  fromWgs84: ([longitude, latitude]) => {
    const [easting, northing] = proj4('EPSG:4326', 'EPSG:32620', [longitude, latitude]);
    return [easting, northing];
  },
};

// Keep the definition local and deterministic; no runtime EPSG lookup is used.
proj4.defs('EPSG:32620', '+proj=utm +zone=20 +datum=WGS84 +units=m +no_defs');

export function resolveIsoCrs(gcs: { type?: string | undefined; epsg?: number | undefined; wkt?: string | undefined }): PdfCrs {
  if (gcs.type === 'GEOGCS' && gcs.epsg === 4326 && gcs.wkt === undefined) return wgs84;
  if (gcs.type === 'PROJCS' && gcs.wkt !== undefined && normalizeWkt(gcs.wkt) === normalizeWkt(UTM20N_WKT)) return utm20n;
  throw new PdfError('unsupported-crs', 'PDF CRS is outside the P1 allowlist');
}

export function resolveOgcCrs(projectionType: string | undefined, datum: string | undefined): PdfCrs {
  if (projectionType === 'GEOGRAPHIC' && datum === 'WGE') return { ...wgs84, axisOrder: 'longitude-latitude' };
  throw new PdfError('unsupported-crs', 'OGC LGIDict projection is outside the P1 allowlist');
}

export function resolveCrsId(id: string): PdfCrs {
  if (id === 'EPSG:4326') return wgs84;
  if (id === 'EPSG:32620') return utm20n;
  throw new PdfError('unsupported-crs', `CRS ${id} is outside the P1 allowlist`);
}

export function isFiniteNativePoint(point: PagePoint): boolean {
  return point.every((value) => Number.isFinite(value));
}

export function validateNativePoint(crs: PdfCrs, point: PagePoint): void {
  if (!isFiniteNativePoint(point)) throw new PdfError('invalid-control-points', 'Control point is not finite');
  if (crs.id === 'EPSG:4326' && (point[0] <= -180 || point[0] >= 180 || point[1] < -90 || point[1] > 90)) {
    throw new PdfError('invalid-control-points', 'WGS84 control point is outside the supported range');
  }
  if (crs.nativeBounds && (point[0] < crs.nativeBounds[0] || point[0] > crs.nativeBounds[2] || point[1] < crs.nativeBounds[1] || point[1] > crs.nativeBounds[3])) {
    throw new PdfError('invalid-control-points', 'Projected control point is outside the CRS area of use');
  }
  if (crs.id === 'EPSG:32620') {
    const [longitude, latitude] = crs.toWgs84(point);
    if (longitude < -66 || longitude > -60 || latitude < 0 || latitude > 84) throw new PdfError('invalid-control-points', 'Projected control point is outside the EPSG:32620 geographic area of use');
  }
}
