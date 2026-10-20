import { featurePropertiesSchema, geometrySchema } from "@geonexo/contracts";
import {
  EPSG_WGS84,
  isReprojectableEpsg,
  parseGeoJsonCrsEpsg,
  transformPosition,
  parseGpx,
  parseKml,
  tracksToGeoJSON,
  extractKmzKml,
} from "@geonexo/geo";
import { offlineDB } from "../storage/offline-db";
import { downloadBlob } from "../file-download";

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
  format: "GeoJSON" | "GPX" | "KML" | "KMZ";
  sizeBytes: number;
  featuresCount: number;
  uploadedAt: string;
  crs: string;
  /**
   * CRS de origem do arquivo, quando difere de WGS 84.
   *
   * Opcional de propósito: registros gravados por instalações anteriores não
   * têm a chave, e `restoreDataset` precisa devolver um valor utilizável em vez
   * de `undefined` sob um tipo `string`.
   */
  sourceCrs?: string;
  originalBlob: Blob;
  geojson: DatasetGeoJSON;
  deleted?: boolean;
}

const datasetId = () => crypto.randomUUID();

/**
 * Reprojects every position of a GeoJSON geometry into WGS 84.
 *
 * GeoJSON is specified in WGS 84, and the map renders in WGS 84, so a file
 * delivered in a projected CRS has to be converted on import rather than
 * rejected: a SIRGAS 2000 / UTM file is exactly what a Brazilian surveyor
 * receives, and refusing it made the coordinate system decorative.
 *
 * The walk is depth-bounded and shape-preserving; anything that is not a
 * well-formed position is passed through untouched so validation downstream
 * still reports the real problem.
 */
function reprojectGeometry(
  value: unknown,
  fromEpsg: number,
  depth = 0,
): unknown {
  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      const moved = transformPosition(value, fromEpsg, EPSG_WGS84);
      return moved ? [...moved, ...value.slice(2)] : value;
    }
    // Limita-se a profundidade, e não a largura: um array de coordenadas é
    // plano e pode ter milhares de posições. Um guarda por `length` aqui
    // rejeitava LineString, anel de polígono e MultiLineString com mais de 80
    // vértices, que é justamente o formato de uma estrada ou confrontação.
    if (depth > MAX_GEOMETRY_DEPTH)
      throw new Error("Geometria profunda demais para reprojetar.");
    return value.map((entry) => reprojectGeometry(entry, fromEpsg, depth + 1));
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(source)) {
      next[key] = reprojectGeometry(entry, fromEpsg, depth);
    }
    return next;
  }
  return value;
}

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
  const sourceEpsg = parseGeoJsonCrsEpsg(declaredCrs) ?? EPSG_WGS84;
  if (sourceEpsg !== EPSG_WGS84 && !isReprojectableEpsg(sourceEpsg))
    throw new Error(
      `O arquivo declara EPSG:${sourceEpsg}, que o MarkMap não sabe reprojetar para WGS 84.`,
    );
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
    // Reprojeta antes de validar: um UTM tem coordenadas em metros, que só
    // passam na validação de WGS 84 depois da conversão.
    const sourceGeometry = (feature as { geometry?: unknown }).geometry;
    const wgs84Geometry =
      sourceEpsg === EPSG_WGS84
        ? sourceGeometry
        : reprojectGeometry(sourceGeometry, sourceEpsg);
    const geometry = geometrySchema.safeParse(wgs84Geometry);
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
      (geometry.data as { coordinates?: unknown }).coordinates,
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
    // O mapa e o GeoJSON trafegam em WGS 84; `sourceCrs` guarda a origem para
    // que a interface possa informar que houve reprojeção.
    crs: `EPSG:${EPSG_WGS84}`,
    sourceCrs: `EPSG:${sourceEpsg}`,
    originalBlob: file,
    geojson: { type: "FeatureCollection", features: validated },
  };
}

