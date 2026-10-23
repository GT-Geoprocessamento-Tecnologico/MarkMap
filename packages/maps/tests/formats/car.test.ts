import { describe, it, expect } from "vitest";
import { classifyCarLayer, parseCarGeoJson, OFFICIAL_CAR_STYLES } from "../../src/formats/car.js";

describe("CAR (Cadastro Ambiental Rural) Layer Normalizer", () => {
  it("classifies layer names correctly", () => {
    expect(classifyCarLayer("AREA_IMOVEL")).toBe("AREA_IMOVEL");
    expect(classifyCarLayer("APP_PRESERVACAO")).toBe("APP");
    expect(classifyCarLayer("RESERVA_LEGAL_AVERBADA")).toBe("RESERVA_LEGAL");
    expect(classifyCarLayer("USO_RESTRITO_DECLIVIDADE")).toBe("USO_RESTRITO");
    expect(classifyCarLayer("AREA_CONSOLIDADA")).toBe("CONSOLIDADA");
    expect(classifyCarLayer("CAMADA_DESCONHECIDA")).toBe("UNKNOWN");
  });

  it("parses CAR FeatureCollection and attaches official styles and metadata", () => {
    const rawGeoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            cod_imovel: "GO-5201108-8B7C9D01234",
            tipo_tema: "RESERVA_LEGAL",
            num_area: "120.5",
            nom_mun: "Anápolis",
            uf: "GO",
            ind_status: "ATIVO",
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-48.9, -16.3],
                [-48.9, -16.4],
                [-49.0, -16.4],
                [-49.0, -16.3],
                [-48.9, -16.3],
              ],
            ],
          },
        },
      ],
    };

    const parsed = parseCarGeoJson(rawGeoJson);
    expect(parsed).toHaveLength(1);
    const feat = parsed[0]!;
    expect(feat.carCode).toBe("GO-5201108-8B7C9D01234");
    expect(feat.layerType).toBe("RESERVA_LEGAL");
    expect(feat.areaHa).toBe(120.5);
    expect(feat.municipality).toBe("Anápolis");
    expect(feat.state).toBe("GO");
    expect(feat.status).toBe("ATIVO");
    expect(feat.style).toEqual(OFFICIAL_CAR_STYLES.RESERVA_LEGAL);
  });

  it("handles malformed inputs gracefully", () => {
    expect(() => parseCarGeoJson(null)).toThrow(TypeError);
    expect(parseCarGeoJson({ type: "FeatureCollection", features: [] })).toEqual([]);
  });
});
