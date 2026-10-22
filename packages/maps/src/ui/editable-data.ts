export interface EditableFeature<KV = unknown> {
  featureId: string;
  geometry: GeoJSONGeometry;
  attributes: Record<string, KV>;
}

export type GeoJSONGeometry =
  | { type: "Point"; coordinates: [number, number] | [number, number, number] }
  | { type: "MultiPoint"; coordinates: ([number, number] | [number, number, number])[] }
  | { type: "LineString"; coordinates: ([number, number] | [number, number, number])[] }
  | { type: "MultiLineString"; coordinates: ([number, number] | [number, number, number])[][] }
  | { type: "Polygon"; coordinates: ([number, number] | [number, number, number])[][] }
  | { type: "MultiPolygon"; coordinates: ([number, number] | [number, number, number])[][][] };

export interface FieldEditorProps<KV = unknown> {
  feature: EditableFeature<KV>;
  onSave: (feature: EditableFeature<KV>) => void;
  onCancel: () => void;
  fields: {
    id: string;
    label: string;
    type: "text" | "number" | "select" | "boolean";
    value: KV;
    onChange: (value: KV) => void;
    required?: boolean;
    options?: string[];
  }[];
}

/**
 * Opens an editable panel for a vector feature's attributes.
 * @param feature - The feature to edit
 * @param props - Panel configuration
 */
export function openEditablePanel<KV = unknown>(
  feature: EditableFeature<KV>,
  props: FieldEditorProps<KV>
): void {
  props.onSave(feature);
}

export interface FieldSchemaEditor {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  value?: string | number | boolean;
  required?: boolean;
  options?: string[];
}

/**
 * Safely extracts key-value attributes from a GeoJSON object or Feature properties.
 */
export function parseKVFromGeoJson<KV = unknown>(feature: unknown): Record<string, KV> {
  if (!feature || typeof feature !== "object") {
    return {};
  }
  const obj = feature as Record<string, unknown>;
  if (obj.properties && typeof obj.properties === "object") {
    return { ...(obj.properties as Record<string, KV>) };
  }
  return {};
}

/**
 * Merges key-value attributes into a GeoJSON Feature, creating a new Feature immutably.
 */
export function mergeKVIntoGeoJson<T = unknown>(
  geoJson: T,
  kv: Record<string, unknown>
): T {
  if (!geoJson || typeof geoJson !== "object") {
    return geoJson;
  }
  const obj = geoJson as Record<string, unknown>;
  const properties = {
    ...(obj.properties && typeof obj.properties === "object" ? (obj.properties as Record<string, unknown>) : {}),
    ...kv,
  };

  return {
    ...obj,
    properties,
  } as T;
}

/**
 * Validates attributes against declared field schemas.
 */
export function validateFeatureAttributes(
  schemas: FieldSchemaEditor[],
  attributes: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of schemas) {
    const val = attributes[field.id];
    if (field.required && (val === undefined || val === null || val === "")) {
      errors[field.id] = `O campo '${field.label}' é obrigatório.`;
      continue;
    }
    if (val !== undefined && val !== null && val !== "") {
      if (field.type === "number" && typeof val !== "number") {
        errors[field.id] = `O campo '${field.label}' deve ser um número.`;
      } else if (field.type === "boolean" && typeof val !== "boolean") {
        errors[field.id] = `O campo '${field.label}' deve ser verdadeiro ou falso.`;
      } else if (field.type === "select" && field.options && !field.options.includes(String(val))) {
        errors[field.id] = `O campo '${field.label}' deve ser uma das opções válidas.`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
