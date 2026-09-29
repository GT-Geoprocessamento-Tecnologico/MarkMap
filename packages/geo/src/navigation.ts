import {
  type Coordinate,
  assertValidCoordinate,
} from './coordinates.js';
import { geodesicDistanceM, initialBearingDeg } from './geodesy.js';

const DIRECTION_UNDEFINED_DISTANCE_M = 1e-6;

export type ArrivalStatus = 'arrived' | 'possibly-arrived' | 'en-route';

export interface NavigationOptions {
  /** Straight-line arrival radius. Defaults to 10 metres. */
  readonly arrivalRadiusM?: number;
  /** Horizontal GPS accuracy radius in metres, when reported by the device. */
  readonly accuracyM?: number;
  /** Current device/course heading where 0 is north and 90 is east. */
  readonly currentHeadingDeg?: number;
}

export interface NavigationState {
  readonly current: Coordinate;
  readonly destination: Coordinate;
  readonly distanceM: number;
  /** Null at the destination because direction is undefined there. */
  readonly bearingDeg: number | null;
  readonly currentHeadingDeg: number | null;
  /** Shortest signed turn from heading to bearing; positive is clockwise. */
  readonly turnAngleDeg: number | null;
  readonly arrivalRadiusM: number;
  readonly accuracyM: number | null;
  readonly minimumPossibleDistanceM: number;
  readonly maximumPossibleDistanceM: number;
  readonly estimatedInsideArrivalRadius: boolean;
  /** True when the fix and its reported accuracy circle, when available, are inside the radius. */
  readonly arrived: boolean;
  readonly arrivalStatus: ArrivalStatus;
}

export function normalizeBearingDeg(bearingDeg: number): number {
  if (!Number.isFinite(bearingDeg))
    throw new RangeError('Bearing must be finite');
  return ((bearingDeg % 360) + 360) % 360;
}

/** Returns the shortest signed turn from `fromDeg` to `toDeg`. */
export function signedAngularDifferenceDeg(
  fromDeg: number,
  toDeg: number,
): number {
  const from = normalizeBearingDeg(fromDeg);
  const to = normalizeBearingDeg(toDeg);
  const difference = ((to - from + 540) % 360) - 180;
  return difference === -180 ? 180 : difference;
}

export function calculateNavigationState(
  current: Coordinate,
  destination: Coordinate,
  options: NavigationOptions = {},
): NavigationState {
  assertValidCoordinate(current, 'Current position');
  assertValidCoordinate(destination, 'Navigation destination');
  const arrivalRadiusM = options.arrivalRadiusM ?? 10;
  if (!Number.isFinite(arrivalRadiusM) || arrivalRadiusM < 0) {
    throw new RangeError('Arrival radius must be a finite non-negative number');
  }
  const accuracyM = options.accuracyM ?? null;
  if (accuracyM !== null && (!Number.isFinite(accuracyM) || accuracyM < 0)) {
    throw new RangeError('Accuracy must be a finite non-negative number');
  }
  const currentHeadingDeg =
    options.currentHeadingDeg === undefined
      ? null
      : normalizeBearingDeg(options.currentHeadingDeg);

  const distanceM = geodesicDistanceM(current, destination);
  const bearingDeg =
    distanceM <= DIRECTION_UNDEFINED_DISTANCE_M
      ? null
      : initialBearingDeg(current, destination);
  const turnAngleDeg =
    bearingDeg === null || currentHeadingDeg === null
      ? null
      : signedAngularDifferenceDeg(currentHeadingDeg, bearingDeg);
  const minimumPossibleDistanceM = Math.max(0, distanceM - (accuracyM ?? 0));
  const maximumPossibleDistanceM = distanceM + (accuracyM ?? 0);
  const estimatedInsideArrivalRadius = distanceM <= arrivalRadiusM;

  let arrivalStatus: ArrivalStatus;
  if (maximumPossibleDistanceM <= arrivalRadiusM) {
    arrivalStatus = 'arrived';
  } else if (minimumPossibleDistanceM <= arrivalRadiusM) {
    arrivalStatus = 'possibly-arrived';
  } else {
    arrivalStatus = 'en-route';
  }

  return {
    current,
    destination,
    distanceM,
    bearingDeg,
    currentHeadingDeg,
    turnAngleDeg,
    arrivalRadiusM,
    accuracyM,
    minimumPossibleDistanceM,
    maximumPossibleDistanceM,
    estimatedInsideArrivalRadius,
    arrived: arrivalStatus === 'arrived',
    arrivalStatus,
  };
}
