import { inspectPdf } from "@markmap/geo/pdf";
import { utmToWgs84 } from "../crs/utm.js";

export interface GeoPdfMetadata {
  isGeoreferenced: boolean;
  epsgCode?: number;
  wkt?: string;
  bbox?: [number, number, number, number];
  neatline?: Array<[number, number]>;
  scaleDenominator?: number;
}
function toWgs84(point: readonly [number, number], epsgCode: number | undefined): [number, number] | null {
  if (epsgCode === 4326) return [point[0], point[1]];
  if (epsgCode === 32620) {
    const converted = utmToWgs84({ easting: point[0], northing: point[1], zone: 20, hemisphere: "N" });
    return [converted.longitude, converted.latitude];
  }
  if (epsgCode === 3857) {
    const longitude = (point[0] / 20037508.342789244) * 180;
    const latitude = (Math.atan(Math.exp((point[1] / 20037508.342789244) * Math.PI)) * 360) / Math.PI - 90;
    return [longitude, latitude];
  }
  return null;
}
export async function parseGeoPdfMetadata(buffer: ArrayBuffer): Promise<GeoPdfMetadata> {
  const inspection = await inspectPdf(new Uint8Array(buffer));
  const viewport = inspection.pages.flatMap((page) => page.viewports)[0];
  if (!viewport) return { isGeoreferenced: false };
  const epsgMatch = /EPSG:(\d+)/i.exec(viewport.sourceCrs ?? "");
  const epsgCode = epsgMatch ? Number.parseInt(epsgMatch[1]!, 10) : undefined;
  const points = viewport.ground.map((point) => toWgs84(point, epsgCode));
  if (points.some((point) => point === null)) {
    return { isGeoreferenced: true, ...(epsgCode !== undefined ? { epsgCode } : {}) };
  }
  const geographicPoints = points as [number, number][];
  const [minLon, minLat, maxLon, maxLat] = geographicPoints.reduce(
    (bounds, [x, y]) => [Math.min(bounds[0], x), Math.min(bounds[1], y), Math.max(bounds[2], x), Math.max(bounds[3], y)],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  );
  return {
    isGeoreferenced: true,
    ...(epsgCode !== undefined ? { epsgCode } : {}),
    bbox: [minLon, minLat, maxLon, maxLat],
    neatline: geographicPoints,
  };
}
