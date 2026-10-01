import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectPdf } from "../../src/pdf/index.js";

/**
 * Regressão com um GeoPDF real de produção.
 *
 * O fixture sintético usado nos demais testes cobre EPSG:4326 e EPSG:32620, o
 * que não representa o que o usuário realmente abre. O
 * `geopdf de araguaina.pdf` é uma carta oficial do IBGE e exercita o defeito
 * mais comum de GeoPDF em produção: declara `/Type /PROJCS /EPSG 3857`
 * (Web Mercator, em metros) mas grava `/GPTS` em graus WGS 84.
 */
const REAL_PDF = "../../geopdf de araguaina.pdf";
const ARAGUAINA = { minLon: -48.24, maxLon: -48.20, minLat: -7.22, maxLat: -7.18 };

describe.skipIf(!existsSync(REAL_PDF))("GeoPDF real (carta de Araguaína/TO)", () => {
  it("lê o georreferenciamento de um PDF de 16 MB", async () => {
    const bytes = new Uint8Array(await readFile(REAL_PDF));
    expect(bytes.byteLength).toBeGreaterThan(1_000_000);

    const inspection = await inspectPdf(bytes, { maxBytes: 64 * 1024 * 1024 });

    expect(inspection.pages).toHaveLength(1);
    const viewport = inspection.pages[0]?.viewports[0];
    expect(viewport).toBeDefined();
    expect(viewport?.profile).toBe("iso-measure-geo");
    expect(viewport?.sourceCrs).toBe("EPSG:4326");
    expect(viewport?.ground).toHaveLength(4);
  }, 120_000);

  it("ancora o PDF no território correto, e não no Golfo de Guiné", async () => {
    const bytes = new Uint8Array(await readFile(REAL_PDF));
    const inspection = await inspectPdf(bytes, { maxBytes: 64 * 1024 * 1024 });
    const ground = inspection.pages[0]?.viewports[0]?.ground ?? [];

    for (const [longitude, latitude] of ground) {
      expect(longitude).toBeGreaterThanOrEqual(ARAGUAINA.minLon);
      expect(longitude).toBeLessThanOrEqual(ARAGUAINA.maxLon);
      expect(latitude).toBeGreaterThanOrEqual(ARAGUAINA.minLat);
      expect(latitude).toBeLessThanOrEqual(ARAGUAINA.maxLat);
    }

    // Lido ao pé da letra como metros Web Mercator, o mesmo PDF cairia perto de
    // (0, 0) no oceano; esta é a regressão que a reconciliação de CRS evita.
    const lons = ground.map(([longitude]) => longitude);
    const lats = ground.map(([, latitude]) => latitude);
    expect(Math.max(...lons) - Math.min(...lons)).toBeGreaterThan(0.01);
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(0.01);
  }, 120_000);

  it("mantém a correspondência entre canto da página e posição no mapa", async () => {
    const bytes = new Uint8Array(await readFile(REAL_PDF));
    const inspection = await inspectPdf(bytes, { maxBytes: 64 * 1024 * 1024 });
    const viewport = inspection.pages[0]?.viewports[0];

    // O canto superior esquerdo da página é o ponto de maior Y entre os
    // controles, e recai no vértice mais a oeste e mais ao norte do mapa.
    const pageYs = (viewport?.controls ?? []).map(([, y]) => y ?? -Infinity);
    const [northWestPageX, northWestPageY] = viewport?.controls[0] ?? [];
    const [northWestLon, northWestLat] = viewport?.ground[0] ?? [];
    expect(northWestPageY).toBe(Math.max(...pageYs));
    expect(northWestLon).toBeCloseTo(-48.2306, 3);
    expect(northWestLat).toBeCloseTo(-7.1942, 3);
    expect(northWestPageX).toBeCloseTo(viewport?.bbox[0] ?? 0, 0);
  }, 120_000);
});
