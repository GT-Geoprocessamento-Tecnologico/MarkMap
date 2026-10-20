import { describe, it, expect } from "vitest";
import { parseKml } from "../src/kml.js";
import { tracksToGeoJSON } from "../src/tracks-geojson.js";

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

  it("accepts namespaced placemark attributes, MultiGeometry, holes and scalar ExtendedData", () => {
    const kml = `<k:kml xmlns:k="http://www.opengis.net/kml/2.2"><k:Document><k:Folder><k:Placemark id="quadras_aux.1"><k:name>Quadra</k:name><k:ExtendedData><k:Data name="active"><k:value>true</k:value></k:Data><k:SchemaData><k:SimpleData name="quadra">40</k:SimpleData></k:SchemaData></k:ExtendedData><k:MultiGeometry><k:Point><k:coordinates>-48.2,-7.2,250</k:coordinates></k:Point><k:LineString><k:coordinates>-48.2,-7.2 -48.21,-7.21</k:coordinates></k:LineString><k:Polygon><k:outerBoundaryIs><k:LinearRing><k:coordinates>-48.2,-7.2 -48.1,-7.2 -48.1,-7.1 -48.2,-7.2</k:coordinates></k:LinearRing></k:outerBoundaryIs><k:innerBoundaryIs><k:LinearRing><k:coordinates>-48.18,-7.19 -48.12,-7.19 -48.12,-7.13 -48.18,-7.19</k:coordinates></k:LinearRing></k:innerBoundaryIs></k:Polygon></k:MultiGeometry></k:Placemark></k:Folder></k:Document></k:kml>`;
    const result = parseKml(kml);
    expect(result.waypoints[0]).toMatchObject({
      id: "quadras_aux.1",
      elevation: 250,
      properties: { active: "true", quadra: "40" },
    });
    expect(result.tracks[0]?.id).toBe("quadras_aux.1:2");
    expect(result.polygons?.[0]).toMatchObject({
      id: "quadras_aux.1:3",
      properties: { name: "Quadra" },
    });
    expect(result.polygons?.[0]?.rings).toHaveLength(2);
    const geojson = tracksToGeoJSON(result);
    expect(geojson.features.map((feature) => feature.id)).toEqual([
      "quadras_aux.1",
      "quadras_aux.1:2",
      "quadras_aux.1:3",
    ]);
    expect(geojson.features[2]?.properties.quadra).toBe("40");
  });

  it("rejects external XML declarations and malformed XML", () => {
    expect(() => parseKml("<!DOCTYPE kml><kml/>")).toThrow(/unsafe XML/);
    expect(() => parseKml("<kml><Document></kml>")).toThrow(
      /mismatched|incomplete/,
    );
    expect(() =>
      parseKml(
        "<kml><NetworkLink><Link><href>https://example.test/a.kml</href></Link></NetworkLink></kml>",
      ),
    ).toThrow(/NetworkLink/);
  });

  it("can reject every invalid geometry part in strict import mode", () => {
    const kml =
      "<kml><Document><Placemark><MultiGeometry><Point><coordinates>999,999</coordinates></Point><Point><coordinates>-48.2,-7.2</coordinates></Point></MultiGeometry></Placemark></Document></kml>";
    expect(() => parseKml(kml, { strict: true })).toThrow(
      /exactly one|invalid geometry/i,
    );
    expect(parseKml(kml).waypoints).toHaveLength(1);
  });

  it("reserves generated geometry ids across placemarks", () => {
    const kml =
      '<kml><Document><Placemark id="a"><MultiGeometry><Point><coordinates>0,0</coordinates></Point><Point><coordinates>1,1</coordinates></Point></MultiGeometry></Placemark><Placemark id="a:2"><Point><coordinates>2,2</coordinates></Point></Placemark></Document></kml>';
    expect(parseKml(kml).waypoints.map((point) => point.id)).toEqual([
      "a",
      "a:2",
      "a:2:2",
    ]);
  });

  it("rejects unsafe property keys and malformed coordinate tuples", () => {
    expect(() =>
      parseKml(
        '<kml><Placemark><ExtendedData><Data name="__proto__"><value>x</value></Data></ExtendedData><Point><coordinates>-48.2,-7.2</coordinates></Point></Placemark></kml>',
      ),
    ).toThrow(/unsafe scalar/);
    expect(
      parseKml(
        "<kml><Placemark><Point><coordinates>, -7.2</coordinates></Point></Placemark></kml>",
      ).waypoints,
    ).toHaveLength(0);
    expect(() =>
      parseKml(
        "<kml><Placemark><Point><coordinates>-48.2,-7.2 -48.3,-7.3</coordinates></Point></Placemark></kml>",
        { strict: true },
      ),
    ).toThrow(/exactly one/);
  });
});
