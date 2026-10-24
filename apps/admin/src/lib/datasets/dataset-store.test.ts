import { describe, expect, it } from "vitest";
import { MAX_DATASET_FEATURES, parseGeoJSON } from "./dataset-store";

const feature = (coordinates: unknown = [0, 0]) => ({
  type: "Feature",
  properties: { name: "local" },
  geometry: { type: "Point", coordinates },
});

const file = (value: unknown, name = "local.geojson") => {
  const text = JSON.stringify(value);
  const result = new File([text], name, { type: "application/geo+json" });
  if (typeof result.text !== "function")
    Object.defineProperty(result, "text", { value: async () => text });
  return result;
};

describe("dataset import validation", () => {
  it("accepts a valid GeoJSON feature collection", async () => {
    const result = await parseGeoJSON(
      file({ type: "FeatureCollection", features: [feature()] }),
    );
    expect(result.featuresCount).toBe(1);
    expect(result.geojson.features[0]?.geometry).toEqual({
      type: "Point",
      coordinates: [0, 0],
    });
  });

  it("rejects malformed coordinates before local persistence", async () => {
    await expect(
      parseGeoJSON(
        file({ type: "FeatureCollection", features: [feature([181, 0])] }),
      ),
    ).rejects.toThrow("Geometria inválida");
  });

  it("rejects feature collections above the documented cap", async () => {
    const features = Array.from({ length: MAX_DATASET_FEATURES + 1 }, () =>
      feature(),
    );
    await expect(
      parseGeoJSON(file({ type: "FeatureCollection", features })),
    ).rejects.toThrow("10000");
  });

  it("rejects unsupported formats honestly", async () => {
    await expect(parseGeoJSON(file({}, "local.kml"))).rejects.toThrow(
      "Formato não suportado",
    );
  });

  it("rejects a CRS it cannot reproject and a non-finite feature id", async () => {
    // EPSG:9999 não tem definição PROJ registrada, então continua recusado com
    // uma mensagem que diz exatamente o que falta.
    await expect(
      parseGeoJSON(
        file({
          type: "FeatureCollection",
          crs: { name: "urn:ogc:def:crs:EPSG::9999" },
          features: [feature()],
        }),
      ),
    ).rejects.toThrow("EPSG:9999");
    await expect(
      parseGeoJSON(
        file({
          type: "FeatureCollection",
          features: [{ ...feature(), id: Number.NaN }],
        }),
      ),
    ).rejects.toThrow("ID inválido");
  });

  it("reprojects a projected GeoJSON into WGS 84 instead of refusing it", async () => {
    // Araguaína/TO fica na zona UTM 22S (EPSG:31989). O par de metros abaixo é
    // a projeção equivalente; reprojetado precisa cair sobre a cidade.
    const record = await parseGeoJSON(
      file({
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::31989" } },
        features: [
          {
            type: "Feature",
            properties: { name: "p01" },
            geometry: { type: "Point", coordinates: [805940.167, 9204321.051] },
          },
        ],
      }),
    );

    expect(record.crs).toBe("EPSG:4326");
    expect(record.sourceCrs).toBe("EPSG:31989");
    const [longitude, latitude] = (record.geojson.features[0]?.geometry as {
      coordinates: number[];
    }).coordinates;
    expect(longitude).toBeCloseTo(-48.23, 3);
    expect(latitude).toBeCloseTo(-7.19, 3);
  });

  it("reprojects polygons and multipoints, not just points", async () => {
    const record = await parseGeoJSON(
      file({
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: "EPSG:31989" } },
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [805940.17, 9204321.05],
                  [806139.12, 9204319.85],
                  [806139.12, 9204520.26],
                  [805940.17, 9204321.05],
                ],
              ],
            },
          },
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "MultiPoint",
              coordinates: [
                [805940.17, 9204321.05],
                [806139.12, 9204520.26],
              ],
            },
          },
        ],
      }),
    );

    const ring = (record.geojson.features[0]?.geometry as {
      coordinates: number[][][];
    }).coordinates[0]!;
    expect(ring).toHaveLength(4);
    for (const [longitude, latitude] of ring) {
      expect(longitude).toBeCloseTo(-48.23, 2);
      expect(latitude).toBeCloseTo(-7.19, 2);
    }

    const multi = (record.geojson.features[1]?.geometry as {
      coordinates: number[][];
    }).coordinates;
    expect(multi).toHaveLength(2);
    expect(multi[0]?.[0]).toBeCloseTo(-48.23, 2);
  });

  it("reprojects geometries with hundreds of vertices, not just small ones", async () => {
    // Um eixo de estrada ou uma confrontação tem centenas de vértices. Um
    // guarda por largura do array rejeitava a partir de 81 posições, que é o
    // caso comum de um levantamento — e a mensagem falava de "profundidade".
    const line = Array.from({ length: 400 }, (_, index) => [
      805940 + index * 12.5,
      9204321 - index * 3.25,
    ]);
    const ring = [
      ...Array.from({ length: 150 }, (_, i) => [805940 + i * 6, 9204321]),
      ...Array.from({ length: 150 }, (_, i) => [806834, 9204321 - i * 6]),
      ...Array.from({ length: 150 }, (_, i) => [806834 - i * 6, 9202421]),
      ...Array.from({ length: 150 }, (_, i) => [805940, 9202421 + i * 6]),
      [805940, 9204321],
    ];
    const record = await parseGeoJSON(
      file({
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: "EPSG:31989" } },
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: line },
          },
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [ring] },
          },
          {
            type: "Feature",
            properties: {},
            geometry: { type: "MultiPoint", coordinates: line.slice(0, 120) },
          },
        ],
      }),
    );

    expect(record.geojson.features).toHaveLength(3);
    const out = (record.geojson.features[0]?.geometry as { coordinates: number[][] })
      .coordinates;
    expect(out).toHaveLength(400);
    expect(out[0]?.[0]).toBeCloseTo(-48.23, 2);
    // A linha corre para leste, então a longitude aumenta ao longo dos vértices.
    expect(out[399]?.[0]).toBeGreaterThan(out[0]?.[0] ?? 0);
    expect(out[0]?.[1]).toBeCloseTo(-7.19, 2);
  });

  it("rejeita geometria realmente profunda em vez de estourar a pilha", async () => {
    const deep = Array.from({ length: 30 }, () => 1) as unknown;
    let nested: unknown = deep;
    for (let i = 0; i < 30; i += 1) nested = [nested];
    await expect(
      parseGeoJSON(
        file({
          type: "FeatureCollection",
          crs: { type: "name", properties: { name: "EPSG:31989" } },
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: nested },
            },
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  it("reprojects Web Mercator to WGS 84", async () => {
    const record = await parseGeoJSON(
      file({
        type: "FeatureCollection",
        crs: { type: "name", properties: { name: "EPSG:3857" } },
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [-5368939.04, -802496.13] },
          },
        ],
      }),
    );

    const [longitude, latitude] = (record.geojson.features[0]?.geometry as {
      coordinates: number[];
    }).coordinates;
    expect(longitude).toBeCloseTo(-48.23, 3);
    expect(latitude).toBeCloseTo(-7.19, 3);
  });
});
