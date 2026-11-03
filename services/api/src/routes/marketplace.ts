import { paginationQuerySchema } from "@markmap/contracts";
import { Hono, type Context } from "hono";
import { z } from "zod";

const catalogQuerySchema = z
  .object({
    category: z.enum(["car", "biomas", "geografia", "hidrografia"]).optional(),
    region: z.string().optional(),
  })
  .merge(paginationQuerySchema);

// Catálogo mockado robusto de dados oficiais em PMTiles (CAR, biomas e bases geográficas)
const MARKETPLACE_ITEMS = [
  {
    id: "car-br-national-2026",
    title: "CAR - Cadastro Ambiental Rural (Consolidado Nacional)",
    category: "car" as const,
    description:
      "Malha oficial de imóveis rurais cadastrados no CAR com polígonos validados para inspeção ambiental.",
    format: "PMTiles" as const,
    sizeBytes: 482500000,
    version: "2026.10",
    region: "BR",
    downloadUrl:
      "https://tiles.markmap.mtsferreira.dev/official/car-br-2026.pmtiles",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    bounds: [-73.9872, -33.7683, -34.7299, 5.2718],
  },
  {
    id: "biomas-ibge-2026",
    title: "Biomas do Brasil - IBGE (Escala 1:250.000)",
    category: "biomas" as const,
    description:
      "Delimitação oficial dos biomas brasileiros (Amazônia, Cerrado, Mata Atlântica, Caatinga, Pampa e Pantanal).",
    format: "PMTiles" as const,
    sizeBytes: 124000000,
    version: "2026.05",
    region: "BR",
    downloadUrl:
      "https://tiles.markmap.mtsferreira.dev/official/biomas-ibge-2026.pmtiles",
    sha256: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    bounds: [-73.9872, -33.7683, -34.7299, 5.2718],
  },
  {
    id: "geografia-base-nacional",
    title: "Base Geográfica Contínua - IBGE 250k",
    category: "geografia" as const,
    description:
      "Limites estaduais, municipais, malha viária federal e localidades em vetor otimizado PMTiles.",
    format: "PMTiles" as const,
    sizeBytes: 310000000,
    version: "2026.09",
    region: "BR",
    downloadUrl:
      "https://tiles.markmap.mtsferreira.dev/official/geografia-base-2026.pmtiles",
    sha256: "f1e2d3c4b5a69876543210fedcba9876543210fedcba9876543210fedcba9876",
    bounds: [-73.9872, -33.7683, -34.7299, 5.2718],
  },
  {
    id: "hidrografia-bacias-nacionais",
    title: "Bacias Hidrográficas e Rios Principais (ANA/IBGE)",
    category: "hidrografia" as const,
    description:
      "Rede hidrográfica nacional, principais rios e bacias hidrográficas para análise espacial.",
    format: "PMTiles" as const,
    sizeBytes: 195000000,
    version: "2026.08",
    region: "BR",
    downloadUrl:
      "https://tiles.markmap.mtsferreira.dev/official/hidrografia-2026.pmtiles",
    sha256: "9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef",
    bounds: [-73.9872, -33.7683, -34.7299, 5.2718],
  },
];

export const marketplaceRoutes = (app: Hono<any, any, any>) => {
  app.get("/marketplace/layers", async (c: Context) => {
    const query = catalogQuerySchema.parse(c.req.query());
    let items = MARKETPLACE_ITEMS;

    if (query.category) {
      items = items.filter((item) => item.category === query.category);
    }
    const region = query.region;
    if (region !== undefined && region.length > 0) {
      const normalizedRegion = region.toLowerCase();
      items = items.filter(
        (item) => item.region.toLowerCase() === normalizedRegion,
      );
    }

    return c.json({
      data: items,
      pagination: {
        total: items.length,
        limit: query.limit ?? 50,
        cursor: null,
      },
    });
  });

  app.get("/marketplace/layers/:id", async (c: Context) => {
    const id = c.req.param("id");
    const item = MARKETPLACE_ITEMS.find((i) => i.id === id);
    if (!item) {
      return c.json(
        {
          error: {
            code: "MARKETPLACE_ITEM_NOT_FOUND",
            message: "Layer not found in official marketplace",
            requestId: c.get("requestId") ?? "unknown",
          },
        },
        404,
      );
    }
    return c.json(item);
  });

  app.post("/marketplace/layers/:id/download-ticket", async (c: Context) => {
    const id = c.req.param("id");
    const item = MARKETPLACE_ITEMS.find((i) => i.id === id);
    if (!item) {
      return c.json(
        {
          error: {
            code: "MARKETPLACE_ITEM_NOT_FOUND",
            message: "Layer not found in official marketplace",
            requestId: c.get("requestId") ?? "unknown",
          },
        },
        404,
      );
    }

    return c.json({
      ticketId: `tkt_${Math.random().toString(36).substring(2, 12)}`,
      itemId: item.id,
      downloadUrl: item.downloadUrl,
      sha256: item.sha256,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  });
};
