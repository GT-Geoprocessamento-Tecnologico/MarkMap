export type BrazilianBiome = "CERRADO" | "AMAZONIA" | "MATA_ATLANTICA" | "CAATINGA" | "PAMPA" | "PANTANAL";

export interface SatelliteProviderConfig {
  biome: BrazilianBiome;
  name: string;
  pmtilesUrl: string;
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
}

export const BRAZILIAN_SATELLITE_CATALOG: Record<BrazilianBiome, SatelliteProviderConfig> = {
  CERRADO: {
    biome: "CERRADO",
    name: "Sentinel-2 Cerrado Regional Mosaic",
    pmtilesUrl: "pmtiles://https://tiles.geonexo.com.br/biomes/cerrado.pmtiles",
    minZoom: 0,
    maxZoom: 16,
    bounds: [-60.0, -24.0, -42.0, -2.0],
  },
  AMAZONIA: {
    biome: "AMAZONIA",
    name: "Sentinel-2 Amazonia Regional Mosaic",
    pmtilesUrl: "pmtiles://https://tiles.geonexo.com.br/biomes/amazonia.pmtiles",
    minZoom: 0,
    maxZoom: 16,
    bounds: [-74.0, -18.0, -44.0, 5.5],
  },
  MATA_ATLANTICA: {
    biome: "MATA_ATLANTICA",
    name: "Sentinel-2 Mata Atlantica Regional Mosaic",
    pmtilesUrl: "pmtiles://https://tiles.geonexo.com.br/biomes/mata-atlantica.pmtiles",
    minZoom: 0,
    maxZoom: 17,
    bounds: [-54.0, -32.0, -34.0, -3.0],
  },
  CAATINGA: {
    biome: "CAATINGA",
    name: "Sentinel-2 Caatinga Regional Mosaic",
    pmtilesUrl: "pmtiles://https://tiles.geonexo.com.br/biomes/caatinga.pmtiles",
    minZoom: 0,
    maxZoom: 16,
    bounds: [-45.0, -18.0, -35.0, -2.0],
  },
  PAMPA: {
    biome: "PAMPA",
    name: "Sentinel-2 Pampa Regional Mosaic",
    pmtilesUrl: "pmtiles://https://tiles.geonexo.com.br/biomes/pampa.pmtiles",
    minZoom: 0,
    maxZoom: 16,
    bounds: [-58.0, -34.0, -49.0, -28.0],
  },
  PANTANAL: {
    biome: "PANTANAL",
    name: "Sentinel-2 Pantanal Regional Mosaic",
    pmtilesUrl: "pmtiles://https://tiles.geonexo.com.br/biomes/pantanal.pmtiles",
    minZoom: 0,
    maxZoom: 16,
    bounds: [-59.0, -22.0, -55.0, -16.0],
  },
};

/**
 * Identifies the Brazilian Biome for a given [longitude, latitude] coordinate.
 */
export function getBrazilianBiomeForCoordinate(coord: [number, number]): BrazilianBiome | null {
  if (!Array.isArray(coord) || coord.length !== 2 || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) {
    throw new TypeError("Coordinate must be a valid [longitude, latitude] pair");
  }

  const [lon, lat] = coord;
  for (const [biomeKey, config] of Object.entries(BRAZILIAN_SATELLITE_CATALOG)) {
    const [minLon, minLat, maxLon, maxLat] = config.bounds;
    if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
      return biomeKey as BrazilianBiome;
    }
  }

  return null;
}
