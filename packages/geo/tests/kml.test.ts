import { describe, it, expect } from "vitest";
import { parseKml } from "../src/kml.js";

describe("parseKml", () => {
  it("parses Point placemarks as waypoints", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Ponto</name>
      <Point><coordinates>-46.63,-23.55,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKml(xml);
    expect(result.waypoints).toHaveLength(1);
    expect(result.waypoints[0]!.name).toBe("Ponto");
    expect(result.waypoints[0]!.latitude).toBe(-23.55);
    expect(result.waypoints[0]!.longitude).toBe(-46.63);
  });

  it("parses LineString placemarks as tracks", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Linha</name>
      <LineString>
        <coordinates>
          -46.63,-23.55,0
          -46.64,-23.56,0
          -46.65,-23.57,0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKml(xml);
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]!.name).toBe("Linha");
    expect(result.tracks[0]!.segments[0]!.points).toHaveLength(3);
  });

  it("rejects invalid coordinates", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Bad</name>
      <Point><coordinates>999,999,0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;

    const result = parseKml(xml);
    expect(result.waypoints).toHaveLength(0);
  });

  it("throws on invalid XML", () => {
    expect(() => parseKml("not xml")).toThrow();
  });

  it("parses multiple placemarks", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark><name>A</name><Point><coordinates>-46.0,-23.0,0</coordinates></Point></Placemark>
    <Placemark><name>B</name><Point><coordinates>-47.0,-24.0,0</coordinates></Point></Placemark>
  </Document>
</kml>`;

    const result = parseKml(xml);
    expect(result.waypoints).toHaveLength(2);
  });
});
