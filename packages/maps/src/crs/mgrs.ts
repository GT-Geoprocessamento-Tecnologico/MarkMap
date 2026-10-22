import { type GeographicCoordinate, type MgrsCoordinate, type UtmCoordinate } from "./types.js";
import { utmToWgs84, wgs84ToUtm } from "./utm.js";

/** Standard 100 km square identifiers, column A-Z (excluding I and O), rows A-V. */
const GRID_COLUMNS = ["ABCDEFGH", "JKLMNPQR", "STUVWXYZ"] as const;
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

  const { latitude } = utmToWgs84(utm);
  const band = getLatitudeBand(latitude);
  // UTM northing already includes the southern false northing.  The MGRS
  // row cycle therefore gets the additional 10-row southern offset instead
  // of subtracting 10,000,000 (which produces negative indexes).
  const northing = utm.northing;

  const rowOffset = utm.zone % 2 === 0 ? 5 : 0;
  const rowIndex = (Math.floor(northing / 100000) + rowOffset + (utm.hemisphere === "S" ? 10 : 0)) % 20;
  const rowLetter = GRID_ROWS[rowIndex]!;
  const columnLetters = GRID_COLUMNS[(utm.zone - 1) % 3]!;
  const columnLetter = columnLetters[Math.floor(utm.easting / 100000) - 1];
  if (!columnLetter) throw new RangeError("UTM easting is outside the MGRS 100 km grid");

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

  const rowOffset = utm.zone % 2 === 0 ? 5 : 0;
  const rowIndex = (Math.floor(northing / 100000) + rowOffset + (utm.hemisphere === "S" ? 10 : 0)) % 20;
  const rowLetter = GRID_ROWS[rowIndex]!;
  const columnLetters = GRID_COLUMNS[(utm.zone - 1) % 3]!;
  const columnLetter = columnLetters[Math.floor(utm.easting / 100000) - 1];
  if (!columnLetter) throw new RangeError("UTM easting is outside the MGRS 100 km grid");

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
