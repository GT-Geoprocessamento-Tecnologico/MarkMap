import { describe, expect, it } from "vitest";
import { exportToGpx, exportToKml } from "../../src/formats/export.js";

describe("Vector Export Engine - GPX and KML", () => {
  const sampleFeatures: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "wpt-1",
        properties: {
          name: "Vértice V-01",
          description: "Marco de concreto",
          ele: 215.4,
          time: "2026-10-21T10:00:00Z",
        },
        geometry: {
          type: "Point",
          coordinates: [-48.2045, -7.1932, 215.4],
        },
      },
      {
        type: "Feature",
        id: "trk-1",
        properties: {
          name: "Trilha Principal",
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [-48.2045, -7.1932, 200],
            [-48.205, -7.194, 205],
            [-48.206, -7.195, 210],
          ],
        },
      },
      {
        type: "Feature",
        id: "poly-1",
        properties: {
          name: "Área de Preservação",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-48.2, -7.19],
              [-48.2, -7.2],
              [-48.21, -7.2],
              [-48.21, -7.19],
              [-48.2, -7.19],
            ],
          ],
        },
      },
    ],
  };

  describe("GPX 1.1 Exporter", () => {
    it("serializes points as waypoints (<wpt>) and lines as tracks (<trk>)", () => {
      const gpx = exportToGpx(sampleFeatures, { name: "Levantamento de Campo" });

      expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(gpx).toContain('<gpx version="1.1"');
      expect(gpx).toContain("<name>Levantamento de Campo</name>");

      // Waypoint
      expect(gpx).toContain('<wpt lat="-7.1932" lon="-48.2045">');
      expect(gpx).toContain("<name>Vértice V-01</name>");
      expect(gpx).toContain("<desc>Marco de concreto</desc>");
      expect(gpx).toContain("<ele>215.4</ele>");

      // Track
      expect(gpx).toContain("<trk>");
      expect(gpx).toContain("<name>Trilha Principal</name>");
      expect(gpx).toContain("<trkseg>");
      expect(gpx).toContain('<trkpt lat="-7.1932" lon="-48.2045">');
      expect(gpx).toContain('<trkpt lat="-7.195" lon="-48.206">');
    });

    it("handles empty feature collection gracefully", () => {
      const gpx = exportToGpx({ type: "FeatureCollection", features: [] });
      expect(gpx).toContain("<gpx");
      expect(gpx).toContain("</gpx>");
    });
  });

  describe("KML 2.2 Exporter", () => {
    it("serializes points, lines and polygons into KML placemarks", () => {
      const kml = exportToKml(sampleFeatures, { name: "Projeto Georreferenciado" });

      expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
      expect(kml).toContain("<name>Projeto Georreferenciado</name>");

      // Point placemark
      expect(kml).toContain("<Placemark>");
      expect(kml).toContain("<name>Vértice V-01</name>");
      expect(kml).toContain("<Point>");
      expect(kml).toContain("<coordinates>-48.2045,-7.1932,215.4</coordinates>");

      // Line placemark
      expect(kml).toContain("<LineString>");
      expect(kml).toContain("-48.2045,-7.1932,200 -48.205,-7.194,205 -48.206,-7.195,210");

      // Polygon placemark
      expect(kml).toContain("<Polygon>");
      expect(kml).toContain("<outerBoundaryIs>");
      expect(kml).toContain("<LinearRing>");
      expect(kml).toContain("<coordinates>-48.2,-7.19 -48.2,-7.2 -48.21,-7.2 -48.21,-7.19 -48.2,-7.19</coordinates>");
    });
  });
});
