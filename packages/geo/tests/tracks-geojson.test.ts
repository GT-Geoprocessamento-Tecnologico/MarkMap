import { describe, expect, it } from "vitest";
import { parseGpx } from "../src/gpx.js";
import { parseKml } from "../src/kml.js";
import { tracksToGeoJSON } from "../src/tracks-geojson.js";

describe("GPX/KML -> WGS84 GeoJSON", () => {
  it("preserves waypoint altitude and track segment separation", () => {
    const gpx = `<gpx><trk><name>Trilha</name>
      <trkseg><trkpt lat="-7.18" lon="-48.20"><ele>240</ele></trkpt><trkpt lat="-7.19" lon="-48.21" /></trkseg>
      <trkseg><trkpt lat="-7.20" lon="-48.22" /><trkpt lat="-7.21" lon="-48.23" /></trkseg>
      </trk><wpt lat="-7.3" lon="-48.3"><ele>300</ele><name>Pico</name></wpt></gpx>`;
    const geo = tracksToGeoJSON(parseGpx(gpx));
    expect(geo.features).toHaveLength(3);
    expect(geo.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [-48.3, -7.3, 300],
    });
    expect(geo.features[1]?.properties.segment).toBe(1);
    expect(geo.features[2]?.properties.segment).toBe(2);
  });
  it("converts KML point/lines without using network resources", () => {
    const kml = `<kml><Document><Placemark><name>Porto</name><Point><coordinates>-48.2,-7.2</coordinates></Point></Placemark>
      <Placemark><name>Rota</name><LineString><coordinates>-48.2,-7.2 -48.3,-7.3</coordinates></LineString></Placemark></Document></kml>`;
    const features = tracksToGeoJSON(parseKml(kml)).features;
    expect(features).toHaveLength(2);
    expect(features[0]?.properties.name).toBe("Porto");
    expect(features[1]?.geometry.type).toBe("LineString");
  });
  it("rejects unsafe nonfinite coordinates in conversion", () => {
    expect(() =>
      tracksToGeoJSON({
        waypoints: [{ id: "x", name: "bad", latitude: Infinity, longitude: 0 }],
        tracks: [],
        routes: [],
      }),
    ).toThrow("Coordenada inválida");
  });
  it("keeps separate ids for multiple track segments", () => {
    const geo = tracksToGeoJSON({
      tracks: [
        {
          id: "track",
          name: "T",
          segments: [
            {
              id: "segment-a",
              points: [
                { latitude: 0, longitude: 0 },
                { latitude: 1, longitude: 1 },
              ],
            },
            {
              id: "segment-b",
              points: [
                { latitude: 2, longitude: 2 },
                { latitude: 3, longitude: 3 },
              ],
            },
          ],
        },
      ],
      waypoints: [],
      routes: [],
    });
    expect(geo.features.map((feature) => feature.id)).toEqual([
      "segment-a",
      "segment-b",
    ]);
  });
});

describe("KML polygons", () => {
  it("supports simple filled areas and interior holes", () => {
    const kml =
      "<kml><Placemark><name>Parque</name><Polygon><outerBoundaryIs><LinearRing><coordinates>0,0 1,0 1,1 0,1 0,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>";
    const features = tracksToGeoJSON(parseKml(kml)).features;
    expect(features).toHaveLength(1);
    expect(features[0]?.geometry.type).toBe("Polygon");
  });
});
