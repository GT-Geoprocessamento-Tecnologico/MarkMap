import { describe, it, expect } from "vitest";
import { BRAZILIAN_INSPECTION_TEMPLATES, validateFormSubmission } from "../../src/forms/templates/br-environmental.js";

describe("Brazilian Environmental & Agronomic Field Forms", () => {
  it("contains valid templates for APP, Fire, and Pests", () => {
    expect(BRAZILIAN_INSPECTION_TEMPLATES.APP_DEGRADATION).toBeDefined();
    expect(BRAZILIAN_INSPECTION_TEMPLATES.FIRE_OUTBREAK).toBeDefined();
    expect(BRAZILIAN_INSPECTION_TEMPLATES.CROP_PEST).toBeDefined();
  });

  it("validates correct form submissions successfully", () => {
    const submission = {
      templateType: "FIRE_OUTBREAK" as const,
      timestamp: Date.now(),
      coordinate: [-48.2, -15.9] as [number, number],
      answers: {
        fire_status: "Ativo em propagação",
        affected_area_type: "Pastagem",
        estimated_hectares: 15.0,
        photo_evidence: "blob:photo-123.jpg",
      },
    };

    const result = validateFormSubmission(submission);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("catches missing required fields and invalid coordinates", () => {
    const invalidSubmission = {
      templateType: "APP_DEGRADATION" as const,
      timestamp: Date.now(),
      coordinate: [NaN, -15.9] as [number, number],
      answers: {
        app_type: "",
        soil_exposure_pct: "not-a-number",
      },
    };

    const result = validateFormSubmission(invalidSubmission);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
