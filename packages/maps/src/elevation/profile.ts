import { haversineDistanceKm } from "../distance.js";
import type {
  DemMetadata,
  ElevationProfile,
} from "@markmap/contracts";
import { sampleDemBilinear } from "./dem.js";

export function computeElevationProfile(
  path: Array<[number, number]>,
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
): ElevationProfile {
  const points: ElevationProfile["points"] = [];
  let distance = 0;
  let prevElevation: number | null = null;
  let gain = 0;
  let loss = 0;
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    if (!pt) continue;
    const lon = pt[0];
    const lat = pt[1];
    const elevation = sampleDemBilinear(dem, metadata, lon, lat);
    if (elevation === null || !Number.isFinite(elevation)) {
      throw new Error('Sem dados de elevação para todo o trajeto; não é possível calcular o perfil.');
    }

    if (i > 0) {
      const prev = path[i - 1];
      if (prev) {
        distance += haversineDistanceKm(prev[1], prev[0], lat, lon);
      }
    }

    if (prevElevation !== null) {
      const diff = elevation - prevElevation;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }

    if (elevation < minElev) minElev = elevation;
    if (elevation > maxElev) maxElev = elevation;

    points.push({ distance, elevation, lon, lat });
    prevElevation = elevation;
  }

  if (!Number.isFinite(minElev)) minElev = 0;
  if (!Number.isFinite(maxElev)) maxElev = 0;

  return {
    points,
    totalDistance: distance,
    minElevation: minElev,
    maxElevation: maxElev,
    gain,
    loss,
  };
}

