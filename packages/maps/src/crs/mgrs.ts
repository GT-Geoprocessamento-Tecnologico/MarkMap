import { type GeographicCoordinate, type MgrsCoordinate, type UtmCoordinate } from "./types.js";
import { wgs84ToUtm } from "./utm.js";

const LATITUDE_BANDS = "CDEFGHJKLMNPQRSTUVWX";

/** Standard 100 km square identifiers, column A-Z (excluding I and O), rows A-V. */
const GRID_COLUMNS = "ABCDEFGHJKLMNPQRSTUV";
const GRID_ROWS = "ABCDEFGHJKLMNPQRSTUV";

export function getLatitudeBand(latitude: number): string {
  if (latitude < -80 || latitude > 84) {
    throw new Error(`Latitude out of MGRS range: ${latitude}`);
  }
  if (latitude >= 72) return "X";
  if (latitude >= 64) return "W";
  if (latitude >= 56) return "V";
  if (latitude >= 48) return "U";
  if (latitude >= 40) return "T";
  if (latitude >= 32) return "S";
  if (latitude >= 24) return "R";
  if (latitude >= 16) return "Q";
  if (latitude >= 8) return "P";
  if (latitude >= 0) return "N";
  if (latitude >= -8) return "M";
  if (latitude >= -16) return "L";
  if (latitude >= -24) return "K";
  if (latitude >= -32) return "J";
  if (latitude >= -40) return "H";
  if (latitude >= -48) return "G";
  if (latitude >= -56) return "F";
  if (latitude >= -64) return "E";
  if (latitude >= -72) return "D";
  return "C";
}

export function utmToMgrs(utm: UtmCoordinate, precision = 5): MgrsCoordinate {
  if (precision < 1 || precision > 5) {
    throw new Error(`MGRS precision must be between 1 and 5, got ${precision}`);
  }

  const band = getLatitudeBand(utm.northing >= 10000000 ? (utm.northing - 10000000) / 10000000 * 0 : 0);
  const northing = utm.northing;

  const setNumber = Math.floor(northing / 100000);
  const rowIndex = setNumber % 20;
  const rowLetter = GRID_ROWS[rowIndex];
  const columnIndex = Math.floor(utm.easting / 100000) - 1;
  const columnLetter = GRID_COLUMNS[columnIndex % 20];

  const divisor = Math.pow(10, 5 - precision);
  const easting = Math.floor((utm.easting % 100000) / divisor);
  const northingRemainder = Math.floor((northing % 100000) / divisor);

  const eastingText = String(easting).padStart(precision, "0");
  const northingText = String(northingRemainder).padStart(precision, "0");

  return {
    zone: utm.zone,
    band,
    gridSquare: `${columnLetter}${rowLetter}`,
    easting,
    northing: northingRemainder,
    precision,
    text: `${utm.zone}${band} ${columnLetter}${rowLetter} ${eastingText} ${northingText}`,
  };
}

export function wgs84ToMgrs(coord: GeographicCoordinate, precision = 5): MgrsCoordinate {
  const utm = wgs84ToUtm(coord);
  const band = getLatitudeBand(coord.latitude);
  const northing = utm.northing;

  const setNumber = Math.floor(northing / 100000);
  const rowIndex = setNumber % 20;
  const rowLetter = GRID_ROWS[rowIndex];
  const columnIndex = Math.floor(utm.easting / 100000) - 1;
  const columnLetter = GRID_COLUMNS[columnIndex % 20];

  const divisor = Math.pow(10, 5 - precision);
  const easting = Math.floor((utm.easting % 100000) / divisor);
  const northingRemainder = Math.floor((northing % 100000) / divisor);

  const eastingText = String(easting).padStart(precision, "0");
  const northingText = String(northingRemainder).padStart(precision, "0");

  return {
    zone: utm.zone,
    band,
    gridSquare: `${columnLetter}${rowLetter}`,
    easting,
    northing: northingRemainder,
    precision,
    text: `${utm.zone}${band} ${columnLetter}${rowLetter} ${eastingText} ${northingText}`,
  };
}
