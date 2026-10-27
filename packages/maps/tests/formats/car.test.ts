import { describe, it, expect } from "vitest";
import {
  classifyCarLayer,
  parseCarGeoJson,
  computeCarSummary,
  enrichFeatureWithCarStyle,
  enrichGeoJsonWithCarStyles,
  OFFICIAL_CAR_STYLES,
  CAR_LAYER_LABELS,
} from "../../src/formats/car.js";

describe("CAR (Cadastro Ambiental Rural) Layer Normalizer", () => {
  it("classifies layer names correctly for all 6 normative features plus USO_RESTRITO", () => {
    // 1. AREA_IMOVEL
    expect(classifyCarLayer("AREA_IMOVEL")).toBe("AREA_IMOVEL");
    expect(classifyCarLayer("Perímetro do Imóvel")).toBe("AREA_IMOVEL");
    expect(classifyCarLayer("PROPRIEDADE")).toBe("AREA_IMOVEL");

    // 2. RESERVA_LEGAL
    expect(classifyCarLayer("RESERVA_LEGAL_AVERBADA")).toBe("RESERVA_LEGAL");
    expect(classifyCarLayer("Reserva Legal Proposta")).toBe("RESERVA_LEGAL");
    expect(classifyCarLayer("RL")).toBe("RESERVA_LEGAL");
    expect(classifyCarLayer("RL_AVERBADA")).toBe("RESERVA_LEGAL");

    // 3. APP
    expect(classifyCarLayer("APP")).toBe("APP");
    expect(classifyCarLayer("APP_PRESERVACAO")).toBe("APP");
    expect(classifyCarLayer("Área de Preservação Permanente")).toBe("APP");

    // 4. VEG_NATIVA
    expect(classifyCarLayer("VEG_NATIVA")).toBe("VEG_NATIVA");
    expect(classifyCarLayer("Vegetação Nativa")).toBe("VEG_NATIVA");
    expect(classifyCarLayer("Remanescente de Vegetação")).toBe("VEG_NATIVA");

    // 5. HIDROGRAFIA
    expect(classifyCarLayer("HIDROGRAFIA")).toBe("HIDROGRAFIA");
    expect(classifyCarLayer("Curso d'Água")).toBe("HIDROGRAFIA");
    expect(classifyCarLayer("Nascente")).toBe("HIDROGRAFIA");
    expect(classifyCarLayer("Rio / Córrego")).toBe("HIDROGRAFIA");

    // 6. AREA_CONSOLIDADA
    expect(classifyCarLayer("AREA_CONSOLIDADA")).toBe("AREA_CONSOLIDADA");
    expect(classifyCarLayer("Área Consolidada")).toBe("AREA_CONSOLIDADA");
    expect(classifyCarLayer("Uso Consolidado")).toBe("AREA_CONSOLIDADA");
    expect(classifyCarLayer("CONSOLIDADA")).toBe("AREA_CONSOLIDADA");

    // USO_RESTRITO
    expect(classifyCarLayer("USO_RESTRITO_DECLIVIDADE")).toBe("USO_RESTRITO");
    expect(classifyCarLayer("Uso Restrito")).toBe("USO_RESTRITO");

    // UNKNOWN
    expect(classifyCarLayer("CAMADA_DESCONHECIDA")).toBe("UNKNOWN");
    expect(classifyCarLayer("")).toBe("UNKNOWN");
  });

  it("handles diacritics and case insensitivity gracefully", () => {
    expect(classifyCarLayer("área de preservação permanente")).toBe("APP");
    expect(classifyCarLayer("VEGETAÇÃO NATIVA REMANESCENTE")).toBe("VEG_NATIVA");
    expect(classifyCarLayer("córrego ou rio")).toBe("HIDROGRAFIA");
    expect(classifyCarLayer("ÁREA CONSOLIDADA ANTRÓPICA")).toBe("AREA_CONSOLIDADA");
  });

  it("classifies layer types from property bags", () => {
    expect(classifyCarLayer({ nom_tema: "Área de Preservação Permanente" })).toBe("APP");
    expect(classifyCarLayer({ tipo_tema: "RESERVA_LEGAL" })).toBe("RESERVA_LEGAL");
    expect(classifyCarLayer({ classe: "Vegetação Nativa" })).toBe("VEG_NATIVA");
    expect(classifyCarLayer({ tipo: "Curso d'Água" })).toBe("HIDROGRAFIA");
    expect(classifyCarLayer({ layer: "AREA_CONSOLIDADA" })).toBe("AREA_CONSOLIDADA");
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

  it("handles malformed inputs gracefully in parseCarGeoJson", () => {
    expect(() => parseCarGeoJson(null)).toThrow(TypeError);
    expect(parseCarGeoJson({ type: "FeatureCollection", features: [] })).toEqual([]);
  });

  describe("computeCarSummary", () => {
    it("computes comprehensive property summary including % RL and layer breakdowns", () => {
      const features = [
        {
          type: "Feature" as const,
          properties: {
            cod_imovel: "MT-5103403-E5529F1A8C",
            tipo_tema: "AREA_IMOVEL",
            nom_mun: "Cuiabá",
            uf: "MT",
            status: "ATIVO",
            num_area: 500, // 500 ha
          },
          geometry: null,
        },
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "RESERVA_LEGAL",
            num_area: 175, // 175 ha (35%)
          },
          geometry: null,
        },
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "APP",
            num_area: 45, // 45 ha
          },
          geometry: null,
        },
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "VEGETACAO_NATIVA",
            num_area: 120, // 120 ha
          },
          geometry: null,
        },
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "AREA_CONSOLIDADA",
            num_area: 160, // 160 ha
          },
          geometry: null,
        },
      ];

      const summary = computeCarSummary(features);

      expect(summary.isCarDataset).toBe(true);
      expect(summary.carCode).toBe("MT-5103403-E5529F1A8C");
      expect(summary.municipality).toBe("Cuiabá");
      expect(summary.state).toBe("MT");
      expect(summary.status).toBe("ATIVO");

      expect(summary.areaImovelHa).toBe(500);
      expect(summary.areaImovelSqMeters).toBe(5000000);
      expect(summary.areaReservaLegalHa).toBe(175);
      expect(summary.areaReservaLegalSqMeters).toBe(1750000);
      expect(summary.reservaLegalPercent).toBe(35); // 175 / 500 * 100 = 35%

      expect(summary.layers).toHaveLength(5);

      const imovelLayer = summary.layers.find((l) => l.layerType === "AREA_IMOVEL");
      expect(imovelLayer?.label).toBe(CAR_LAYER_LABELS.AREA_IMOVEL);
      expect(imovelLayer?.areaHa).toBe(500);

      const rlLayer = summary.layers.find((l) => l.layerType === "RESERVA_LEGAL");
      expect(rlLayer?.label).toBe(CAR_LAYER_LABELS.RESERVA_LEGAL);
      expect(rlLayer?.areaHa).toBe(175);

      const appLayer = summary.layers.find((l) => l.layerType === "APP");
      expect(appLayer?.areaHa).toBe(45);
    });

    it("calculates geodetic area from geometry when num_area is not provided", () => {
      // 0.01 deg x 0.01 deg polygon near the equator
      const features = [
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "AREA_IMOVEL",
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [-47.0, -15.0],
                [-47.0, -15.01],
                [-47.01, -15.01],
                [-47.01, -15.0],
                [-47.0, -15.0],
              ],
            ],
          },
        },
      ];

      const summary = computeCarSummary(features);
      expect(summary.isCarDataset).toBe(true);
      expect(summary.areaImovelHa).toBeGreaterThan(100);
      expect(summary.areaImovelSqMeters).toBeGreaterThan(1000000);
    });

    it("handles edge case when property has no AREA_IMOVEL layer", () => {
      const features = [
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "RESERVA_LEGAL",
            num_area: 50,
          },
          geometry: null,
        },
      ];

      const summary = computeCarSummary(features);
      expect(summary.isCarDataset).toBe(true);
      expect(summary.areaImovelHa).toBe(0);
      expect(summary.areaReservaLegalHa).toBe(50);
      expect(summary.reservaLegalPercent).toBe(0); // No division by zero
    });

    it("returns isCarDataset false for non-CAR datasets or empty features", () => {
      expect(computeCarSummary([]).isCarDataset).toBe(false);

      const nonCarFeatures = [
        {
          type: "Feature" as const,
          properties: {
            name: "Ponto de Coleta",
            layer: "pontos_campo",
          },
          geometry: null,
        },
      ];
      expect(computeCarSummary(nonCarFeatures).isCarDataset).toBe(false);
    });
  });

  describe("enrichFeatureWithCarStyle & enrichGeoJsonWithCarStyles", () => {
    it("injects data-driven style properties into CAR features", () => {
      const feature = {
        type: "Feature" as const,
        properties: {
          tipo_tema: "RESERVA_LEGAL",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [-48.9, -16.3],
        },
      };

      const enriched = enrichFeatureWithCarStyle(feature);
      expect(enriched.properties?._carFillColor).toBe(OFFICIAL_CAR_STYLES.RESERVA_LEGAL.fillColor);
      expect(enriched.properties?._carStrokeColor).toBe(OFFICIAL_CAR_STYLES.RESERVA_LEGAL.strokeColor);
      expect(enriched.properties?._carLayerType).toBe("RESERVA_LEGAL");
    });

    it("leaves non-CAR feature untouched", () => {
      const feature = {
        type: "Feature" as const,
        properties: {
          name: "Genérico",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [-48.9, -16.3],
        },
      };

      const enriched = enrichFeatureWithCarStyle(feature);
      expect(enriched.properties?._carFillColor).toBeUndefined();
    });

    it("enriches entire FeatureCollection", () => {
      const fc = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            properties: { tipo_tema: "APP" },
            geometry: {
              type: "Point" as const,
              coordinates: [-48.9, -16.3],
            },
          },
        ],
      };

      const enriched = enrichGeoJsonWithCarStyles(fc);
      expect(enriched.features[0]?.properties?._carFillColor).toBe(OFFICIAL_CAR_STYLES.APP.fillColor);
    });
  });
});
