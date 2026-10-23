import { describe, it, expect } from "vitest";
import {
  parseEpsgCode,
  getEpsgDefinition,
  registerEpsgDefinition,
  ensureEpsgRegistered,
  transformCoordinates,
  reprojectGeoJsonGeometry,
  reprojectFeatureCollection,
  EPSG_WGS84,
  EPSG_WEB_MERCATOR,
  EPSG_SIRGAS2000,
  EPSG_SAD69,
} from "../../src/crs/epsg.js";

describe("EPSG Dynamic CRS & Proj4js Integration", () => {
  it("parses EPSG codes from numbers, text, and URNs", () => {
    expect(parseEpsgCode(4326)).toBe(4326);
    expect(parseEpsgCode("4326")).toBe(4326);
    expect(parseEpsgCode("EPSG:4326")).toBe(4326);
    expect(parseEpsgCode("epsg:31982")).toBe(31982);
    expect(parseEpsgCode("urn:ogc:def:crs:EPSG::3857")).toBe(3857);
    expect(parseEpsgCode("http://www.opengis.net/def/crs/EPSG/0/4674")).toBe(4674);
    expect(parseEpsgCode("invalid")).toBeNull();
    expect(parseEpsgCode(-5)).toBeNull();
  });

  it("has built-in definitions for Brazilian and standard datums", () => {
    expect(getEpsgDefinition(EPSG_WGS84)).toContain("+datum=WGS84");
    expect(getEpsgDefinition(EPSG_WEB_MERCATOR)).toContain("+proj=merc");
    expect(getEpsgDefinition(EPSG_SIRGAS2000)).toContain("+ellps=GRS80");
    expect(getEpsgDefinition(EPSG_SAD69)).toContain("+ellps=aust_SA");
    // SIRGAS 2000 UTM Zone 22S (EPSG 31982)
    expect(getEpsgDefinition(31982)).toContain("+zone=22 +south");
  });

  it("transforms coordinates between WGS84, Web Mercator, and SIRGAS 2000 UTM", () => {
    // Brasília center: ~ -47.8825, -15.7942 (Zone 23S)
    const wgs84: [number, number, number] = [-47.8825, -15.7942, 1100];
    const sirgasUtm23s = 31983;

    const utm = transformCoordinates(wgs84, EPSG_WGS84, sirgasUtm23s);
    expect(utm).not.toBeNull();
    expect(utm![0]).toBeGreaterThan(100000);
    expect(utm![1]).toBeGreaterThan(8000000);
    expect(utm![2]).toBe(1100); // Preserves elevation

    // Invert back to WGS84
    const back = transformCoordinates(utm!, sirgasUtm23s, EPSG_WGS84);
    expect(back).not.toBeNull();
    expect(back![0]).toBeCloseTo(-47.8825, 4);
    expect(back![1]).toBeCloseTo(-15.7942, 4);
    expect(back![2]).toBe(1100);
  });

  it("dynamically registers custom or obscure EPSG codes on the fly", () => {
    const customEpsg = 99999;
    const customDef = "+proj=laea +lat_0=-15 +lon_0=-47 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";

    expect(getEpsgDefinition(customEpsg)).toBeNull();
    registerEpsgDefinition(customEpsg, customDef);
    expect(getEpsgDefinition(customEpsg)).toBe(customDef);

    const pt = transformCoordinates([-47, -15], EPSG_WGS84, customEpsg);
    expect(pt).not.toBeNull();
    expect(pt![0]).toBeCloseTo(0, 1);
    expect(pt![1]).toBeCloseTo(0, 1);
  });

  it("handles non-finite and malformed coordinates gracefully", () => {
    expect(transformCoordinates([NaN, 10], EPSG_WGS84, 3857)).toBeNull();
    expect(transformCoordinates([10, Infinity], EPSG_WGS84, 3857)).toBeNull();
    expect(transformCoordinates([], EPSG_WGS84, 3857)).toBeNull();
  });

  it("reprojects GeoJSON FeatureCollections and geometries", () => {
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
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
          properties: { name: "Talhão 1" },
        },
      ],
    };

    // Reproject to SIRGAS 2000 UTM Zone 22S (31982)
    const reprojected = reprojectFeatureCollection(geojson, EPSG_WGS84, 31982);
    expect(reprojected.features).toHaveLength(1);
    const poly = reprojected.features[0]!.geometry as GeoJSON.Polygon;
    expect(poly.type).toBe("Polygon");
    const firstCoord = poly.coordinates[0]![0]!;
    // Easting should be around 800,000m, Northing around 9,200,000m in UTM 22S
    expect(firstCoord[0]).toBeGreaterThan(700000);
    expect(firstCoord[1]).toBeGreaterThan(9000000);
    expect(reprojected.features[0]!.properties?.name).toBe("Talhão 1");

    // Convert back to WGS84
    const backToWgs84 = reprojectFeatureCollection(reprojected, 31982, EPSG_WGS84);
    const backCoord = (backToWgs84.features[0]!.geometry as GeoJSON.Polygon).coordinates[0]![0]!;
    expect(backCoord[0]).toBeCloseTo(-48.2, 4);
    expect(backCoord[1]).toBeCloseTo(-7.19, 4);
  });
});

