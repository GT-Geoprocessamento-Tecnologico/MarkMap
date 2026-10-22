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

export function parseNmeaSentence(line: string): GnssFix | null {
  if (!line.startsWith("$GPGGA") && !line.startsWith("$GNGGA")) {
    return null;
  }
  const parts = line.split("*")[0].split(",");
  if (parts.length < 10 || !parts[2] || !parts[4]) {
    return null;
  }

  const rawLat = parseFloat(parts[2]);
  const latDeg = Math.floor(rawLat / 100);
  const latMin = rawLat % 100;
  let lat = latDeg + latMin / 60;
  if (parts[3] === "S") lat = -lat;

  const rawLon = parseFloat(parts[4]);
  const lonDeg = Math.floor(rawLon / 100);
  const lonMin = rawLon % 100;
  let lon = lonDeg + lonMin / 60;
  if (parts[5] === "W") lon = -lon;

  const qualityMap: Record<string, GnssFix["fixQuality"]> = {
    "0": "INVALID",
    "1": "GPS_FIX",
    "2": "DGPS_FIX",
    "3": "PPS_FIX",
    "4": "RTK_FIXED",
    "5": "RTK_FLOAT",
  };

  return {
    latitude: lat,
    longitude: lon,
    altitude: parts[9] ? parseFloat(parts[9]) : undefined,
    hdop: parts[8] ? parseFloat(parts[8]) : undefined,
    satellitesCount: parts[7] ? parseInt(parts[7], 10) : undefined,
    fixQuality: qualityMap[parts[6]] || "INVALID",
    timestamp: Date.now(),
  };
}
