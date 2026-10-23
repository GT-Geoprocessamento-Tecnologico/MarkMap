import { normalizePostalCode } from "@markmap/maps/search";

/** Small, serializable index for maps already present on this device. */
export interface LocalSearchRecord {
  id: string;
  name: string;
  normalized: string;
  type: string;
  category: string;
  lon: number;
  lat: number;
  postalCodes?: string[];
}

function explicitPostalCodes(properties: Record<string, unknown>): string[] {
  const values = [
    "addr:postcode",
    "postcode",
    "postal_code",
    "postalcode",
    "cep",
  ]
    .map((key) => properties[key])
    .filter((value): value is string => typeof value === "string");
  return [
    ...new Set(
      values
        .map(normalizePostalCode)
        .filter((value): value is string => value !== null),
    ),
  ];
}

function firstPosition(value: unknown, depth = 0): [number, number] | null {
  if (!Array.isArray(value) || depth > 7) return null;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    const [lon, lat] = value as number[];
    return Number.isFinite(lon) &&
      Number.isFinite(lat) &&
      lon >= -180 &&
      lon <= 180 &&
      lat >= -90 &&
      lat <= 90
      ? [lon, lat]
      : null;
  }
  for (const nested of value) {
    const found = firstPosition(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

export function buildLocalMapSearchRecords(
  features: readonly unknown[],
): LocalSearchRecord[] {
  const result: LocalSearchRecord[] = [];
  for (const [index, raw] of features.entries()) {
    if (result.length >= 10000) break;
    if (!raw || typeof raw !== "object") continue;
    const feature = raw as {
      id?: unknown;
      properties?: unknown;
      geometry?: unknown;
    };
    if (
      !feature.properties ||
      typeof feature.properties !== "object" ||
      !feature.geometry ||
      typeof feature.geometry !== "object"
    )
      continue;
    const properties = feature.properties as Record<string, unknown>;
    const geometry = feature.geometry as {
      coordinates?: unknown;
      type?: unknown;
    };
    const street = properties["addr:street"] ?? properties.street;
    const number = properties["addr:housenumber"] ?? properties.housenumber;
    const city = properties["addr:city"] ?? properties.city;
    const address = [street, number, city]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      .join(", ");
    const title = [
      properties.name,
      properties.title,
      properties.ref,
      properties.label,
    ].find((v): v is string => typeof v === "string" && v.trim().length > 0);
    const label = [title, address].filter(Boolean).join(" · ");
    if (!label) continue;
    const coords = firstPosition(geometry.coordinates);
    if (!coords) continue;
    const normalized = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[ºª]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) continue;
    const kind = typeof geometry.type === "string" ? geometry.type : "feature";
    const postalCodes = explicitPostalCodes(properties);
    result.push({
      id: `${index}:${String(feature.id ?? index)}`,
      name: label.slice(0, 200),
      normalized,
      type: kind,
      category: kind,
      lon: coords[0],
      lat: coords[1],
      ...(postalCodes.length ? { postalCodes } : {}),
    });
  }
  return result;
}
