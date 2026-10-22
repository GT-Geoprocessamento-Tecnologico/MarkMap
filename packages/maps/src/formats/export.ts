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
    } else if (type === "Polygon") {
      const rings = coordinates as [number, number, number?][][];
      if (rings.length > 0) {
        const outerCoords = rings[0].map(([lon, lat, alt]) => (alt !== undefined ? `${lon},${lat},${alt}` : `${lon},${lat}`)).join(" ");
        xml += "      <Polygon>\n";
        xml += `        <outerBoundaryIs>\n          <LinearRing>\n            <coordinates>${outerCoords}</coordinates>\n          </LinearRing>\n        </outerBoundaryIs>\n`;
        // Inner boundaries (holes) if any
        for (let i = 1; i < rings.length; i++) {
          const innerCoords = rings[i].map(([lon, lat, alt]) => (alt !== undefined ? `${lon},${lat},${alt}` : `${lon},${lat}`)).join(" ");
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
