export type FieldType = "text" | "number" | "select" | "photo" | "boolean";

export interface FieldSchema {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

export type FieldValue = string | number | boolean | string[] | null;

export interface FieldForm {
  schemaVersion: string;
  fields: FieldSchema[];
  values: Record<string, FieldValue>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface PhotoAttachment {
  id: string;
  featureId: string;
  fileName: string;
  mimeType: string;
  dataUri: string;
  timestamp: string;
  metadata?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    heading?: number;
  };
}

const formStore = new Map<string, FieldForm>();
const photoStore = new Map<string, PhotoAttachment>();
const featurePhotosIndex = new Map<string, Set<string>>();

export function attachPhotoToFeature(photo: PhotoAttachment): void {
  const previous = photoStore.get(photo.id);
  if (previous && previous.featureId !== photo.featureId) {
    const previousIndex = featurePhotosIndex.get(previous.featureId);
    previousIndex?.delete(photo.id);
    if (previousIndex?.size === 0) featurePhotosIndex.delete(previous.featureId);
  }
  photoStore.set(photo.id, photo);
  let featurePhotos = featurePhotosIndex.get(photo.featureId);
  if (!featurePhotos) {
    featurePhotos = new Set<string>();
    featurePhotosIndex.set(photo.featureId, featurePhotos);
  }
  featurePhotos.add(photo.id);
}

export function getPhotosForFeature(featureId: string): PhotoAttachment[] {
  const featurePhotos = featurePhotosIndex.get(featureId);
  if (!featurePhotos) {
    return [];
  }
  const result: PhotoAttachment[] = [];
  for (const photoId of featurePhotos) {
    const photo = photoStore.get(photoId);
    if (photo) {
      result.push(photo);
    }
  }
  return result;
}

export function removePhoto(photoId: string): void {
  const photo = photoStore.get(photoId);
  if (photo) {
    const featurePhotos = featurePhotosIndex.get(photo.featureId);
    if (featurePhotos) {
      featurePhotos.delete(photoId);
      if (featurePhotos.size === 0) {
        featurePhotosIndex.delete(photo.featureId);
      }
    }
    photoStore.delete(photoId);
  }
}

export function clearPhotosForFeature(featureId: string): void {
  const featurePhotos = featurePhotosIndex.get(featureId);
  if (featurePhotos) {
    for (const photoId of featurePhotos) {
      photoStore.delete(photoId);
    }
    featurePhotosIndex.delete(featureId);
  }
}

export function attachFormToFeature(featureId: string, fields: FieldSchema[]): void {
  formStore.set(featureId, {
    schemaVersion: "1.0",
    fields,
    values: {},
  });
}

export function getFormForFeature(featureId: string): FieldForm | null {
  return formStore.get(featureId) || null;
}

export function updateFieldValue(featureId: string, fieldId: string, value: FieldValue): void {
  const form = formStore.get(featureId);
  if (!form) throw new Error(`Form not found for feature ${featureId}`);

  const field = form.fields.find(f => f.id === fieldId);
  if (!field) throw new Error(`Field ${fieldId} not found in form schema`);

  const validation = validateValue(field, value);
  if (!validation.valid) throw new Error(validation.error);

  form.values[fieldId] = value;
}

export function removeForm(featureId: string): void {
  formStore.delete(featureId);
}

export function validateValue(field: FieldSchema, value: FieldValue): ValidationResult {
  if (field.required && (value === null || value === undefined || value === "")) {
    return { valid: false, error: `Field '${field.label}' is required` };
  }

  if (value === null || value === undefined) {
    return { valid: true };
  }

  switch (field.type) {
    case "text":
      if (typeof value !== "string") {
        return { valid: false, error: `Field '${field.label}' must be text` };
      }
      break;
    case "number":
      if (typeof value !== "number") {
        return { valid: false, error: `Field '${field.label}' must be a number` };
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        return { valid: false, error: `Field '${field.label}' must be boolean` };
      }
      break;
    case "select":
      if (typeof value !== "string" || !field.options?.includes(value)) {
        return { valid: false, error: `Field '${field.label}' must be one of: ${field.options?.join(", ")}` };
      }
      break;
    case "photo":
      if (typeof value !== "string") {
        return { valid: false, error: `Field '${field.label}' must be a photo URL or data URI` };
      }
      break;
  }

  return { valid: true };
}
