import {
  type Coordinate,
  assertValidCoordinate,
  normalizeLongitudeDeg,
} from './coordinates.js';

export const MEAN_EARTH_RADIUS_M = 6_371_008.8;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function degrees(radiansValue: number): number {
  return (radiansValue * 180) / Math.PI;
}

function normalizeDeltaLongitudeRadians(value: number): number {
  return ((value + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
}

export function geodesicDistanceM(from: Coordinate, to: Coordinate): number {
  assertValidCoordinate(from, 'Origin');
  assertValidCoordinate(to, 'Destination');
  const latitude1 = radians(from.latitude);
  const latitude2 = radians(to.latitude);
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = normalizeDeltaLongitudeRadians(
    radians(to.longitude - from.longitude),
  );
  const sinLatitude = Math.sin(deltaLatitude / 2);
  const sinLongitude = Math.sin(deltaLongitude / 2);
  const haversine =
    sinLatitude * sinLatitude +
    Math.cos(latitude1) * Math.cos(latitude2) * sinLongitude * sinLongitude;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  const centralAngle =
    2 *
    Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
  return MEAN_EARTH_RADIUS_M * centralAngle;
}

export function initialBearingDeg(from: Coordinate, to: Coordinate): number {
  assertValidCoordinate(from, 'Origin');
  assertValidCoordinate(to, 'Destination');
  const latitude1 = radians(from.latitude);
  const latitude2 = radians(to.latitude);
  const deltaLongitude = normalizeDeltaLongitudeRadians(
    radians(to.longitude - from.longitude),
  );
  const y = Math.sin(deltaLongitude) * Math.cos(latitude2);
  const x =
    Math.cos(latitude1) * Math.sin(latitude2) -
    Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(deltaLongitude);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPoint(
  origin: Coordinate,
  distanceM: number,
  bearingDeg: number,
): Coordinate {
  assertValidCoordinate(origin, 'Origin');
  if (!Number.isFinite(distanceM) || distanceM < 0) {
    throw new RangeError('Distance must be a finite non-negative number');
  }
  if (!Number.isFinite(bearingDeg)) {
    throw new RangeError('Bearing must be finite');
  }
  const angularDistance = distanceM / MEAN_EARTH_RADIUS_M;
  const bearing = radians(bearingDeg);
  const latitude1 = radians(origin.latitude);
  const longitude1 = radians(origin.longitude);
  const latitude2 = Math.asin(
    Math.sin(latitude1) * Math.cos(angularDistance) +
      Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude2 =
    longitude1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
      Math.cos(angularDistance) - Math.sin(latitude1) * Math.sin(latitude2),
    );
  return {
    latitude: degrees(latitude2),
    longitude: normalizeLongitudeDeg(degrees(longitude2)),
  };
}

export function geodesicPolygonAreaM2(points: readonly Coordinate[]): number {
  points.forEach((point, index) => {
    assertValidCoordinate(point, `Polygon point ${String(index)}`);
  });
  if (points.length < 3) return 0;

  let accumulator = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    const deltaLongitude = normalizeDeltaLongitudeRadians(
      radians(next.longitude - current.longitude),
    );
    accumulator +=
      deltaLongitude *
      (2 +
        Math.sin(radians(current.latitude)) +
        Math.sin(radians(next.latitude)));
  }
  const sphereArea = 4 * Math.PI * MEAN_EARTH_RADIUS_M * MEAN_EARTH_RADIUS_M;
  const area = Math.abs(
    (accumulator * MEAN_EARTH_RADIUS_M * MEAN_EARTH_RADIUS_M) / 2,
  );
  return Math.min(area, sphereArea - area);
}
