export interface PositionSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  observedAt: string;
  source: 'browser-foreground' | 'browser-background' | 'simulated';
}

const MAXIMUM_FIX_AGE_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_FUTURE_SKEW_MS = 5 * 60 * 1_000;

export class InvalidLocationFixError extends Error {
  constructor() {
    super(
      'O dispositivo retornou uma posição inválida ou fora dos limites esperados.',
    );
    this.name = 'InvalidLocationFixError';
  }
}

function isBoundedNumber(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isBoundedNullable(
  value: number | null,
  minimum: number,
  maximum: number,
): boolean {
  return value === null || isBoundedNumber(value, minimum, maximum);
}

export interface GeolocationPositionLike {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export function positionSampleFromBrowser(
  position: GeolocationPositionLike,
  now = Date.now(),
): PositionSample {
  const { coords, timestamp } = position;
  if (
    !isBoundedNumber(coords.latitude, -90, 90) ||
    !isBoundedNumber(coords.longitude, -180, 180) ||
    !isBoundedNumber(coords.accuracy, 0, 100_000) ||
    !isBoundedNullable(coords.altitude, -12_000, 100_000) ||
    !isBoundedNullable(coords.altitudeAccuracy, 0, 100_000) ||
    !isBoundedNullable(coords.heading, 0, 359.999_999) ||
    !isBoundedNullable(coords.speed, 0, 500) ||
    !Number.isFinite(timestamp) ||
    timestamp <= 0 ||
    timestamp < now - MAXIMUM_FIX_AGE_MS ||
    timestamp > now + MAXIMUM_FUTURE_SKEW_MS
  ) {
    throw new InvalidLocationFixError();
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    altitude: coords.altitude,
    altitudeAccuracy: coords.altitudeAccuracy,
    heading: coords.heading,
    speed: coords.speed,
    observedAt: new Date(timestamp).toISOString(),
    source: 'browser-foreground',
  };
}
