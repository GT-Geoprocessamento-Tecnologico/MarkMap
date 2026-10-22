export interface GnssFix {
  latitude: number;
  longitude: number;
  altitude?: number;
  hdop?: number;
  vdop?: number;
  satellitesCount?: number;
  fixQuality: "INVALID" | "GPS_FIX" | "DGPS_FIX" | "PPS_FIX" | "RTK_FIXED" | "RTK_FLOAT";
  timestamp: number;
}

/**
 * Parses a GGA sentence. GGA carries UTC time-of-day but no calendar date;
 * callers replaying historical data should provide the corresponding date.
 * The default preserves the existing live-stream behavior by using one Date
 * snapshot captured when this call starts.
 */
export function parseNmeaSentence(line: string, referenceDate: Date = new Date()): GnssFix | null {
  if (!Number.isFinite(referenceDate.getTime())) return null;
  const sentence = line.trim();
  if (!sentence.startsWith("$GPGGA") && !sentence.startsWith("$GNGGA")) {
    return null;
  }
  const star = sentence.indexOf("*");
  const payload = star >= 0 ? sentence.slice(0, star) : sentence;
  if (star >= 0) {
    const expected = sentence.slice(star + 1);
    if (!/^[0-9A-Fa-f]{2}$/.test(expected)) return null;
    let checksum = 0;
    for (const char of payload.slice(1)) checksum ^= char.charCodeAt(0);
    if (checksum !== Number.parseInt(expected, 16)) return null;
  }
  const parts = payload.split(",");
  if (parts.length < 10 || !parts[1] || !parts[2] || !parts[3] || !parts[4] || !parts[5]) {
    return null;
  }

  const timeMatch = /^(\d{2})(\d{2})(\d{2})(?:\.(\d+))?$/.exec(parts[1]);
  const numberToken = /^[+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59 || Number(timeMatch[3]) > 59) return null;
  if (!numberToken.test(parts[2]) || !numberToken.test(parts[4])) return null;
  const rawLat = Number(parts[2]);
  const rawLon = Number(parts[4]);
  const latDeg = Math.floor(rawLat / 100);
  const lonDeg = Math.floor(rawLon / 100);
  const latMin = rawLat % 100;
  const lonMin = rawLon % 100;
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon) || latDeg > 90 || lonDeg > 180 || latMin >= 60 || lonMin >= 60 || (latDeg === 90 && latMin !== 0) || (lonDeg === 180 && lonMin !== 0) || !["N", "S"].includes(parts[3]) || !["E", "W"].includes(parts[5])) return null;
  let lat = latDeg + latMin / 60;
  if (parts[3] === "S") lat = -lat;
  let lon = lonDeg + lonMin / 60;
  if (parts[5] === "W") lon = -lon;

  const signedNumberToken = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  const altitude = parts[9] && signedNumberToken.test(parts[9]) ? Number(parts[9]) : parts[9] ? Number.NaN : undefined;
  const hdop = parts[8] && numberToken.test(parts[8]) ? Number(parts[8]) : parts[8] ? Number.NaN : undefined;
  const satellitesCount = parts[7] && /^\d+$/.test(parts[7]) ? Number(parts[7]) : parts[7] ? Number.NaN : undefined;
  if ((altitude !== undefined && !Number.isFinite(altitude)) || (hdop !== undefined && !Number.isFinite(hdop)) || (satellitesCount !== undefined && !Number.isInteger(satellitesCount))) return null;

  const qualityMap: Record<string, GnssFix["fixQuality"]> = {
    "0": "INVALID",
    "1": "GPS_FIX",
    "2": "DGPS_FIX",
    "3": "PPS_FIX",
    "4": "RTK_FIXED",
    "5": "RTK_FLOAT",
  };

  const result: GnssFix = {
    latitude: lat,
    longitude: lon,
    fixQuality: qualityMap[parts[6] ?? ""] || "INVALID",
    timestamp: Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate(), Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3]), timeMatch[4] ? Number(`0.${timeMatch[4]}`) * 1000 : 0),
  };
  if (altitude !== undefined) result.altitude = altitude;
  if (hdop !== undefined) result.hdop = hdop;
  if (satellitesCount !== undefined) result.satellitesCount = satellitesCount;
  return result;
}
