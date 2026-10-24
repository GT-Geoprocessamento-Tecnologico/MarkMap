/**
 * API em memoria do admin.
 *
 * Existe porque `services/api` ainda nao tem endpoints - a dependencia esta
 * registrada em INTRUCOES/geonexo-prds/20-FRONTEND-PRD-HANDOFF.md. A pagina
 * so usa `src/lib/api-client`, que delega para aqui quando `VITE_API_MODE`
 * (default) e `mock`; portanto apagar esta pasta e trocar o env para `live`
 * liga a API real sem tocar em paginas ou hooks.
 *
 * Comportamentos simulados de proposito: paginacao `{items, nextCursor}`,
 * envelope de erro com codes estaveis, latencia de dev e 409
 * `VERSION_CONFLICT` quando `updateFeature` recebe `version` obsoleto.
 */
import { z } from 'zod';
import {
  DEFAULT_PAGE_LIMIT,
  createFeatureSchema,
  createLayerSchema,
  createProjectSchema,
  httpStatusByErrorCode,
  isGeometryCompatibleWith,
  updateFeatureSchema,
} from '@markmap/contracts';
import type {
  Bbox,
  CreateProject,
  ErrorCode,
  Feature,
  Geometry,
  Layer,
  Pagination,
  Position,
  Project,
} from '@markmap/contracts';
import { ApiError } from '../errors';
import type {
  CreateFeatureInput,
  CreateLayerInput,
  ListFeaturesOptions,
  ListOptions,
  UpdateFeatureInput,
} from '../api-types';
import { getDb, persist } from './storage';

export { MOCK_STORAGE_KEY, resetMockDb } from './storage';

const isTest = import.meta.env.MODE === 'test';

async function latency(): Promise<void> {
  if (isTest) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC 4122 v4 para ambientes sem crypto.randomUUID (jsdom antigo).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function apiError(code: ErrorCode, message: string): ApiError {
  return new ApiError({ code, message, status: httpStatusByErrorCode[code], requestId: newId() });
}

function validationError(issues: readonly z.ZodIssue[]): ApiError {
  const details = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  return new ApiError({
    code: 'VALIDATION_ERROR',
    message: `Dados inválidos: ${details}`,
    status: httpStatusByErrorCode.VALIDATION_ERROR,
    requestId: newId(),
  });
}

function paginate<T extends { id: string }>(rows: T[], options: ListOptions): Pagination<T> {
  const limit = options.limit ?? DEFAULT_PAGE_LIMIT;
  const cursor = options.cursor;
  let start = 0;
  if (cursor !== undefined) {
    const index = rows.findIndex((row) => row.id === cursor);
    if (index === -1) {
      throw new ApiError({
        code: 'VALIDATION_ERROR',
        message: 'Cursor de paginação inválido.',
        status: 400,
        requestId: newId(),
      });
    }
    start = index + 1;
  }
  const items = rows.slice(start, start + limit);
  const hasMore = start + limit < rows.length;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last !== undefined ? last.id : null };
}

function geometryBbox(geometry: Geometry): Bbox {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const push = (position: Position): void => {
    minLng = Math.min(minLng, position[0]);
    minLat = Math.min(minLat, position[1]);
    maxLng = Math.max(maxLng, position[0]);
    maxLat = Math.max(maxLat, position[1]);
  };

  switch (geometry.type) {
    case 'Point':
      push(geometry.coordinates);
      break;
    case 'MultiPoint':
    case 'LineString':
      geometry.coordinates.forEach(push);
      break;
    case 'MultiLineString':
    case 'Polygon':
      geometry.coordinates.forEach((line) => line.forEach(push));
      break;
    case 'MultiPolygon':
      geometry.coordinates.forEach((polygon) => polygon.forEach((line) => line.forEach(push)));
      break;
  }

  return { minLng, minLat, maxLng, maxLat };
}

function intersects(geometry: Geometry, bbox: Bbox): boolean {
  const box = geometryBbox(geometry);
  return (
    box.minLng <= bbox.maxLng &&
    box.maxLng >= bbox.minLng &&
    box.minLat <= bbox.maxLat &&
    box.maxLat >= bbox.minLat
  );
}

