/**
 * Vector Export Engine for GPX 1.1 and KML 2.2
 * 100% pure TypeScript, zero runtime external dependencies, safe XML escaping.
 */

function escapeXml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface GpxExportOptions {
  name?: string;
  creator?: string;
  time?: string;
}

export interface KmlExportOptions {
  name?: string;
  description?: string;
}

function validatePosition(value: unknown): void {
  if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3) || value.some((item) => typeof item !== "number")) {
    throw new TypeError("Coordinate positions must contain two or three numbers");
  }
  const position = value as readonly number[];
  const lon = position[0]!;
  const lat = position[1]!;
  const altitude = position[2];
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new RangeError(`Invalid coordinate: longitude/latitude must be finite and within WGS84 bounds`);
  }
  if (altitude !== undefined && !Number.isFinite(altitude)) throw new RangeError("Elevation must be finite");
}

function validateLineCoordinates(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length < 2) throw new TypeError(`${label} must contain at least two positions`);
  for (const position of value) validatePosition(position);
}

function validateRingCoordinates(value: unknown): void {
  if (!Array.isArray(value) || value.length < 4) throw new TypeError("Polygon rings must contain at least four positions");
  for (const position of value) validatePosition(position);
}

function validatePolygonCoordinates(value: unknown): void {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError("Polygon must contain at least one ring");
  for (const ring of value) {
    validateRingCoordinates(ring);
    const positions = ring as readonly (readonly number[])[];
    const first = positions[0]!;
    const last = positions[positions.length - 1]!;
    if (first[0] !== last[0] || first[1] !== last[1]) throw new TypeError("Polygon rings must be closed");
  }
}

type ExportGeometry = Exclude<GeoJSON.Geometry, GeoJSON.GeometryCollection | GeoJSON.MultiPoint | GeoJSON.MultiPolygon>;

function validateGeometry(geometry: GeoJSON.Geometry): asserts geometry is ExportGeometry {
  if (!("coordinates" in geometry)) throw new TypeError("Geometry coordinates are required");
  switch (geometry.type) {
    case "Point":
      validatePosition(geometry.coordinates);
      return;
    case "LineString":
      validateLineCoordinates(geometry.coordinates, "LineString");
      return;
    case "MultiLineString":
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) throw new TypeError("MultiLineString must contain at least one line");
      for (const line of geometry.coordinates) validateLineCoordinates(line, "MultiLineString lines");
      return;
    case "Polygon":
      validatePolygonCoordinates(geometry.coordinates);
      return;
    default:
      throw new TypeError(`${geometry.type} is not supported by this exporter`);
  }
}

/**
 * Serializes GeoJSON features to GPX 1.1 XML string.
 * Converts Point geometries to <wpt> waypoints and LineString geometries to <trk> tracks.
 */
export function exportToGpx(
  geojson: GeoJSON.FeatureCollection | GeoJSON.Feature[],
  options: GpxExportOptions = {},
): string {
  const features = Array.isArray(geojson) ? geojson : geojson.features || [];
  const creator = options.creator || "MarkMap Field Engine";
  const name = options.name ? `<name>${escapeXml(options.name)}</name>` : "";
  const time = options.time || new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<gpx version="1.1" creator="${escapeXml(creator)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n`;
  xml += `  <metadata>\n    ${name}\n    <time>${escapeXml(time)}</time>\n  </metadata>\n`;

  // Process waypoints first
  for (const feature of features) {
    if (!feature || !feature.geometry) continue;
    validateGeometry(feature.geometry);

    if (feature.geometry.type === "Point") {
      const [lon, lat, ele] = feature.geometry.coordinates as [number, number, number?];
      xml += `  <wpt lat="${lat}" lon="${lon}">\n`;
      if (ele !== undefined) {
        xml += `    <ele>${ele}</ele>\n`;
      }
      if (feature.properties?.name) {
        xml += `    <name>${escapeXml(feature.properties.name)}</name>\n`;
      }
      if (feature.properties?.description || feature.properties?.desc) {
        xml += `    <desc>${escapeXml(feature.properties.description || feature.properties.desc)}</desc>\n`;
      }
      if (feature.properties?.time) {
        xml += `    <time>${escapeXml(feature.properties.time)}</time>\n`;
      }
      xml += "  </wpt>\n";
    }
  }

  // Process LineStrings as Tracks
  for (const feature of features) {
    if (!feature || !feature.geometry) continue;
    validateGeometry(feature.geometry);

    if (feature.geometry.type === "LineString") {
      xml += "  <trk>\n";
      if (feature.properties?.name) {
        xml += `    <name>${escapeXml(feature.properties.name)}</name>\n`;
      }
      xml += "    <trkseg>\n";
      const coords = feature.geometry.coordinates as [number, number, number?][];
      for (const [lon, lat, ele] of coords) {
        xml += `      <trkpt lat="${lat}" lon="${lon}">\n`;
        if (ele !== undefined) {
          xml += `        <ele>${ele}</ele>\n`;
        }
        xml += "      </trkpt>\n";
      }
      xml += "    </trkseg>\n";
      xml += "  </trk>\n";
    } else if (feature.geometry.type === "MultiLineString") {
      xml += "  <trk>\n";
      if (feature.properties?.name) {
        xml += `    <name>${escapeXml(feature.properties.name)}</name>\n`;
      }
      const lines = feature.geometry.coordinates as [number, number, number?][][];
      for (const line of lines) {
        xml += "    <trkseg>\n";
        for (const [lon, lat, ele] of line) {
          xml += `      <trkpt lat="${lat}" lon="${lon}">\n`;
          if (ele !== undefined) {
            xml += `        <ele>${ele}</ele>\n`;
          }
          xml += "      </trkpt>\n";
        }
        xml += "    </trkseg>\n";
      }
      xml += "  </trk>\n";
    }
  }

  xml += "</gpx>\n";
  return xml;
}

