import { describe, expect, it } from "vitest";
import {
  computeCarSummary,
  enrichFeatureWithCarStyle,
  OFFICIAL_CAR_STYLES,
} from "@markmap/maps";
import { createPropertyPopupContent } from "./property-popup";

/**
 * Evaluates MapLibre coalesce expressions locally matching the paint spec in CommandCenterPage.tsx:
 *   "fill-color": ["coalesce", ["get", "_carFillColor"], ["get", "fillColor"], "#0ea5e9"]
 *   "fill-opacity": ["coalesce", ["get", "_carFillOpacity"], ["get", "fillOpacity"], 0.4]
 *   "line-color": ["coalesce", ["get", "_carStrokeColor"], ["get", "strokeColor"], "#0284c7"]
 *   "line-width": ["coalesce", ["get", "_carStrokeWidth"], ["get", "strokeWidth"], 2]
 */
function evaluateMapLibrePaint(featureProps: Record<string, unknown> | null | undefined) {
  const props = featureProps ?? {};
  return {
    fillColor: props._carFillColor ?? props.fillColor ?? "#0ea5e9",
    fillOpacity: props._carFillOpacity ?? props.fillOpacity ?? 0.4,
    lineColor: props._carStrokeColor ?? props.strokeColor ?? "#0284c7",
    lineWidth: props._carStrokeWidth ?? props.strokeWidth ?? 2,
  };
}

