export interface Coordinate {
  latitude: number;
  longitude: number;
}

const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

export type CoordinateParseErrorCode =
  | 'EMPTY'
  | 'UNSUPPORTED_FORMAT'
  | 'AMBIGUOUS_FORMAT'
  | 'INVALID_NUMBER'
  | 'OUT_OF_RANGE';

export type CoordinateParseResult =
  | {
      readonly ok: true;
      readonly coordinate: Coordinate;
      readonly decimalSeparator: '.' | ',';
    }
  | {
      readonly ok: false;
      readonly code: CoordinateParseErrorCode;
      readonly message: string;
    };

export interface CoordinateFormatOptions {
  /** Decimal places between 0 and 10. Defaults to 6. */
  readonly decimalPlaces?: number;
  /** pt-BR uses decimal commas and a semicolon between latitude and longitude. */
  readonly locale?: 'pt-BR' | 'en-US';
  readonly includeLabels?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isValidLatitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_LATITUDE &&
    value <= MAX_LATITUDE
  );
}

export function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_LONGITUDE &&
    value <= MAX_LONGITUDE
  );
}

export function isValidCoordinate(value: unknown): value is Coordinate {
  return (
    isRecord(value) &&
    isValidLatitude(value['latitude']) &&
    isValidLongitude(value['longitude'])
  );
}

export function assertValidCoordinate(
  value: unknown,
  label = 'Coordinate',
): asserts value is Coordinate {
  if (!isRecord(value)) {
    throw new TypeError(
      `${label} must be an object with latitude and longitude`,
    );
  }
  if (!isValidLatitude(value['latitude'])) {
    throw new RangeError(
      `${label} latitude must be a finite number between -90 and 90`,
    );
  }
  if (!isValidLongitude(value['longitude'])) {
    throw new RangeError(
      `${label} longitude must be a finite number between -180 and 180`,
    );
  }
}

/** Normalizes a finite longitude to the canonical [-180, 180] interval. */
export function normalizeLongitudeDeg(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    throw new RangeError('Longitude must be finite');
  }
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 && longitude > 0 ? 180 : normalized;
}

function failure(
  code: CoordinateParseErrorCode,
  message: string,
): CoordinateParseResult {
  return { ok: false, code, message };
}

function parseStrictNumber(
  token: string,
  decimalSeparator: '.' | ',',
): number | null {
  const normalizedToken = token.trim();
  const pattern =
    decimalSeparator === '.'
      ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
      : /^[+-]?(?:\d+(?:,\d*)?|, \d+)$/;
  if (!pattern.test(normalizedToken)) return null;
  const parsed = Number(
    decimalSeparator === ','
      ? normalizedToken.replace(',', '.')
      : normalizedToken,
  );
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePair(
  latitudeToken: string,
  longitudeToken: string,
  decimalSeparator: '.' | ',',
): CoordinateParseResult {
  const latitude = parseStrictNumber(latitudeToken, decimalSeparator);
  const longitude = parseStrictNumber(longitudeToken, decimalSeparator);
  if (latitude === null || longitude === null) {
    return failure(
      'INVALID_NUMBER',
      'Latitude and longitude must be valid decimal numbers',
    );
  }
  const coordinate = { latitude, longitude };
  if (!isValidCoordinate(coordinate)) {
    return failure(
      'OUT_OF_RANGE',
      'Latitude must be between -90 and 90 and longitude between -180 and 180',
    );
  }
  return { ok: true, coordinate, decimalSeparator };
}

/**
 * Parses safe decimal coordinate pairs without guessing ambiguous comma usage.
 *
 * Accepted examples:
 * - `-20.397, -43.510` or `-20.397 -43.510`
 * - `-20,397; -43,510` or `-20,397 -43,510`
 */
export function parseCoordinateSearch(input: string): CoordinateParseResult {
  const value = input.trim();
  if (value.length === 0)
    return failure('EMPTY', 'Enter a latitude and longitude');

  if (value.includes(';')) {
    const tokens = value.split(';');
    if (tokens.length !== 2) {
      return failure(
        'UNSUPPORTED_FORMAT',
        'Use exactly one separator between latitude and longitude',
      );
    }
    const latitudeToken = tokens[0];
    const longitudeToken = tokens[1];
    if (latitudeToken === undefined || longitudeToken === undefined) {
      return failure(
        'UNSUPPORTED_FORMAT',
        'Both latitude and longitude are required',
      );
    }
    const decimalSeparator =
      latitudeToken.includes(',') || longitudeToken.includes(',') ? ',' : '.';
    return parsePair(latitudeToken, longitudeToken, decimalSeparator);
  }

  const dotDecimalCommaPair = value.match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/u,
  );
  if (
    dotDecimalCommaPair !== null &&
    (value.includes('.') || /,\s+/u.test(value))
  ) {
    const latitudeToken = dotDecimalCommaPair[1];
    const longitudeToken = dotDecimalCommaPair[2];
    if (latitudeToken !== undefined && longitudeToken !== undefined) {
      return parsePair(latitudeToken, longitudeToken, '.');
    }
  }

  const whitespaceTokens = value.split(/\s+/u);
  if (whitespaceTokens.length === 2) {
    const latitudeToken = whitespaceTokens[0];
    const longitudeToken = whitespaceTokens[1];
    if (latitudeToken === undefined || longitudeToken === undefined) {
      return failure(
        'UNSUPPORTED_FORMAT',
        'Both latitude and longitude are required',
      );
    }
    const usesComma =
      latitudeToken.includes(',') || longitudeToken.includes(',');
    return parsePair(latitudeToken, longitudeToken, usesComma ? ',' : '.');
  }

  const commaTokens = value.split(',');
  if (commaTokens.length === 2) {
    const latitudeToken = commaTokens[0];
    const longitudeToken = commaTokens[1];
    if (latitudeToken === undefined || longitudeToken === undefined) {
      return failure(
        'UNSUPPORTED_FORMAT',
        'Both latitude and longitude are required',
      );
    }
    return parsePair(latitudeToken, longitudeToken, '.');
  }

  return failure(
    'UNSUPPORTED_FORMAT',
    'Use latitude and longitude separated by a comma, semicolon, or whitespace',
  );
}

export function formatCoordinate(
  coordinate: Coordinate,
  options: CoordinateFormatOptions = {},
): string {
  assertValidCoordinate(coordinate);
  const decimalPlaces = options.decimalPlaces ?? 6;
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > 10
  ) {
    throw new RangeError('Decimal places must be an integer between 0 and 10');
  }
  const locale = options.locale ?? 'en-US';
  const decimalSeparator = locale === 'pt-BR' ? ',' : '.';
  const pairSeparator = locale === 'pt-BR' ? '; ' : ', ';
  const render = (value: number): string => {
    const fixed = value.toFixed(decimalPlaces);
    return decimalSeparator === ',' ? fixed.replace('.', ',') : fixed;
  };
  const latitude = render(coordinate.latitude);
  const longitude = render(coordinate.longitude);
  return options.includeLabels === true
    ? `lat ${latitude}${pairSeparator}lon ${longitude}`
    : `${latitude}${pairSeparator}${longitude}`;
}