/**
 * Serializes GeoJSON features to KML 2.2 XML string.
 * Supports Points, LineStrings, MultiLineStrings, and Polygons.
 */
export function exportToKml(
  geojson: GeoJSON.FeatureCollection | GeoJSON.Feature[],
  options: KmlExportOptions = {},
): string {
  const features = Array.isArray(geojson) ? geojson : geojson.features || [];
  const docName = options.name || "MarkMap Export";
  const docDesc = options.description ? `<description>${escapeXml(options.description)}</description>\n` : "";

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
  xml += '  <Document>\n';
  xml += `    <name>${escapeXml(docName)}</name>\n`;
  if (docDesc) xml += `    ${docDesc}`;

  for (const feature of features) {
    if (!feature || !feature.geometry) continue;
    validateGeometry(feature.geometry);

    xml += "    <Placemark>\n";
    if (feature.properties?.name) {
      xml += `      <name>${escapeXml(feature.properties.name)}</name>\n`;
    }
    if (feature.properties?.description || feature.properties?.desc) {
      xml += `      <description>${escapeXml(feature.properties.description || feature.properties.desc)}</description>\n`;
    }

    const { type, coordinates } = feature.geometry;

    if (type === "Point") {
      const [lon, lat, alt] = coordinates as [number, number, number?];
      const coordStr = alt !== undefined ? `${lon},${lat},${alt}` : `${lon},${lat}`;
      xml += `      <Point>\n        <coordinates>${coordStr}</coordinates>\n      </Point>\n`;
    } else if (type === "LineString") {
      const coords = coordinates as [number, number, number?][];
      const coordStr = coords.map(([lon, lat, alt]) => (alt !== undefined ? `${lon},${lat},${alt}` : `${lon},${lat}`)).join(" ");
      xml += `      <LineString>\n        <coordinates>${coordStr}</coordinates>\n      </LineString>\n`;
    } else if (type === "MultiLineString") {
      const lines = coordinates as [number, number, number?][][];
      xml += "      <MultiGeometry>\n";
      for (const line of lines) {
        const coordStr = line.map(([lon, lat, alt]) => (alt !== undefined ? `${lon},${lat},${alt}` : `${lon},${lat}`)).join(" ");
        xml += `        <LineString>\n          <coordinates>${coordStr}</coordinates>\n        </LineString>\n`;
      }
      xml += "      </MultiGeometry>\n";
    } else if (type === "Polygon") {
      const rings = coordinates as [number, number, number?][][];
      if (rings.length > 0) {
        const outerCoords = rings[0]!.map(([lon, lat, alt]) => (alt !== undefined ? `${lon},${lat},${alt}` : `${lon},${lat}`)).join(" ");
        xml += "      <Polygon>\n";
        xml += `        <outerBoundaryIs>\n          <LinearRing>\n            <coordinates>${outerCoords}</coordinates>\n          </LinearRing>\n        </outerBoundaryIs>\n`;
        // Inner boundaries (holes) if any
        for (let i = 1; i < rings.length; i++) {
          const innerCoords = rings[i]!.map(([lon, lat, alt]) => (alt !== undefined ? `${lon},${lat},${alt}` : `${lon},${lat}`)).join(" ");
          xml += `        <innerBoundaryIs>\n          <LinearRing>\n            <coordinates>${innerCoords}</coordinates>\n          </LinearRing>\n        </innerBoundaryIs>\n`;
        }
        xml += "      </Polygon>\n";
      }
    }

    xml += "    </Placemark>\n";
  }

  xml += "  </Document>\n";
  xml += "</kml>\n";
  return xml;
}
