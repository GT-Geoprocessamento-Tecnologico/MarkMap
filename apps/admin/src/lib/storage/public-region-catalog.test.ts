import { describe, expect, it, vi } from "vitest";
import { fetchPublicRegionCatalog, parsePublicRegionCatalog, regionCoversPoint, normalizeRegionSearch, recommendLocalRegion } from "./public-region-catalog";

const entry = {
  id: "br-teste", label: "Região de teste", area: "Brasil",
  manifestUrl: "https://maps.example.org/regiao/manifest.json",
  bounds: [-49, -8, -47, -6], sizeBytes: 5_000_000, attribution: "Dados licenciados",
} as const;

describe("public offline region catalog", () => {
  it("recommends a matching city rather than a larger state, never a distant map", () => {
    const first = { ...entry, id: "brasil", bounds: [-74, -34, -34, 6] as const };
    const city = { ...entry, id: "city" };
    expect(recommendLocalRegion([first, city], [-48, -7])?.id).toBe("city");
    expect(recommendLocalRegion([first, city], [0, 0])).toBeNull();
  });
  it("finds a city even if the user types without accents", () => {
    expect(normalizeRegionSearch("Araguaína")).toBe(normalizeRegionSearch("araguaina"));
  });
  it("accepts published region metadata and matches visible map coordinates", () => {
    const [region] = parsePublicRegionCatalog({ version: 1, regions: [entry] });
    expect(regionCoversPoint(region!, [-48, -7])).toBe(true);
    expect(regionCoversPoint(region!, [-43, -7])).toBe(false);
  });
  it("rejects duplicate IDs, credentials, HTTP and broken bounds", () => {
    expect(() => parsePublicRegionCatalog({ version: 1, regions: [entry, entry] })).toThrow();
    for (const manifestUrl of [
      "http://example.org/regiao/manifest.json",
      "https://user:pass@example.org/regiao/manifest.json",
      "https://example.org/regiao/manifest.json?token=secret",
    ]) {
      expect(() => parsePublicRegionCatalog({
        version: 1, regions: [{ ...entry, manifestUrl }],
      })).toThrow();
    }
    expect(() => parsePublicRegionCatalog({
      version: 1, regions: [{ ...entry, bounds: [-49, 20, -47, 19] }],
    })).toThrow();
  });
  it("rejects unknown fields, oversize packages and non-versioned catalogs", () => {
    expect(() => parsePublicRegionCatalog({ version: 2, regions: [] })).toThrow();
    expect(() => parsePublicRegionCatalog({
      version: 1, regions: [{ ...entry, token: "secret" }],
    })).toThrow();
    expect(() => parsePublicRegionCatalog({
      version: 1, regions: [{ ...entry, sizeBytes: 260 * 1024 * 1024 }],
    })).toThrow();
  });
  it("loads only same-origin metadata without cookies or redirects", async () => {
    const body = JSON.stringify({ version: 1, regions: [entry] });
    const fetcher = vi.fn(async () => new Response(body, { status: 200 }));
    const regions = await fetchPublicRegionCatalog(undefined, fetcher as typeof fetch);
    expect(regions).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith("/maps/catalog.json",
      expect.objectContaining({ credentials: "omit", redirect: "error", cache: "no-store" }));
  });
  it("rejects an unbounded or unavailable remote catalog", async () => {
    const huge = JSON.stringify({ version: 1, regions: [], pad: "x".repeat(70_000) });
    await expect(fetchPublicRegionCatalog(undefined, async () =>
      new Response(huge) as Response)).rejects.toThrow("limite");
    await expect(fetchPublicRegionCatalog(undefined, async () =>
      new Response("", { status: 404 }) as Response)).rejects.toThrow("indisponível");
  });
});
