/** Offline elevation profile from an imported GeoJSON track with real Z coordinates. */
export interface ProfilePoint { distanceKm: number; elevation: number; }
export interface TrackElevationProfile {
  points: ProfilePoint[];
  totalDistanceKm: number;
  ascent: number;
  descent: number;
  minElevation: number;
  maxElevation: number;
}
function distanceKm(a: number[], b: number[]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1]! - a[1]!) * rad;
  const dLon = (b[0]! - a[0]!) * rad;
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(a[1]! * rad) * Math.cos(b[1]! * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(Math.max(0, 1 - hav)));
}
function valid3D(p: unknown): p is number[] {
  return Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90 && p[2] >= -11_000 && p[2] <= 9_000;
}
export function profileFromFeatures(features: readonly unknown[]): TrackElevationProfile | null {
  const points: ProfilePoint[] = [];
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const raw of features) {
    if (!raw || typeof raw !== 'object') continue;
    const geometry = (raw as { geometry?: unknown }).geometry;
    if (!geometry || typeof geometry !== 'object') continue;
    const shape = geometry as { type?: unknown; coordinates?: unknown };
    const segments = shape.type === 'LineString' ? [shape.coordinates] :
      shape.type === 'MultiLineString' ? shape.coordinates : null;
    if (!Array.isArray(segments)) continue;
    for (const segment of segments) {
      if (!Array.isArray(segment)) continue;
      let prev: number[] | null = null;
      for (const coordinate of segment) {
        if (!valid3D(coordinate)) { prev = null; continue; }
        if (prev) {
          distance += distanceKm(prev, coordinate);
          const change = coordinate[2]! - prev[2]!;
          if (change > 0) ascent += change;
          else descent -= change;
        }
        prev = coordinate;
        min = Math.min(min, coordinate[2]!);
        max = Math.max(max, coordinate[2]!);
        points.push({ distanceKm: distance, elevation: coordinate[2]! });
      }
    }
  }
  return points.length >= 2 && distance > 0 ? {
    points, totalDistanceKm: distance, ascent, descent, minElevation: min, maxElevation: max,
  } : null;
}