describe("MapLibre CAR Data-Driven Styling & Non-CAR Dataset Integrity", () => {
  describe("Expressões Paint do MapLibre em Datasets NÃO-CAR", () => {
    it("preserves standard fallback styling (#0ea5e9 fill, #0284c7 stroke) when feature has no CAR properties", () => {
      const genericFeature = {
        type: "Feature" as const,
        id: "feat-1",
        properties: {
          name: "Lote Urbano 42",
          bairro: "Centro",
        },
        geometry: null,
      };

      const enriched = enrichFeatureWithCarStyle(genericFeature);
      const paint = evaluateMapLibrePaint(enriched.properties);

      // Verificação de isolamento: NENHUM atributo CAR injetado
      expect(enriched.properties._carFillColor).toBeUndefined();
      expect(enriched.properties._carLayerType).toBeUndefined();

      // Pintura avaliada pelo MapLibre deve ser o azul padrão
      expect(paint.fillColor).toBe("#0ea5e9");
      expect(paint.lineColor).toBe("#0284c7");
      expect(paint.fillOpacity).toBe(0.4);
      expect(paint.lineWidth).toBe(2);
    });

    it("respects custom fillColor and strokeColor on non-CAR datasets", () => {
      const customStyledFeature = {
        type: "Feature" as const,
        id: "feat-custom",
        properties: {
          name: "Área de Risco Geotécnico",
          fillColor: "#dc2626",
          strokeColor: "#991b1b",
          fillOpacity: 0.6,
          strokeWidth: 3,
        },
        geometry: null,
      };

      const enriched = enrichFeatureWithCarStyle(customStyledFeature);
      const paint = evaluateMapLibrePaint(enriched.properties);

      // Não sofre interferência do CAR
      expect(enriched.properties._carFillColor).toBeUndefined();

      // Customização do usuário preservada
      expect(paint.fillColor).toBe("#dc2626");
      expect(paint.lineColor).toBe("#991b1b");
      expect(paint.fillOpacity).toBe(0.6);
      expect(paint.lineWidth).toBe(3);
    });

    it("safely handles features with null or undefined properties", () => {
      const nullPropsFeature = {
        type: "Feature" as const,
        id: "feat-null-props",
        properties: null,
        geometry: null,
      };

      const enriched = enrichFeatureWithCarStyle(nullPropsFeature);
      const paint = evaluateMapLibrePaint(enriched.properties);

      expect(paint.fillColor).toBe("#0ea5e9");
      expect(paint.lineColor).toBe("#0284c7");
      expect(paint.fillOpacity).toBe(0.4);
      expect(paint.lineWidth).toBe(2);
    });
  });

  describe("Expressões Paint do MapLibre em Feições CAR", () => {
    it.each([
      ["AREA_IMOVEL", "Área do Imóvel", OFFICIAL_CAR_STYLES.AREA_IMOVEL],
      ["RESERVA_LEGAL", "Reserva Legal Proposta", OFFICIAL_CAR_STYLES.RESERVA_LEGAL],
      ["APP", "Área de Preservação Permanente", OFFICIAL_CAR_STYLES.APP],
      ["VEG_NATIVA", "Vegetação Nativa", OFFICIAL_CAR_STYLES.VEG_NATIVA],
      ["HIDROGRAFIA", "Curso D'água", OFFICIAL_CAR_STYLES.HIDROGRAFIA],
      ["AREA_CONSOLIDADA", "Área Consolidada", OFFICIAL_CAR_STYLES.AREA_CONSOLIDADA],
      ["USO_RESTRITO", "Declividade Acentuada - Uso Restrito", OFFICIAL_CAR_STYLES.USO_RESTRITO],
    ])("correctly applies official styling for %s (%s)", (expectedType, temaString, expectedStyle) => {
      const carFeature = {
        type: "Feature" as const,
        id: `car-${expectedType}`,
        properties: {
          tipo_tema: temaString,
          cod_imovel: "GO-5201108-XYZ",
        },
        geometry: null,
      };

      const enriched = enrichFeatureWithCarStyle(carFeature);
      expect(enriched.properties._carLayerType).toBe(expectedType);

      const paint = evaluateMapLibrePaint(enriched.properties);
      expect(paint.fillColor).toBe(expectedStyle.fillColor);
      expect(paint.lineColor).toBe(expectedStyle.strokeColor);
      expect(paint.fillOpacity).toBe(expectedStyle.fillOpacity);
      expect(paint.lineWidth).toBe(expectedStyle.strokeWidth);
    });
  });

  describe("Dataset Não-CAR não ativa CarSummaryCard no CommandCenterPage", () => {
    it("reports isCarDataset = false for non-environmental datasets", () => {
      const urbanDatasetFeatures = [
        {
          type: "Feature" as const,
          properties: { name: "Quadra 1", uso: "residencial", area: 1200 },
          geometry: null,
        },
        {
          type: "Feature" as const,
          properties: { name: "Quadra 2", uso: "comercial", area: 850 },
          geometry: null,
        },
      ];

      const summary = computeCarSummary(urbanDatasetFeatures);
      expect(summary.isCarDataset).toBe(false);
      expect(summary.layers).toHaveLength(0);
    });
  });

  describe("Property Popup Integrity with CAR and Non-CAR Data", () => {
    it("formats popup correctly for non-CAR feature without showing empty CAR fields", () => {
      const popupDiv = createPropertyPopupContent({
        name: "Lote 15",
        area: "450 m²",
        owner: "João da Silva",
      });

      expect(popupDiv.textContent).toContain("Lote 15");
      expect(popupDiv.textContent).toContain("Área: 450 m²");
      expect(popupDiv.textContent).toContain("Proprietário: João da Silva");
      expect(popupDiv.textContent).not.toContain("CAR:");
      expect(popupDiv.textContent).not.toContain("Camada:");
      expect(popupDiv.textContent).not.toContain("Status:");
    });

    it("formats popup correctly for CAR feature including CAR code, municipality, status and layer", () => {
      const popupDiv = createPropertyPopupContent({
        name: "Fazenda Esperança",
        area: "120 ha",
        owner: "Maria Souza",
        carCode: "MG-3106200-ABCD",
        tipo_tema: "Reserva Legal",
        municipio: "Belo Horizonte",
        uf: "MG",
        status: "ATIVO",
      });

      expect(popupDiv.textContent).toContain("Fazenda Esperança");
      expect(popupDiv.textContent).toContain("CAR: MG-3106200-ABCD");
      expect(popupDiv.textContent).toContain("Camada: Reserva Legal");
      expect(popupDiv.textContent).toContain("Município: Belo Horizonte - MG");
      expect(popupDiv.textContent).toContain("Status: ATIVO");
    });
  });
});
