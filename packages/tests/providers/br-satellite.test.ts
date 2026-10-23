import { describe, it, expect } from "vitest";
import { getBrazilianBiomeForCoordinate, BRAZILIAN_SATELLITE_CATALOG } from "../../src/providers/br-satellite.js";

describe("Brazilian Satellite Imagery Catalog & Biome Provider", () => {
  it("correctly identifies biomes by coordinate", () => {
    // Brasília (approx, Cerrado)
    expect(getBrazilianBiomeForCoordinate([-47.9, -15.8])).toBe("CERRADO");

    // Manaus (approx, Amazônia)
    expect(getBrazilianBiomeForCoordinate([-60.0, -3.1])).toBe("AMAZONIA");

    // Porto Alegre (approx, Pampa)
    expect(getBrazilianBiomeForCoordinate([-51.2, -30.0])).toBe("PAMPA");
  });

  it("returns null for coordinates outside mapped biomes", () => {
    expect(getBrazilianBiomeForCoordinate([0, 0])).toBeNull();
  });

  it("provides valid PMTiles URL for all biomes", () => {
    for (const config of Object.values(BRAZILIAN_SATELLITE_CATALOG)) {
      expect(config.pmtilesUrl).toMatch(/^pmtiles:\/\/https:\/\/.+\.pmtiles$/);
    }
  });
});