export async function listProjects(options: ListOptions = {}): Promise<Pagination<Project>> {
  throwIfAborted(options.signal);
  await latency();
  const rows = [...getDb().projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return paginate(rows, options);
}

export async function createProject(input: CreateProject): Promise<Project> {
  await latency();
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) throw validationError(parsed.error.issues);
  const now = new Date().toISOString();
  const db = getDb();
  const project: Project = {
    id: newId(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...parsed.data,
  };
  db.projects.push(project);
  persist(db);
  return project;
}

export async function getProject(projectId: string, signal?: AbortSignal): Promise<Project> {
  throwIfAborted(signal);
  await latency();
  const project = getDb().projects.find((row) => row.id === projectId);
  if (project === undefined) throw apiError('PROJECT_NOT_FOUND', 'Projeto não encontrado.');
  return project;
}

export async function listProjectLayers(
  projectId: string,
  options: ListOptions = {},
): Promise<Pagination<Layer>> {
  throwIfAborted(options.signal);
  await latency();
  const db = getDb();
  if (!db.projects.some((row) => row.id === projectId)) {
    throw apiError('PROJECT_NOT_FOUND', 'Projeto não encontrado.');
  }
  const rows = db.layers
    .filter((row) => row.projectId === projectId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return paginate(rows, options);
}

export async function createLayer(projectId: string, input: CreateLayerInput): Promise<Layer> {
  await latency();
  const parsed = createLayerSchema.safeParse({ ...input, projectId });
  if (!parsed.success) throw validationError(parsed.error.issues);
  const db = getDb();
  if (!db.projects.some((row) => row.id === projectId)) {
    throw apiError('PROJECT_NOT_FOUND', 'Projeto não encontrado.');
  }
  const now = new Date().toISOString();
  const layer: Layer = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    ...parsed.data,
    description: parsed.data.description ?? null,
  };
  db.layers.push(layer);
  persist(db);
  return layer;
}

export async function getLayer(layerId: string, signal?: AbortSignal): Promise<Layer> {
  throwIfAborted(signal);
  await latency();
  const layer = getDb().layers.find((row) => row.id === layerId);
  if (layer === undefined) throw apiError('LAYER_NOT_FOUND', 'Camada não encontrada.');
  return layer;
}

export async function listFeatures(
  layerId: string,
  options: ListFeaturesOptions = {},
): Promise<Pagination<Feature>> {
  throwIfAborted(options.signal);
  await latency();
  const db = getDb();
  if (!db.layers.some((row) => row.id === layerId)) {
    throw apiError('LAYER_NOT_FOUND', 'Camada não encontrada.');
  }
  const rows = db.features
    .filter((row) => row.layerId === layerId)
    .filter((row) => options.bbox === undefined || intersects(row.geometry, options.bbox))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return paginate(rows, options);
}

export async function createFeature(layerId: string, input: CreateFeatureInput): Promise<Feature> {
  await latency();
  const parsed = createFeatureSchema.safeParse({ ...input, layerId });
  if (!parsed.success) throw validationError(parsed.error.issues);
  const db = getDb();
  const layer = db.layers.find((row) => row.id === layerId);
  if (layer === undefined) throw apiError('LAYER_NOT_FOUND', 'Camada não encontrada.');
  if (!isGeometryCompatibleWith(parsed.data.geometry, layer.geometryType)) {
    throw apiError(
      'GEOMETRY_TYPE_MISMATCH',
      `A camada aceita apenas geometrias ${layer.geometryType}.`,
    );
  }
  const now = new Date().toISOString();
  const feature: Feature = { id: newId(), version: 1, createdAt: now, updatedAt: now, ...parsed.data };
  db.features.push(feature);
  persist(db);
  return feature;
}

export async function updateFeature(featureId: string, input: UpdateFeatureInput): Promise<Feature> {
  await latency();
  const parsed = updateFeatureSchema.safeParse({ ...input, id: featureId });
  if (!parsed.success) throw validationError(parsed.error.issues);
  const db = getDb();
  const index = db.features.findIndex((row) => row.id === featureId);
  const current = db.features[index];
  if (current === undefined) throw apiError('FEATURE_NOT_FOUND', 'Elemento não encontrado.');
  if (parsed.data.version !== current.version) {
    throw new ApiError({
      code: 'VERSION_CONFLICT',
      message: 'Este item foi alterado em outra sessão. Recarregue antes de salvar.',
      status: httpStatusByErrorCode.VERSION_CONFLICT,
      requestId: newId(),
    });
  }
  const layer = db.layers.find((row) => row.id === current.layerId);
  const geometry = parsed.data.geometry ?? current.geometry;
  if (layer !== undefined && !isGeometryCompatibleWith(geometry, layer.geometryType)) {
    throw apiError(
      'GEOMETRY_TYPE_MISMATCH',
      `A camada aceita apenas geometrias ${layer.geometryType}.`,
    );
  }
  const updated: Feature = {
    ...current,
    geometry,
    properties: parsed.data.properties ?? current.properties,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  };
  db.features[index] = updated;
  persist(db);
  return updated;
}

export async function deleteFeature(featureId: string, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await latency();
  const db = getDb();
  const index = db.features.findIndex((row) => row.id === featureId);
  if (index === -1) throw apiError('FEATURE_NOT_FOUND', 'Elemento não encontrado.');
  db.features.splice(index, 1);
  persist(db);
}
