import { describe, expect, it, vi } from "vitest";
import {
  collectVisibleMapSearch,
  MAX_VISIBLE_MAP_RECORDS,
  type SearchableMap,
} from "./visible-map-search";
import { searchIndex } from "@markmap/maps/search";

const point = (name: string, coordinates = [-48.2, -7.2]) => ({
  type: "Feature",
  properties: { name },
  geometry: { type: "Point", coordinates },
});
function mapFixture(features: unknown[], local = true) {
  return {
    getStyle: () => ({
      sources: {
        basemap: {
          type: "vector",
          url: local
            ? "pmtiles://geonexo-offline:mkabc"
            : "https://tiles.example.test/data.json",
        },
      },
    }),
    getBounds: () => ({
      contains: ([lon, lat]: number[]) =>
        lon! >= -48.3 && lon! <= -48.1 && lat! >= -7.3 && lat! <= -7.1,
    }),
    querySourceFeatures: vi.fn(
      (_id: string, options: { sourceLayer: string }) =>
        options.sourceLayer === "roads" ? features : [],
    ),
  };
}

describe("searching names already decoded from local PMTiles", () => {
  it("makes a real named street searchable with accent-free city text without inventing house numbers", () => {
    const map = mapFixture([point("Avenida Filadélfia")]);
    const records = collectVisibleMapSearch(
      map as unknown as SearchableMap,
      "br-araguaina",
      "Araguaína",
    );
    const hit = searchIndex(records, { query: "avenida filadelfia araguaina" })
      .results[0];
    expect(hit?.name).toBe("Avenida Filadélfia · Araguaína");
    expect(hit?.category).toBe("via");
    expect([hit?.lon, hit?.lat]).toEqual([-48.2, -7.2]);
    expect(
      searchIndex(records, { query: "avenida filadelfia 123" }).results,
    ).toEqual([]);
  });
  it("ignores online sources and absent package selection", () => {
    const online = mapFixture([point("Rua")], false);
    expect(
      collectVisibleMapSearch(online as unknown as SearchableMap, "br-uf-to"),
    ).toEqual([]);
    expect(online.querySourceFeatures).not.toHaveBeenCalled();
    expect(
      collectVisibleMapSearch(mapFixture([]) as unknown as SearchableMap, ""),
    ).toEqual([]);
  });
  it("deduplicates tile fragments and rejects malformed or off-screen coordinates", () => {
    const map = mapFixture([
      point("Rua da Arruda"),
      point("Rua da Arruda"),
      point("Outra", [-40, 0]),
      point("Inválida", [NaN, -7.2]),
      { properties: { name: "Sem geometria" }, geometry: null },
      {
        properties: { name: "Rio Lontra" },
        geometry: {
          type: "LineString",
          coordinates: [
            [-48.21, -7.21],
            [-48.2, -7.2],
            [-48.19, -7.19],
          ],
        },
      },
    ]);
    const records = collectVisibleMapSearch(
      map as unknown as SearchableMap,
      "br-araguaina",
    );
    expect(records.map((x) => x.name)).toEqual(["Rua da Arruda", "Rio Lontra"]);
    expect(records[1]?.lon).toBe(-48.2);
  });
  it("bounds the in-memory search index", () => {
    const map = mapFixture(
      Array.from({ length: MAX_VISIBLE_MAP_RECORDS + 10 }, (_, i) =>
        point(`Rua ${i}`),
      ),
    );
    expect(
      collectVisibleMapSearch(map as unknown as SearchableMap, "br-araguaina"),
    ).toHaveLength(MAX_VISIBLE_MAP_RECORDS);
  });
  it("passes an explicit tile CEP through with its real feature position", () => {
    const map = mapFixture([
      { ...point("Local"), properties: { name: "Local", cep: "77800000" } },
    ]);
    const record = collectVisibleMapSearch(
      map as unknown as SearchableMap,
      "br-araguaina",
    )[0];
    expect(record?.postalCodes).toEqual(["77800000"]);
    expect([record?.lon, record?.lat]).toEqual([-48.2, -7.2]);
  });
});
