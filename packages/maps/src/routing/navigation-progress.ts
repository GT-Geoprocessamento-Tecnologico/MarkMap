import type { Route } from '@geonexo/contracts';

/** The GPS is used in memory only, never persisted or transmitted. */
export interface ForegroundGpsFix {
  lon: number;
  lat: number;
  accuracyM: number;
  timestampMs: number;
}

export interface OfflineNavigationProgress {
  position: [number, number];
  matchedPosition: [number, number];
  offsetM: number;
  offRoute: boolean;
  remainingM: number;
  remainingSeconds: number;
  nextStepIndex: number;
  nextStepDistanceM: number;
  arrived: boolean;
  accuracyM: number;
}

export const GPS_MAX_AGE_MS = 30_000;
export const GPS_MAX_ACCURACY_M = 80;
export const ARRIVAL_RADIUS_M = 25;

const RADIANS = Math.PI / 180;
function haversineM(a: readonly number[], b: readonly number[]): number {
  const deltaLat = (b[1]! - a[1]!) * RADIANS;
  const deltaLon = (b[0]! - a[0]!) * RADIANS;
  const value = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(a[1]! * RADIANS) * Math.cos(b[1]! * RADIANS) * Math.sin(deltaLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(value)));
}

function wrapLongitude(delta: number): number {
  return ((delta + 540) % 360) - 180;
}

/**
 * Match a foreground fix against the installed graph's route polyline.
 * Uses local distances and GPS accuracy; no maps, services or network required.
 * Null means the position is stale, imprecise or otherwise untrustworthy.
 */
export function computeOfflineNavigationProgress(
  route: Route,
  fix: ForegroundGpsFix,
  nowMs: number = Date.now(),
): OfflineNavigationProgress | null {
  if (!Array.isArray(route.geometry) || route.geometry.length < 2 ||
      !Number.isFinite(fix.lon) || fix.lon < -180 || fix.lon > 180 ||
      !Number.isFinite(fix.lat) || fix.lat < -90 || fix.lat > 90 ||
      !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 || fix.accuracyM > GPS_MAX_ACCURACY_M ||
      !Number.isFinite(fix.timestampMs) || !Number.isFinite(nowMs) ||
      nowMs - fix.timestampMs > GPS_MAX_AGE_MS || fix.timestampMs - nowMs > 5_000) return null;

  const coordinates = route.geometry;
  const cumulative: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const previous = coordinates[i - 1]!;
    const current = coordinates[i]!;
    if (![...previous, ...current].every(Number.isFinite)) return null;
    cumulative.push(cumulative[i - 1]! + haversineM(previous, current));
  }
  const totalLength = cumulative[cumulative.length - 1]!;
  if (!(totalLength > 0) || !Number.isFinite(totalLength)) return null;

  // The local tangent plane is sufficient for snapping within a regional map.
  const scaleLon = Math.max(0.001, Math.cos(fix.lat * RADIANS)) * 111_320;
  const scaleLat = 110_574;
  let smallest = Infinity;
  let along = 0;
  let snapped: [number, number] = coordinates[0]!;
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1]!;
    const b = coordinates[i]!;
    const ax = wrapLongitude(a[0] - fix.lon) * scaleLon;
    const ay = (a[1] - fix.lat) * scaleLat;
    const bx = wrapLongitude(b[0] - fix.lon) * scaleLon;
    const by = (b[1] - fix.lat) * scaleLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const factor = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    const px = ax + factor * dx;
    const py = ay + factor * dy;
    const candidate = Math.hypot(px, py);
    if (candidate < smallest) {
      smallest = candidate;
      along = cumulative[i - 1]! + factor * (cumulative[i]! - cumulative[i - 1]!);
      snapped = [a[0] + factor * wrapLongitude(b[0] - a[0]), a[1] + factor * (b[1] - a[1])];
    }
  }
  if (!Number.isFinite(smallest)) return null;
  const remainingFraction = Math.max(0, Math.min(1, 1 - along / totalLength));
  const distanceToDestination = haversineM([fix.lon, fix.lat], route.destination);
  const offRoute = smallest > Math.max(40, fix.accuracyM * 2);
  // Arrival requires the accuracy circle to fit inside the destination radius.
  const arrived = !offRoute && distanceToDestination + fix.accuracyM <= ARRIVAL_RADIUS_M &&
    totalLength - along <= 40;

  // Steps produced by the current router start at consecutive route vertices.
  // Only announce meaningful turns (or arrival), rather than every edge.
  let nextStepIndex = Math.max(0, route.steps.length - 1);
  let nextStepDistanceM = Math.max(0, totalLength - along);
  for (let i = 1; i < route.steps.length; i++) {
    const step = route.steps[i]!;
    if (step.maneuver.type === 'continue' || step.maneuver.type === 'new_name') continue;
    const index = Math.min(i, cumulative.length - 1);
    const stepAt = cumulative[index]!;
    if (stepAt + 5 >= along) {
      nextStepIndex = i;
      nextStepDistanceM = Math.max(0, stepAt - along);
      break;
    }
  }

  return {
    position: [fix.lon, fix.lat], matchedPosition: snapped,
    offsetM: smallest, offRoute,
    remainingM: Math.max(0, route.distance * remainingFraction),
    remainingSeconds: Math.max(0, route.duration * remainingFraction),
    nextStepIndex, nextStepDistanceM, arrived, accuracyM: fix.accuracyM,
  };
}
