import { describe, expect, it } from "vitest";
import {
  classifyCarLayer,
  computeCarSummary,
  enrichFeatureWithCarStyle,
  enrichGeoJsonWithCarStyles,
  OFFICIAL_CAR_STYLES,
} from "../../src/formats/car";
import type { GeoNexoFeature } from "@markmap/geo";

describe("CAR Adversarial & Stress Testing", () => {
  describe("classifyCarLayer - Edge Cases & Adversarial Inputs", () => {
    it("handles null, undefined, empty string and non-string types safely", () => {
      expect(classifyCarLayer("")).toBe("UNKNOWN");
      expect(classifyCarLayer(null as unknown as string)).toBe("UNKNOWN");
      expect(classifyCarLayer(undefined as unknown as string)).toBe("UNKNOWN");
      expect(classifyCarLayer(123 as unknown as string)).toBe("UNKNOWN");
      expect(classifyCarLayer({} as Record<string, unknown>)).toBe("UNKNOWN");
    });

    it("resists heavy diacritics, odd casing, whitespace and symbols", () => {
      // APP variations
      expect(classifyCarLayer("   Área de Preservação Permanente   ")).toBe("APP");
      expect(classifyCarLayer("áReA dE pReSeRvAçÃo PeRmAnEnTe (APP)")).toBe("APP");
      expect(classifyCarLayer("APP (Preservação Permanente)")).toBe("APP");

      // Reserva Legal variations
      expect(classifyCarLayer("RESERVA_LEGAL_PROPOSTA")).toBe("RESERVA_LEGAL");
      expect(classifyCarLayer("Reserva Legal Aprovada")).toBe("RESERVA_LEGAL");
      expect(classifyCarLayer("RL_2024")).toBe("RESERVA_LEGAL");
      expect(classifyCarLayer("GLEBA_RL")).toBe("RESERVA_LEGAL");

      // Vegetação Nativa
      expect(classifyCarLayer("Vegetação Nativa em Estágio Médio")).toBe("VEG_NATIVA");
      expect(classifyCarLayer("Remanescente de Vegetacao Nativa")).toBe("VEG_NATIVA");
      expect(classifyCarLayer("VEG_NATIVA_CERRADO")).toBe("VEG_NATIVA");

      // Hidrografia
      expect(classifyCarLayer("Curso d'Água natural")).toBe("HIDROGRAFIA");
      expect(classifyCarLayer("Curso Dagua ate 10 metros")).toBe("HIDROGRAFIA");
      expect(classifyCarLayer("Massa d'Água Artificial / Represa")).toBe("HIDROGRAFIA");
      expect(classifyCarLayer("Córrego / Rio")).toBe("HIDROGRAFIA");
      expect(classifyCarLayer("Nascente pontual")).toBe("HIDROGRAFIA");

      // Área Consolidada & Antrópica
      expect(classifyCarLayer("Área Consolidada por Agricultura")).toBe("AREA_CONSOLIDADA");
      expect(classifyCarLayer("Uso Antrópico Consolidado")).toBe("AREA_CONSOLIDADA");

      // Uso Restrito
      expect(classifyCarLayer("Área de Declividade Acentuada - Uso Restrito")).toBe("USO_RESTRITO");
      expect(classifyCarLayer("Área com Declividade Forte")).toBe("USO_RESTRITO");

      // Área do Imóvel
      expect(classifyCarLayer("Perímetro do Imóvel")).toBe("AREA_IMOVEL");
      expect(classifyCarLayer("Limite da Propriedade")).toBe("AREA_IMOVEL");
    });

    it("accurately handles CAR classification boundaries, underscores and avoids substring collisions", () => {
      // APP com prefixo/sufixo underscore e delimitadores:
      expect(classifyCarLayer("APP_TOPO_MORRO")).toBe("APP");
      expect(classifyCarLayer("APP_NASCENTE")).toBe("APP");
      expect(classifyCarLayer("APP_CURSO_DAGUA")).toBe("APP");
      expect(classifyCarLayer("APP_50M")).toBe("APP");

      // Substring RIO isolada com delimitador para não colidir com palavras do português:
      expect(classifyCarLayer("DECLIVIDADE_SUPERIOR_45")).toBe("USO_RESTRITO");
      expect(classifyCarLayer("USO_AGROPECUARIO")).toBe("AREA_CONSOLIDADA");
      expect(classifyCarLayer("TERRITORIO_INDIGENA")).toBe("UNKNOWN");
      expect(classifyCarLayer("PROPRIETARIO")).toBe("UNKNOWN");
      expect(classifyCarLayer("RELATORIO")).toBe("UNKNOWN");

      // Substring AGUA isolada para não colidir com JAGUAR ou PARAGUAI:
      expect(classifyCarLayer("JAGUAR")).toBe("UNKNOWN");
      expect(classifyCarLayer("PARAGUAI")).toBe("UNKNOWN");

      // Substring NATIVA isolada para não colidir com AREA_ALTERNATIVA:
      expect(classifyCarLayer("AREA_ALTERNATIVA")).toBe("UNKNOWN");
    });

    it("does not falsely classify non-CAR features that contain unrelated words", () => {
      expect(classifyCarLayer("Posto de Saúde Central")).toBe("UNKNOWN");
      expect(classifyCarLayer("Escola Municipal")).toBe("UNKNOWN");
      expect(classifyCarLayer("Loteamento Urbano Quadra 12")).toBe("UNKNOWN");
      expect(classifyCarLayer("Estrada Pavimentada")).toBe("UNKNOWN");
    });
  });

  describe("computeCarSummary - Mathematical and Boundary Stress", () => {
    it("handles empty feature list, non-array inputs gracefully", () => {
      const summary = computeCarSummary([]);
      expect(summary.isCarDataset).toBe(false);
      expect(summary.areaImovelHa).toBe(0);
      expect(summary.areaImovelSqMeters).toBe(0);
      expect(summary.reservaLegalPercent).toBe(0);
      expect(summary.layers).toHaveLength(0);

      // Null or invalid input
      const invalidSummary = computeCarSummary(null as unknown as GeoNexoFeature[]);
      expect(invalidSummary.isCarDataset).toBe(false);
      expect(invalidSummary.reservaLegalPercent).toBe(0);
    });

    it("handles dataset with ONLY Reserva Legal (missing AREA_IMOVEL) without dividing by zero", () => {
      const rlOnlyFeatures = [
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "Reserva Legal",
            num_area: 45.5,
          },
          geometry: null,
        },
      ];

      const summary = computeCarSummary(rlOnlyFeatures);
      expect(summary.isCarDataset).toBe(true);
      expect(summary.areaImovelHa).toBe(0);
      expect(summary.areaReservaLegalHa).toBe(45.5);
      // Division by zero safeguard
      expect(summary.reservaLegalPercent).toBe(0);
      expect(Number.isFinite(summary.reservaLegalPercent)).toBe(true);
      expect(summary.layers).toHaveLength(1);
      expect(summary.layers[0]?.layerType).toBe("RESERVA_LEGAL");
    });

    it("handles dataset where Reserva Legal exceeds property area without NaN/Infinity", () => {
      const exceedingFeatures = [
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "Área do Imóvel",
            num_area: 100,
          },
          geometry: null,
        },
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "Reserva Legal",
            num_area: 125,
          },
          geometry: null,
        },
      ];

      const summary = computeCarSummary(exceedingFeatures);
      expect(summary.isCarDataset).toBe(true);
      expect(summary.areaImovelHa).toBe(100);
      expect(summary.areaReservaLegalHa).toBe(125);
      expect(summary.reservaLegalPercent).toBe(125);
      expect(Number.isFinite(summary.reservaLegalPercent)).toBe(true);
    });

    it("preserves correct geometry geodetic measurement over absent num_area", () => {
      // 100m x 100m square polygon at equator (approx 10,000 m² = 1 ha)
      const polygonFeature = {
        type: "Feature" as const,
        properties: {
          tipo_tema: "Área do Imóvel",
        },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [-48.0, -15.0],
              [-48.0, -15.001],
              [-48.001, -15.001],
              [-48.001, -15.0],
              [-48.0, -15.0],
            ],
          ],
        },
      };

      const summary = computeCarSummary([polygonFeature]);
      expect(summary.isCarDataset).toBe(true);
      expect(summary.areaImovelSqMeters).toBeGreaterThan(1000);
      expect(summary.areaImovelHa).toBeGreaterThan(0.1);
    });

    it("accurately discriminates all 6 normative classes in defined order", () => {
      const allNormativeFeatures = [
        { type: "Feature" as const, properties: { tipo_tema: "Área Consolidada", num_area: 50 }, geometry: null },
        { type: "Feature" as const, properties: { tipo_tema: "Hidrografia", num_area: 5 }, geometry: null },
        { type: "Feature" as const, properties: { tipo_tema: "Vegetação Nativa", num_area: 25 }, geometry: null },
        { type: "Feature" as const, properties: { tipo_tema: "Área de Preservação Permanente", num_area: 15 }, geometry: null },
        { type: "Feature" as const, properties: { tipo_tema: "Reserva Legal", num_area: 20 }, geometry: null },
        { type: "Feature" as const, properties: { tipo_tema: "Área do Imóvel", num_area: 100 }, geometry: null },
      ];

      const summary = computeCarSummary(allNormativeFeatures);
      expect(summary.isCarDataset).toBe(true);
      expect(summary.layers).toHaveLength(6);
      // Expected hierarchy order: AREA_IMOVEL, RESERVA_LEGAL, APP, VEG_NATIVA, HIDROGRAFIA, AREA_CONSOLIDADA
      expect(summary.layers.map((l) => l.layerType)).toEqual([
        "AREA_IMOVEL",
        "RESERVA_LEGAL",
        "APP",
        "VEG_NATIVA",
        "HIDROGRAFIA",
        "AREA_CONSOLIDADA",
      ]);
    });

    it("parses Brazilian comma decimal format in num_area correctly", () => {
      const commaFeatures = [
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "Área do Imóvel",
            num_area: "120,5",
          },
          geometry: null,
        },
        {
          type: "Feature" as const,
          properties: {
            tipo_tema: "Reserva Legal",
            num_area: "24,1",
          },
          geometry: null,
        },
      ];

      const summary = computeCarSummary(commaFeatures);
      expect(summary.isCarDataset).toBe(true);
      expect(summary.areaImovelHa).toBe(120.5);
      expect(summary.areaImovelSqMeters).toBe(1205000);
      expect(summary.areaReservaLegalHa).toBe(24.1);
      expect(summary.areaReservaLegalSqMeters).toBe(241000);
      expect(summary.reservaLegalPercent).toBe(20.0);
    });
  });

  describe("enrichFeatureWithCarStyle - Non-CAR & MapLibre Integrity", () => {
    it("does NOT inject _car styling properties into non-CAR features", () => {
      const nonCarFeature = {
        type: "Feature" as const,
        id: "road-001",
        properties: {
          name: "Rodovia BR-153",
          highway: "primary",
          lanes: 2,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: [[-48.2, -15.3], [-48.1, -15.2]],
        },
      };

      const enriched = enrichFeatureWithCarStyle(nonCarFeature);
      expect(enriched.properties._carFillColor).toBeUndefined();
      expect(enriched.properties._carStrokeColor).toBeUndefined();
      expect(enriched.properties._carFillOpacity).toBeUndefined();
      expect(enriched.properties._carStrokeWidth).toBeUndefined();
      expect(enriched.properties._carLayerType).toBeUndefined();
      // Original properties must be preserved exactly
      expect(enriched.properties.name).toBe("Rodovia BR-153");
      expect(enriched.properties.highway).toBe("primary");
    });

    it("injects exact official CAR styling into CAR features", () => {
      const carFeature = {
        type: "Feature" as const,
        id: "car-app-01",
        properties: {
          tipo_tema: "Área de Preservação Permanente",
          cod_imovel: "TO-1702109-XYZ",
        },
        geometry: null,
      };

      const enriched = enrichFeatureWithCarStyle(carFeature);
      expect(enriched.properties._carLayerType).toBe("APP");
      expect(enriched.properties._carFillColor).toBe(OFFICIAL_CAR_STYLES.APP.fillColor);
      expect(enriched.properties._carFillOpacity).toBe(OFFICIAL_CAR_STYLES.APP.fillOpacity);
      expect(enriched.properties._carStrokeColor).toBe(OFFICIAL_CAR_STYLES.APP.strokeColor);
      expect(enriched.properties._carStrokeWidth).toBe(OFFICIAL_CAR_STYLES.APP.strokeWidth);
      expect(enriched.properties.cod_imovel).toBe("TO-1702109-XYZ");
    });

    it("enrichGeoJsonWithCarStyles safely processes mixed collections without mutation", () => {
      const collection = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "car-rl",
            properties: { tipo_tema: "Reserva Legal" },
            geometry: null,
          },
          {
            type: "Feature" as const,
            id: "generic-building",
            properties: { building: "commercial", fillColor: "#123456" },
            geometry: null,
          },
        ],
      };

      const result = enrichGeoJsonWithCarStyles(collection);
      expect(result.features).toHaveLength(2);

      // Car feature got enriched
      expect(result.features[0]?.properties._carLayerType).toBe("RESERVA_LEGAL");
      expect(result.features[0]?.properties._carFillColor).toBe(OFFICIAL_CAR_STYLES.RESERVA_LEGAL.fillColor);

      // Generic building remained untouched by _carFillColor, preserving custom fillColor
      expect(result.features[1]?.properties._carFillColor).toBeUndefined();
      expect(result.features[1]?.properties.fillColor).toBe("#123456");

      // Verify original object was NOT mutated
      expect((collection.features[0]?.properties as Record<string, unknown>)._carFillColor).toBeUndefined();
    });
  });
});