/** Import GPX/KML through the existing parsers, then through the same GeoJSON safety gate. */
export async function parseDatasetFile(file: File): Promise<DatasetRecord> {
  if (/\.(?:geojson|json)$/i.test(file.name)) return parseGeoJSON(file);
  if (!/\.(?:gpx|kml|kmz)$/i.test(file.name))
    throw new Error('Formato não suportado. Use GeoJSON, GPX, KML ou KMZ.');
  if (file.size > MAX_DATASET_BYTES) throw new Error('Arquivo excede o limite de 25 MiB.');
  const raw = /\.kmz$/i.test(file.name) ? await extractKmzKml(file) : await file.text();
  // Treat XML as untrusted input. Existing parsers are text-only (no network/DTD resolution).
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(raw))
    throw new Error('Declarações DTD/ENTITY não são permitidas.');
  const format = /\.gpx$/i.test(file.name) ? 'GPX' : /\.kmz$/i.test(file.name) ? 'KMZ' : 'KML';
  if (!(format === 'GPX' ? /<(?:[\w-]+:)?gpx\b/i : /<(?:[\w-]+:)?kml\b/i).test(raw))
    throw new Error('XML incompatível com o formato informado.');
  const imported = format === 'GPX' ? parseGpx(raw) : parseKml(raw, { strict: true });
  const collection = tracksToGeoJSON(imported);
  if (collection.features.length === 0)
    throw new Error('O arquivo não contém pontos, linhas ou áreas compatíveis.');
  if (collection.features.length > MAX_DATASET_FEATURES)
    throw new Error(`O arquivo excede o limite de ${MAX_DATASET_FEATURES} feições.`);
  // Reuse the same CRS, geometry, feature-count and properties validation as GeoJSON.
  const normalized = JSON.stringify(collection);
  const jsonFile = new File([normalized], 'converted.geojson', { type: 'application/geo+json' });
  // jsdom File lacks text(); installed browsers provide it natively.
  if (typeof jsonFile.text !== 'function') Object.defineProperty(jsonFile, 'text', {value: async () => normalized});
  const validated = await parseGeoJSON(jsonFile);
  return { ...validated, name: file.name, format, sizeBytes: file.size, originalBlob: file };
}

/** Export validated normalized WGS84 data, independent of the original format. */
export function normalizedGeoJSONBlob(dataset: Pick<DatasetRecord, 'geojson'>): Blob {
  return new Blob([JSON.stringify(dataset.geojson)], { type: 'application/geo+json' });
}

export async function exportDatasetGeoJSON(id: string): Promise<void> {
  const dataset = await getDataset(id);
  if (!dataset) throw new Error('Dataset não encontrado.');
  const blob = normalizedGeoJSONBlob(dataset);
  downloadBlob(blob, dataset.name.replace(/\.[^.]+$/, '') + '.geojson');
}

export async function saveDataset(dataset: DatasetRecord): Promise<void> {
  const { originalBlob, ...metadata } = dataset;
  await offlineDB.save("datasets", dataset.id, { ...metadata, originalBytes: await originalBlob.arrayBuffer(), originalType: originalBlob.type });
}

type StoredDataset = Omit<DatasetRecord, 'originalBlob'> & { originalBlob?: Blob; originalBytes?: ArrayBuffer; originalType?: string };
function restoreDataset(record: StoredDataset): DatasetRecord {
  const originalBlob = record.originalBlob ?? (record.originalBytes instanceof ArrayBuffer ? new Blob([record.originalBytes], { type: record.originalType ?? 'application/geo+json' }) : undefined);
  if (!originalBlob) throw new Error('O arquivo original deste dataset não está disponível. Importe-o novamente.');
  // Instalações anteriores não gravaram `sourceCrs`; cair para `crs` evita
  // devolver `undefined` sob um tipo declarado como string.
  return { ...record, sourceCrs: record.sourceCrs ?? record.crs, originalBlob };
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
  downloadBlob(dataset.originalBlob, dataset.name);
}
