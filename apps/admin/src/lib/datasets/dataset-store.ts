import { featurePropertiesSchema, geometrySchema } from "@geonexo/contracts";
import { offlineDB } from "../storage/offline-db";

export const MAX_DATASET_BYTES = 25 * 1024 * 1024;
export const MAX_DATASET_FEATURES = 10_000;
const MAX_GEOMETRY_POSITIONS = 100_000;
const MAX_GEOMETRY_DEPTH = 20;

export interface DatasetFeature {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
  id?: string | number;
}

export interface DatasetGeoJSON {
  type: "FeatureCollection";
  features: DatasetFeature[];
}

export interface DatasetRecord {
  id: string;
  name: string;
  format: "GeoJSON";
  sizeBytes: number;
  featuresCount: number;
  uploadedAt: string;
  crs: string;
  originalBlob: Blob;
  geojson: DatasetGeoJSON;
  deleted?: boolean;
}

const datasetId = () => crypto.randomUUID();

const isGeoJsonFile = (file: File) => /\.(geojson|json)$/i.test(file.name);

export async function parseGeoJSON(file: File): Promise<DatasetRecord> {
  if (file.size > MAX_DATASET_BYTES)
    throw new Error("Arquivo excede o limite de 25 MiB.");
  if (!isGeoJsonFile(file))
    throw new Error(
      "Formato não suportado. Importe um arquivo GeoJSON ou JSON.",
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error("O arquivo não contém JSON válido.");
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { type?: unknown }).type !== "FeatureCollection"
  ) {
    throw new Error("O GeoJSON precisa ser uma FeatureCollection.");
  }
  const declaredCrs = (parsed as { crs?: unknown }).crs;
  if (
    declaredCrs !== undefined &&
    !JSON.stringify(declaredCrs).includes("4326")
  )
    throw new Error("O arquivo declara um CRS diferente de EPSG:4326.");
  const features = (parsed as { features?: unknown }).features;
  if (!Array.isArray(features))
    throw new Error("A FeatureCollection não contém uma lista de feições.");
  if (features.length > MAX_DATASET_FEATURES)
    throw new Error(
      `O arquivo excede o limite de ${MAX_DATASET_FEATURES} feições.`,
    );
  const validated: DatasetFeature[] = [];
  for (const [index, feature] of features.entries()) {
    if (
      !feature ||
      typeof feature !== "object" ||
      (feature as { type?: unknown }).type !== "Feature"
    ) {
      throw new Error(`Feição ${index + 1} não é um GeoJSON Feature válido.`);
    }
    const geometry = geometrySchema.safeParse(
      (feature as { geometry?: unknown }).geometry,
    );
    if (!geometry.success)
      throw new Error(`Geometria inválida na feição ${index + 1}.`);
    let positions = 0;
    const measureGeometry = (value: unknown, depth: number): void => {
      if (depth > MAX_GEOMETRY_DEPTH)
        throw new Error(`Geometria profunda demais na feição ${index + 1}.`);
      if (Array.isArray(value) && typeof value[0] === "number") {
        positions += 1;
        if (positions > MAX_GEOMETRY_POSITIONS)
          throw new Error(
            `Geometria excede o limite de coordenadas na feição ${index + 1}.`,
          );
        return;
      }
      if (Array.isArray(value))
        value.forEach((item) => measureGeometry(item, depth + 1));
    };
    measureGeometry(
      (feature as { geometry?: { coordinates?: unknown } }).geometry
        ?.coordinates,
      0,
    );
    const properties = featurePropertiesSchema.safeParse(
      (feature as { properties?: unknown }).properties ?? {},
    );
    if (!properties.success)
      throw new Error(`Propriedades inválidas na feição ${index + 1}.`);
    const id = (feature as { id?: unknown }).id;
    if (
      id !== undefined &&
      typeof id !== "string" &&
      (typeof id !== "number" || !Number.isFinite(id))
    ) {
      throw new Error(`ID inválido na feição ${index + 1}.`);
    }
    validated.push({
      type: "Feature",
      geometry: geometry.data,
      properties: properties.data,
      ...(id !== undefined ? { id } : {}),
    });
  }
  return {
    id: datasetId(),
    name: file.name,
    format: "GeoJSON",
    sizeBytes: file.size,
    featuresCount: validated.length,
    uploadedAt: new Date().toISOString(),
    crs: "EPSG:4326",
    originalBlob: file,
    geojson: { type: "FeatureCollection", features: validated },
  };
}

export async function saveDataset(dataset: DatasetRecord): Promise<void> {
  const { originalBlob, ...metadata } = dataset;
  await offlineDB.save("datasets", dataset.id, { ...metadata, originalBytes: await originalBlob.arrayBuffer(), originalType: originalBlob.type });
}

type StoredDataset = Omit<DatasetRecord, 'originalBlob'> & { originalBlob?: Blob; originalBytes?: ArrayBuffer; originalType?: string };
function restoreDataset(record: StoredDataset): DatasetRecord {
  const originalBlob = record.originalBlob ?? (record.originalBytes instanceof ArrayBuffer ? new Blob([record.originalBytes], { type: record.originalType ?? 'application/geo+json' }) : undefined);
  if (!originalBlob) throw new Error('O arquivo original deste dataset não está disponível. Importe-o novamente.');
  return { ...record, originalBlob };
}

export async function listDatasets(): Promise<DatasetRecord[]> {
  const records = (await offlineDB.getAll("datasets")) as StoredDataset[];
  return records
    .filter((record) => !record.deleted)
    .map(restoreDataset)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getDataset(id: string): Promise<DatasetRecord | null> {
  const record = (await offlineDB.get("datasets", id)) as StoredDataset | null;
  return record && !record.deleted ? restoreDataset(record) : null;
}

export async function removeDataset(id: string): Promise<void> {
  const current = (await offlineDB.get("datasets", id)) as DatasetRecord | null;
  if (current)
    await offlineDB.save("datasets", id, { ...current, deleted: true });
}

export async function exportDataset(id: string): Promise<void> {
  const dataset = await getDataset(id);
  if (!dataset) throw new Error("Dataset não encontrado.");
  const blob = dataset.originalBlob;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = dataset.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
