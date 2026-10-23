import { describe, expect, it } from "vitest";
import { buildLocalMapSearchRecords } from "./local-map-search";

describe("offline indexed feature search", () => {
  it("finds an address from locally saved street and house-number fields", () => {
    const records = buildLocalMapSearchRecords([
      {
        id: 1,
        geometry: { type: "Point", coordinates: [-48.22, -7.19] },
        properties: {
          "addr:street": "Rua das Palmeiras",
          "addr:housenumber": "123",
          "addr:city": "Araguaína",
        },
      },
    ]);
    expect(records[0]?.normalized).toContain("rua das palmeiras 123 araguaina");
    expect(records[0]?.lon).toBeCloseTo(-48.22);
  });
  it("indexes existing local geometries without network access", () => {
    const list = buildLocalMapSearchRecords([
      {
        id: "a",
        geometry: { type: "Point", coordinates: [-48.2, -7.2] },
        properties: { name: "Pico" },
      },
      {
        id: "b",
        geometry: {
          type: "LineString",
          coordinates: [
            [-48.1, -7.1],
            [-48.3, -7.3],
          ],
        },
        properties: { title: "Trilha do Centro" },
      },
      {
        id: "c",
        geometry: { type: "Point", coordinates: [999, 999] },
        properties: { name: "Invalido" },
      },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]?.name).toBe("Pico");
    expect(list[1]?.lon).toBe(-48.1);
    expect(list[1]?.normalized).toBe("trilha do centro");
  });
  it("keeps explicit CEP aliases as metadata", () => {
    const [record] = buildLocalMapSearchRecords([
      {
        id: "cep",
        geometry: { type: "Point", coordinates: [-48.2, -7.2] },
        properties: {
          name: "Local",
          "addr:postcode": "77800-000",
          postal_code: "77800000",
          cep: "77800",
        },
      },
    ]);
    expect(record?.postalCodes).toEqual(["77800000"]);
  });
});
