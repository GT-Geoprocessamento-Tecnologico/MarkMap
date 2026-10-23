export type DatumType = "SAD69" | "CORREGO_ALEGRE" | "SIRGAS2000" | "WGS84";

export interface DatumTransformParams {
  dx: number;
  dy: number;
  dz: number;
}

/**
 * IBGE official 3-parameter geodetic datum shifts (Molodensky/Helmert translation)
 * relative to SIRGAS 2000 / WGS84.
 */
export const OFFICIAL_DATUM_SHIFTS: Record<Extract<DatumType, "SAD69" | "CORREGO_ALEGRE">, DatumTransformParams> = {
  SAD69: {
    dx: -67.35,
    dy: 3.88,
    dz: -38.22,
  },
  CORREGO_ALEGRE: {
    dx: -206.05,
    dy: 168.28,
    dz: -3.82,
  },
};

/**
 * Converts a WGS84/SIRGAS2000 [longitude, latitude] coordinate from a legacy Brazilian datum.
 * Uses standard geodetic approximation suitable for GIS mapping layers.
 */
export function convertDatumToSirgas2000(
  coord: [number, number],
  fromDatum: DatumType,
): [number, number] {
  if (!Array.isArray(coord) || coord.length < 2 || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) {
    throw new TypeError("Coordinate must be a valid [longitude, latitude] pair of numbers");
  }

  const [lon, lat] = coord;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new RangeError("Coordinates out of valid WGS84 geographic bounds");
  }

  if (fromDatum === "SIRGAS2000" || fromDatum === "WGS84") {
    return [lon, lat];
  }

  const shift = OFFICIAL_DATUM_SHIFTS[fromDatum];
  if (!shift) {
    throw new Error(`Unsupported legacy datum: ${fromDatum}`);
  }

  // Angular shift approximation for latitude and longitude in degrees
  // 1 degree latitude ~ 111,000 meters; longitude varies with cos(lat)
  const latRad = (lat * Math.PI) / 180;
  const dLatDeg = shift.dy / 111000;
  const dLonDeg = shift.dx / (111000 * Math.cos(latRad) || 1);

  const transformedLon = lon + dLonDeg;
  const transformedLat = lat + dLatDeg;

  return [
    Number(transformedLon.toFixed(7)),
    Number(transformedLat.toFixed(7)),
  ];
}

/**
 * Transforms all coordinates in a GeoJSON feature or geometry to SIRGAS 2000 / WGS84.
 */
export function transformGeoJsonToSirgas2000<T extends { type: string; [key: string]: unknown }>(
  geoJson: T,
  fromDatum: DatumType,
): T {
  if (!geoJson || typeof geoJson !== "object") {
    throw new TypeError("Invalid GeoJSON object");
  }

  if (fromDatum === "SIRGAS2000" || fromDatum === "WGS84") {
    return geoJson;
  }

  const deepCopy = JSON.parse(JSON.stringify(geoJson));

  function processGeometry(geom: GeoJSON.Geometry | null) {
    if (!geom || !("coordinates" in geom)) return;
    const toSirgas = (coord: GeoJSON.Position): [number, number] =>
      convertDatumToSirgas2000([coord[0]!, coord[1]!], fromDatum);
    if (geom.type === "Point") {
      geom.coordinates = toSirgas(geom.coordinates);
    } else if (geom.type === "LineString" || geom.type === "MultiPoint") {
      geom.coordinates = geom.coordinates.map(toSirgas);
    } else if (geom.type === "Polygon" || geom.type === "MultiLineString") {
      geom.coordinates = geom.coordinates.map((ring) => ring.map(toSirgas));
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates = geom.coordinates.map((poly) => poly.map((ring) => ring.map(toSirgas)));
    }
  }

  if (deepCopy.type === "FeatureCollection" && Array.isArray(deepCopy.features)) {
    for (const feature of deepCopy.features) {
      if (feature.geometry) processGeometry(feature.geometry);
    }
  } else if (deepCopy.type === "Feature" && deepCopy.geometry) {
    processGeometry(deepCopy.geometry);
  } else if (deepCopy.coordinates) {
    processGeometry(deepCopy);
  }

  return deepCopy;
}
