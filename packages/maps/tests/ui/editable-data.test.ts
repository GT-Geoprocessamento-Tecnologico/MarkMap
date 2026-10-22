import { describe, expect, it } from "vitest";
import {
  openEditablePanel,
  parseKVFromGeoJson,
  mergeKVIntoGeoJson,
  validateFeatureAttributes,
  type EditableFeature,
  type FieldEditorProps,
} from "../../src/ui/editable-data.js";

describe("UI Editable Data Panel for Map Features", () => {
  it("opens editable panel and invokes onSave callback", () => {
    let saved = false;
    const feature: EditableFeature = {
      featureId: "feat-1",
      geometry: { type: "Point", coordinates: [-48.2, -7.19] },
      attributes: { name: "Ponto de Coleta", status: "Ativo" },
    };

    const props: FieldEditorProps = {
      feature,
      onSave: () => {
        saved = true;
      },
      onCancel: () => {},
      fields: [],
    };

    openEditablePanel(feature, props);
    expect(saved).toBe(true);
  });

  it("extracts key-value attributes from GeoJSON Feature properties", () => {
    const geoJsonFeature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-48.2, -7.19] },
      properties: { name: "Vértice Marco 1", elevation: 215 },
    };

    const kv = parseKVFromGeoJson(geoJsonFeature);
    expect(kv).toEqual({ name: "Vértice Marco 1", elevation: 215 });
  });

  it("merges new key-value attributes immutably into a GeoJSON Feature", () => {
    const geoJsonFeature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-48.2, -7.19] },
      properties: { name: "Marco 1" },
    };

    const updated = mergeKVIntoGeoJson(geoJsonFeature, { status: "Inspecionado", condition: "Bom" });
    expect(updated.properties).toEqual({
      name: "Marco 1",
      status: "Inspecionado",
      condition: "Bom",
    });
    // original must be untouched
    expect(geoJsonFeature.properties).toEqual({ name: "Marco 1" });
  });

  it("validates feature attributes against field schema constraints", () => {
    const schemas = [
      { id: "name", label: "Nome", type: "text" as const, required: true },
      { id: "score", label: "Nota", type: "number" as const, required: true },
      { id: "type", label: "Tipo", type: "select" as const, options: ["A", "B"] },
    ];

    // Invalid missing required
    const result1 = validateFeatureAttributes(schemas, { type: "A" });
    expect(result1.valid).toBe(false);
    expect(result1.errors.name).toBeDefined();

    // Invalid wrong type
    const result2 = validateFeatureAttributes(schemas, { name: "Teste", score: "not-a-number" as any });
    expect(result2.valid).toBe(false);
    expect(result2.errors.score).toBeDefined();

    // Valid
    const result3 = validateFeatureAttributes(schemas, { name: "Teste", score: 10, type: "A" });
    expect(result3.valid).toBe(true);
    expect(result3.errors).toEqual({});
  });
});
