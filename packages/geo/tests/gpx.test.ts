import { describe, it, expect } from "vitest";
import { parseGpx } from "../src/gpx.js";

describe("parseGpx", () => {
  it("parses tracks with segments and points", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Minha Trilha</name>
    <trkseg>
      <trkpt lat="-23.55" lon="-46.63"><ele>850</ele></trkpt>
      <trkpt lat="-23.56" lon="-46.64"><ele>900</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const result = parseGpx(xml);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]!.name).toBe("Minha Trilha");
    expect(result.tracks[0]!.segments).toHaveLength(1);
    expect(result.tracks[0]!.segments[0]!.points).toHaveLength(2);
    expect(result.tracks[0]!.segments[0]!.points[0]!.latitude).toBe(-23.55);
    expect(result.tracks[0]!.segments[0]!.points[0]!.elevation).toBe(850);
  });

  it("parses waypoints", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="-23.55" lon="-46.63">
    <name>POI</name>
    <desc>Uma cachoeira</desc>
  </wpt>
</gpx>`;

    const result = parseGpx(xml);
    expect(result.waypoints).toHaveLength(1);
    expect(result.waypoints[0]!.name).toBe("POI");
    expect(result.waypoints[0]!.description).toBe("Uma cachoeira");
    expect(result.waypoints[0]!.latitude).toBe(-23.55);
  });

  it("parses routes", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>Minha Rota</name>
    <rtept lat="-23.55" lon="-46.63"/>
    <rtept lat="-23.56" lon="-46.64"/>
  </rte>
</gpx>`;

    const result = parseGpx(xml);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]!.name).toBe("Minha Rota");
    expect(result.routes[0]!.points).toHaveLength(2);
  });

  it("rejects invalid coordinates", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="999" lon="999"><name>Invalid</name></wpt>
</gpx>`;

    const result = parseGpx(xml);
    expect(result.waypoints).toHaveLength(0);
  });

  it("throws on invalid XML", () => {
    expect(() => parseGpx("not xml at all")).toThrow();
  });

  it("generates UUIDs for all objects", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>T</name><trkseg><trkpt lat="0" lon="0"/></trkseg></trk>
  <wpt lat="1" lon="1"><name>W</name></wpt>
</gpx>`;

    const result = parseGpx(xml);
    expect(result.tracks[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.waypoints[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("parses multiple segments in one track", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Multi</name>
    <trkseg><trkpt lat="0" lon="0"/><trkpt lat="1" lon="1"/></trkseg>
    <trkseg><trkpt lat="2" lon="2"/><trkpt lat="3" lon="3"/></trkseg>
  </trk>
</gpx>`;

    const result = parseGpx(xml);
    expect(result.tracks[0]!.segments).toHaveLength(2);
    expect(result.tracks[0]!.segments[0]!.points).toHaveLength(2);
    expect(result.tracks[0]!.segments[1]!.points).toHaveLength(2);
  });
});
