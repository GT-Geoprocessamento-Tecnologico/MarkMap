import proj4 from 'proj4';
import { PdfError } from './errors.js';
import type { LonLat, PdfAxisOrder, PagePoint } from './types.js';

export const UTM20N_WKT = 'PROJCS["WGS_1984_UTM_Zone_20N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-63.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]';
const normalizeWkt = (value: string): string => value.replace(/\s+/g, '');

export type PdfCrs = {
  id: 'EPSG:4326' | 'EPSG:32620' | 'EPSG:3857';
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

const webMercator: PdfCrs = {
  id: 'EPSG:3857', axisOrder: 'easting-northing', unit: 'metre',
  nativeBounds: [-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244],
  fromPdf: ([easting, northing]) => [easting, northing],
  toWgs84: ([easting, northing]) => {
    const [longitude, latitude] = proj4('EPSG:3857', 'EPSG:4326', [easting, northing]);
    return [longitude, latitude];
  },
  fromWgs84: ([longitude, latitude]) => {
    const [easting, northing] = proj4('EPSG:4326', 'EPSG:3857', [longitude, latitude]);
    return [easting, northing];
  },
};

// Keep the definition local and deterministic; no runtime EPSG lookup is used.
proj4.defs('EPSG:32620', '+proj=utm +zone=20 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs');

export function resolveIsoCrs(gcs: { type?: string | undefined; epsg?: number | undefined; wkt?: string | undefined }): PdfCrs {
  if (gcs.type === 'GEOGCS' && gcs.epsg === 4326 && gcs.wkt === undefined) return wgs84;
  if (gcs.type === 'PROJCS' && gcs.wkt !== undefined && normalizeWkt(gcs.wkt) === normalizeWkt(UTM20N_WKT)) return utm20n;
  // EPSG:3857 aparece pelo código, sem depender do WKT: Equivalent à
  // EPSG:3395 e ao Web Mercator esférico auxiliar do WGS 84.
  if (gcs.type === 'PROJCS' && gcs.epsg === 3857) return webMercator;
  throw new PdfError('unsupported-crs', 'PDF CRS is outside the P1 allowlist');
}

/**
 * Corrige o defeito mais comum de GeoPDF em producción: declarar um CRS
 * projetado em metros e gravar `/GPTS` em graus WGS 84.
 *
 * O `geopdf de araguaina.pdf` ( IBGE/GeoPDF oficial do Brasil) traz
 * `/Type /PROJCS /EPSG 3857`, porém os valores de `/GPTS` são latitude e
 * longitude em graus — por exemplo `-7.1941965, -48.2305910` para Araguaína (TO).
 * Lidos ao pé da letra como metros Web Mercator, os pontos caem no Golfo de
 * Guiné, a ~5.400 km do lugar certo, e o mapa abriria no oceano.
 *
 * A distinção é feita pelos próprios valores: se o CRS declarado é projetado em
 * metros e **todos** os pontos caem dentro da faixa WGS 84 válida, eles não podem
 * ser metros de Web Mercator para um mapa real, e são lidos como graus. Nada é
 * inventado: o PDF continua sendo a fonte, apenas se obedece à convenção que o
 * produtor realmente usou. Se os valores forem coerentes com metros, o CRS
 * declarado é respeitado normalmente.
 */
export function reconcileIsoCrs(crs: PdfCrs, ground: readonly (readonly [number, number])[]): PdfCrs {
  if (crs.unit !== 'metre') return crs;
  if (ground.length === 0) return crs;
  const looksGeographic = ground.every(
    ([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90,
  );
  if (!looksGeographic) return crs;
  // Só corrige CRSs cuja unidade em metros tornaria a leitura em graus
  // numericamente absurda para qualquer carta real.
  if (crs.id === 'EPSG:3857') return wgs84;
  return crs;
}

export function resolveOgcCrs(projectionType: string | undefined, datum: string | undefined): PdfCrs {
  if (projectionType === 'GEOGRAPHIC' && datum === 'WGE') return { ...wgs84, axisOrder: 'longitude-latitude' };
  throw new PdfError('unsupported-crs', 'OGC LGIDict projection is outside the P1 allowlist');
}

export function resolveCrsId(id: string): PdfCrs {
  if (id === 'EPSG:4326') return wgs84;
  if (id === 'EPSG:32620') return utm20n;
  if (id === 'EPSG:3857') return webMercator;
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
  if (crs.id === 'EPSG:3857') {
    const [longitude, latitude] = crs.toWgs84(point);
    if (Math.abs(longitude) > 180 || latitude < -85.06 || latitude > 85.06) throw new PdfError('invalid-control-points', 'Projected control point is outside the Web Mercator area of use');
  }
}
