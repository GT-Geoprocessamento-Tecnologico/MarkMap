import { type GeographicCoordinate, type UtmCoordinate, type Hemisphere } from "./types.js";

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function getUtmZone(longitude: number, latitude?: number): number {
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError(`Longitude must be between -180 and 180, got ${longitude}`);
  }
  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -80 || latitude > 84)) {
    throw new RangeError(`Latitude must be between -80 and 84 for UTM, got ${latitude}`);
  }
  if (latitude !== undefined && latitude >= 56 && latitude < 64 && longitude >= 3 && longitude < 12) {
    return 32;
  }
  if (latitude !== undefined && latitude >= 72 && latitude < 84 && longitude >= 0 && longitude < 42) {
    if (longitude < 9) return 31;
    if (longitude < 21) return 33;
    if (longitude < 33) return 35;
    return 37;
  }
  return Math.min(60, Math.max(1, Math.floor((longitude + 180) / 6) + 1));
}

export function getHemisphere(latitude: number): Hemisphere {
  if (!Number.isFinite(latitude) || latitude < -80 || latitude > 84) {
    throw new RangeError(`Latitude must be between -80 and 84 for UTM, got ${latitude}`);
  }
  return latitude >= 0 ? "N" : "S";
}

export function wgs84ToUtm(coord: GeographicCoordinate): UtmCoordinate {
  const { latitude, longitude } = coord;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new RangeError("UTM coordinates require finite latitude and longitude");
  }
  const zone = getUtmZone(longitude, latitude);
  const hemisphere = getHemisphere(latitude);

  const k0 = 0.9996;
  const a = 6378137.0;
  const f = 1.0 / 298.257223563;
  const e = Math.sqrt(f * (2 - f));
  const e2sq = (e * e) / (1 - e * e);

  const lonRad = toRadians(longitude);
  const latRad = toRadians(latitude);
  const lon0Rad = toRadians((zone - 1) * 6 - 180 + 3);

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2sq * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lonRad - lon0Rad);
  const M =
    a *
    ((1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256) * latRad -
      (3 * e * e / 8 + 3 * Math.pow(e, 4) / 32 + 45 * Math.pow(e, 6) / 1024) *
        Math.sin(2 * latRad) +
      (15 * Math.pow(e, 4) / 256 + 45 * Math.pow(e, 6) / 1024) * Math.sin(4 * latRad) -
      (35 * Math.pow(e, 6) / 3072) * Math.sin(6 * latRad));

  const easting =
    k0 * N * (A + ((1 - T + C) * Math.pow(A, 3)) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * e2sq) * Math.pow(A, 5)) / 120) +
    500000;
  let northing =
    k0 *
    (M +
      N * Math.tan(latRad) * (A * A / 2 + ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * e2sq) * Math.pow(A, 6)) / 720));

  if (hemisphere === "S") {
    northing += 10000000;
  }

  return { easting, northing, zone, hemisphere };
}

export function utmToWgs84(utm: UtmCoordinate): GeographicCoordinate {
  const { easting, northing, zone, hemisphere } = utm;
  if (!Number.isFinite(easting) || easting < 100000 || easting > 1000000) throw new RangeError("UTM easting must be finite and between 100000 and 1000000");
  if (!Number.isFinite(northing) || northing < 0 || northing > 10000000) throw new RangeError("UTM northing must be finite and between 0 and 10000000");
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) throw new RangeError("UTM zone must be an integer between 1 and 60");
  if (hemisphere !== "N" && hemisphere !== "S") throw new RangeError("UTM hemisphere must be N or S");
  const k0 = 0.9996;
  const a = 6378137.0;
  const f = 1.0 / 298.257223563;
  const e = Math.sqrt(f * (2 - f));
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  const e2sq = (e * e) / (1 - e * e);

  const x = easting - 500000;
  const y = hemisphere === "S" ? northing - 10000000 : northing;
  const lon0Rad = toRadians((zone - 1) * 6 - 180 + 3);

  const M = y / k0;
  const mu = M / (a * (1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - e * e * Math.sin(phi1Rad) * Math.sin(phi1Rad));
  const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
  const C1 = e2sq * Math.cos(phi1Rad) * Math.cos(phi1Rad);
  const R1 = (a * (1 - e * e)) / Math.pow(1 - e * e * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
  const D = x / (N1 * k0);

  const latRad =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      (D * D / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2sq) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e2sq - 3 * C1 * C1) * Math.pow(D, 6)) / 720);

  const lonRad =
    lon0Rad +
    (D - ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2sq + 24 * T1 * T1) * Math.pow(D, 5)) / 120) /
      Math.cos(phi1Rad);

  return {
    latitude: toDegrees(latRad),
    longitude: toDegrees(lonRad),
  };
}
