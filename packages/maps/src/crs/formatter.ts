import type { FormattedCoordinates, GeographicCoordinate } from "./types.js";
import { wgs84ToUtm } from "./utm.js";
import { wgs84ToMgrs } from "./mgrs.js";

export function formatDecimalDegrees(coord: GeographicCoordinate): string {
  return `${formatLatitude(coord.latitude)}, ${formatLongitude(coord.longitude)}`;
}

export function formatDMS(coord: GeographicCoordinate): string {
  return `${formatDMSValue(Math.abs(coord.latitude), coord.latitude >= 0 ? "N" : "S")} ${formatDMSValue(
    Math.abs(coord.longitude),
    coord.longitude >= 0 ? "E" : "W",
  )}`;
}

function formatDMSValue(value: number, suffix: string): string {
  const degrees = Math.floor(value);
  const minutesFloat = (value - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(1);
  return `${degrees}°${String(minutes).padStart(2, "0")}'${seconds}"${suffix}`;
}

export function formatLatitude(latitude: number): string {
  return `${Math.abs(latitude).toFixed(6)}°${latitude >= 0 ? "N" : "S"}`;
}

export function formatLongitude(longitude: number): string {
  return `${Math.abs(longitude).toFixed(6)}°${longitude >= 0 ? "E" : "W"}`;
}

export function formatUtmText(coord: GeographicCoordinate): string {
  const utm = wgs84ToUtm(coord);
  return `${utm.zone}${utm.hemisphere} ${utm.easting.toFixed(0)} ${utm.northing.toFixed(0)}`;
}

export function formatAll(coord: GeographicCoordinate, mgrsPrecision = 5): FormattedCoordinates {
  return {
    decimal: formatDecimalDegrees(coord),
    dms: formatDMS(coord),
    utm: formatUtmText(coord),
    mgrs: wgs84ToMgrs(coord, mgrsPrecision).text,
  };
}
