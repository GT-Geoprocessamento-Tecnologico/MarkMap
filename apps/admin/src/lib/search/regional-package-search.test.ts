import { describe, expect, it } from "vitest";
import { loadRegionalPackageSearch } from "./regional-package-search";
import type { OfflineMapStore } from "../storage/offline-map-store";
const records = [
  {
    id: "way:1",
    name: "Rua Augusta",
    normalized: "rua augusta",
    type: "street",
    category: "road",
    lon: -46.64,
    lat: -23.55,
  },
];
function jsonBlob(payload: unknown): Blob {
  const blob = new Blob([JSON.stringify(payload)]);
  if (typeof blob.text !== "function")
    Object.defineProperty(blob, "text", {
      value: async () => JSON.stringify(payload),
    });
  return blob;
}
function mockStore(payload: unknown, available = true) {
  return {
    getActiveRevision: async () => ({
      manifest: { searchShards: [{ path: "search/r1.json" }] },
      generation: "test-revision",
    }),
    assetAtRevision: async () => (available ? jsonBlob(payload) : null),
  } as unknown as Pick<
    OfflineMapStore,
    "getActiveRevision" | "assetAtRevision"
  >;
}
describe("active offline OSM index loading", () => {
  it("loads namespaced records from stored bytes", async () => {
    const result = await loadRegionalPackageSearch(
      mockStore({ id: "r1", records }),
      "region-a",
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("region-a:way:1");
  });
  it("rejects missing/corrupt records instead of fetching network data", async () => {
    await expect(
      loadRegionalPackageSearch(mockStore({}, false), "a"),
    ).rejects.toThrow("ausente");
    await expect(
      loadRegionalPackageSearch(
        mockStore({ id: "r1", records: [{ ...records[0], lon: 200 }] }),
        "a",
      ),
    ).rejects.toThrow("inválido");
  });
});
