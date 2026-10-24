import { describe, expect, it } from "vitest";
import {
  attachFormToFeature,
  getFormForFeature,
  removeForm,
  updateFieldValue,
  validateValue,
  attachPhotoToFeature,
  getPhotosForFeature,
  removePhoto,
  clearPhotosForFeature,
  type FieldSchema,
} from "../../src/forms/field-form.js";

describe("Field Forms Engine", () => {
  const fields: FieldSchema[] = [
    { id: "name", label: "Name", type: "text", required: true },
    { id: "condition", label: "Condition", type: "select", required: false, options: ["good", "fair", "poor"] },
    { id: "elevation", label: "Elevation", type: "number", required: false },
    { id: "photo", label: "Photo", type: "photo", required: false },
  ];

  it("attaches a customizable form schema to a map vector feature", () => {
    attachFormToFeature("point-001", fields);
    const form = getFormForFeature("point-001");

    expect(form?.schemaVersion).toBe("1.0");
    expect(form?.fields).toEqual(fields);
    removeForm("point-001");
  });

  it("stores a valid key-value field attribute against a feature", () => {
    attachFormToFeature("point-002", fields);
    updateFieldValue("point-002", "name", "Survey marker 12");

    expect(getFormForFeature("point-002")?.values.name).toBe("Survey marker 12");
    removeForm("point-002");
  });

  it("rejects a missing required field", () => {
    expect(validateValue(fields[0]!, null)).toMatchObject({ valid: false });
  });

  it("rejects a wrong value type", () => {
    expect(validateValue(fields[2]!, "one hundred")).toMatchObject({ valid: false });
  });

  it("rejects a select option outside the declared schema", () => {
    expect(validateValue(fields[1]!, "unknown")).toMatchObject({ valid: false });
  });

  it("accepts a select option declared by the schema", () => {
    expect(validateValue(fields[1]!, "good")).toEqual({ valid: true });
  });

  it("attaches, retrieves and deletes photos for a feature", () => {
    const photo = {
      id: "photo-01",
      featureId: "point-003",
      fileName: "marco.jpg",
      mimeType: "image/jpeg",
      dataUri: "data:image/jpeg;base64,dGVzdA==",
      timestamp: "2026-10-21T12:00:00Z",
      metadata: { latitude: -7.1932, longitude: -48.2045 },
    };

    attachPhotoToFeature(photo);
    const photos = getPhotosForFeature("point-003");
    expect(photos).toHaveLength(1);
    expect(photos[0]!.id).toBe("photo-01");
    expect(photos[0]!.metadata?.latitude).toBe(-7.1932);

    removePhoto("photo-01");
    expect(getPhotosForFeature("point-003")).toHaveLength(0);
  });
  it("reindexes a photo when the same id moves between features", () => {
    const original = {
      id: "photo-reassigned-001",
      featureId: "old-feature-001",
      fileName: "marco.jpg",
      mimeType: "image/jpeg",
      dataUri: "data:image/jpeg;base64,dGVzdA==",
      timestamp: "2026-10-24T12:00:00Z",
    };
    attachPhotoToFeature(original);
    expect(getPhotosForFeature("old-feature-001")).toHaveLength(1);

    attachPhotoToFeature({ ...original, featureId: "new-feature-001" });
    expect(getPhotosForFeature("old-feature-001")).toHaveLength(0);
    expect(getPhotosForFeature("new-feature-001")).toHaveLength(1);

    clearPhotosForFeature("old-feature-001");
    expect(getPhotosForFeature("new-feature-001")).toHaveLength(1);
    removePhoto(original.id);
    expect(getPhotosForFeature("new-feature-001")).toHaveLength(0);
  });

});
