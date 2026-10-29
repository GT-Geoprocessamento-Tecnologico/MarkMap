import { describe, expect, it } from "vitest";
import { exportToGpx, exportToKml } from "../../src/formats/export.js";
import { exportToGpx as exportToGpxIndex, exportToKml as exportToKmlIndex } from "../../src/index.js";

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
      // Polygon as track
      expect(gpx).toContain("<name>Área de Preservação</name>");
      expect(gpx).toContain('<trkpt lat="-7.19" lon="-48.2">');
    });

    it("serializes polygons with outer and inner rings as tracks (<trk>) in GPX", () => {
      const polygonFeature: GeoJSON.Feature = {
        type: "Feature",
        properties: {
          name: "Talhão Agrícola 04",
          description: "Área de soja com ilha de vegetação nativa",
          time: "2026-10-27T12:00:00Z",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            // Outer ring
            [
              [-48.2, -7.1],
              [-48.2, -7.2],
              [-48.3, -7.2],
              [-48.3, -7.1],
              [-48.2, -7.1],
            ],
            // Inner ring (hole)
            [
              [-48.22, -7.12],
              [-48.22, -7.18],
              [-48.28, -7.18],
              [-48.28, -7.12],
              [-48.22, -7.12],
            ],
          ],
        },
      };

      const gpx = exportToGpx([polygonFeature], { name: "Talhões GPX" });
      expect(gpx).toContain("<name>Talhões GPX</name>");
      expect(gpx).toContain("<name>Talhão Agrícola 04</name>");
      expect(gpx).toContain("<desc>Área de soja com ilha de vegetação nativa</desc>");
      expect(gpx).toContain("<time>2026-10-27T12:00:00Z</time>");
      // Deve conter 2 <trkseg> (um para outer, outro para inner)
      const trksegMatches = gpx.match(/<trkseg>/g);
      expect(trksegMatches).toHaveLength(2);
      expect(gpx).toContain('<trkpt lat="-7.1" lon="-48.2">');
      expect(gpx).toContain('<trkpt lat="-7.12" lon="-48.22">');
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

    it("rejects non-finite or out-of-range coordinates", () => {
      expect(() => exportToGpx([{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [181, 0] } }])).toThrow(RangeError);
      expect(() => exportToKml([{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [0, Number.NaN] } }])).toThrow(RangeError);
    });

    it("rejects empty and incorrectly nested coordinates", () => {
      const emptyPoint = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [] } } as unknown as GeoJSON.Feature;
      const nestedPoint = { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [[[0, 0]]] } } as unknown as GeoJSON.Feature;
      expect(() => exportToGpx([emptyPoint])).toThrow(TypeError);
      expect(() => exportToKml([emptyPoint])).toThrow(TypeError);
      expect(() => exportToGpx([nestedPoint])).toThrow(TypeError);
      expect(() => exportToKml([nestedPoint])).toThrow(TypeError);
    });

    it("serializes valid multi-line and polygon geometries", () => {
      const features: GeoJSON.Feature[] = [
        {
          type: "Feature",
          properties: { name: "Rotas" },
          geometry: { type: "MultiLineString", coordinates: [[[-48.2, -7.2], [-48.21, -7.21]], [[-48.22, -7.22], [-48.23, -7.23]]] },
        },
        {
          type: "Feature",
          properties: { name: "Área" },
          geometry: { type: "Polygon", coordinates: [[[-48.2, -7.2], [-48.2, -7.21], [-48.21, -7.21], [-48.2, -7.2]]] },
        },
      ];
      expect(exportToGpx(features)).toContain("<trkseg>");
      const kml = exportToKml(features);
      expect(kml).toContain("<MultiGeometry>");
      expect(kml).toContain("-48.2,-7.2 -48.21,-7.21");
      expect(kml).toContain("<Polygon>");
    });

    it("rejects polygon rings shorter than four closed positions", () => {
      const invalid = [{
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Polygon" as const, coordinates: [[[0, 0], [0, 0]]] },
      }];
      expect(() => exportToKml(invalid)).toThrow(TypeError);
    });
  });

  describe("Package Index Exports", () => {
    it("exposes exportToGpx and exportToKml from package index", () => {
      expect(typeof exportToGpxIndex).toBe("function");
      expect(typeof exportToKmlIndex).toBe("function");
    });
  });
});

