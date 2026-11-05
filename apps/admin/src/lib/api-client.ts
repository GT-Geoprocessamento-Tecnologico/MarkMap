import { z } from 'zod';
import {
  errorResponseSchema,
  featureSchema,
  layerSchema,
  projectSchema,
} from '@markmap/contracts';
import type {
  Bbox,
  CreateProject,
  Feature,
  Layer,
  Pagination,
  Project,
} from '@markmap/contracts';
import { ApiError } from './errors';
import * as mockApi from './mock';
import type {
  CreateFeatureInput,
  CreateLayerInput,
  ListFeaturesOptions,
  ListOptions,
  UpdateFeatureInput,
} from './api-types';

export { ApiError } from './errors';
export type {
  CreateFeatureInput,
  CreateLayerInput,
  ListFeaturesOptions,
  ListOptions,
  UpdateFeatureInput,
} from './api-types';

/** Base URL do transporte HTTP; sobrescrita por env quando o modo live é usado. */
export const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api/v1';

/**
 * `mock` mantém compatibilidade com testes e fluxos locais do cliente HTTP;
 * `live` usa fetch. A operação principal do app é local-first via IndexedDB
 * e sincroniza pelo fluxo /sync/*; as rotas HTTP diretas de domínio ficam
 * desabilitadas em production por isolamento de workspace.
 */
export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE ?? 'mock';

const isMockMode = (): boolean => API_MODE === 'mock';

const search = (params: URLSearchParams): string => {
  const value = params.toString();
  return value === '' ? '' : `?${value}`;
};

/**
 * `Input` desconectado do `Output`: sem isso o generic infere o tipo de
 * *input* do schema (campos com `.default()` opcionais) e o parse de resposta
 * fica com campos opcionais que o contrato nao tem.
 */
type ResponseSchema<T> = z.ZodType<T, unknown>;

const pageOf = <T>(itemSchema: ResponseSchema<T>): ResponseSchema<{ items: T[]; nextCursor: string | null }> =>
  z.object({ items: z.array(itemSchema), nextCursor: z.string().nullable() });

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') throw cause;
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'Falha de conexão com a API.', status: 0 });
  }
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const parsed = errorResponseSchema.safeParse(payload);
  if (parsed.success) {
    const { code, message, requestId } = parsed.data.error;
    return new ApiError({ code, message, status, requestId });
  }
  return new ApiError({
    code: 'INTERNAL_ERROR',
    message: `Resposta inesperada da API (HTTP ${status}).`,
    status,
  });
}

async function request<T>(path: string, schema: ResponseSchema<T>, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init);
  const payload = await readPayload(response);
  if (!response.ok) throw toApiError(response.status, payload);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'A API devolveu uma resposta fora do contrato.',
      status: response.status,
    });
  }
  return parsed.data;
}

export async function listProjects(options: ListOptions = {}): Promise<Pagination<Project>> {
  if (isMockMode()) return mockApi.listProjects(options);
  const params = new URLSearchParams();
  if (options.cursor !== undefined) params.set('cursor', options.cursor);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  return request(`/projects${search(params)}`, pageOf(projectSchema), {
    signal: options.signal,
  });
}

export async function createProject(input: CreateProject): Promise<Project> {
  if (isMockMode()) return mockApi.createProject(input);
  return request('/projects', projectSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getProject(projectId: string, signal?: AbortSignal): Promise<Project> {
  if (isMockMode()) return mockApi.getProject(projectId, signal);
  return request(`/projects/${encodeURIComponent(projectId)}`, projectSchema, { signal });
}

export async function listProjectLayers(
  projectId: string,
  options: ListOptions = {},
): Promise<Pagination<Layer>> {
  if (isMockMode()) return mockApi.listProjectLayers(projectId, options);
  const params = new URLSearchParams();
  if (options.cursor !== undefined) params.set('cursor', options.cursor);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  return request(
    `/projects/${encodeURIComponent(projectId)}/layers${search(params)}`,
    pageOf(layerSchema),
    { signal: options.signal },
  );
}

export async function createLayer(
  projectId: string,
  input: CreateLayerInput,
): Promise<Layer> {
  if (isMockMode()) return mockApi.createLayer(projectId, input);
  return request(
    `/projects/${encodeURIComponent(projectId)}/layers`,
    layerSchema,
    { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
  );
}

export async function getLayer(layerId: string, signal?: AbortSignal): Promise<Layer> {
  if (isMockMode()) return mockApi.getLayer(layerId, signal);
  return request(`/layers/${encodeURIComponent(layerId)}`, layerSchema, { signal });
}

export async function listFeatures(
  layerId: string,
  options: ListFeaturesOptions = {},
): Promise<Pagination<Feature>> {
  if (isMockMode()) return mockApi.listFeatures(layerId, options);
  const params = new URLSearchParams();
  if (options.bbox !== undefined) params.set('bbox', bboxToParam(options.bbox));
  if (options.cursor !== undefined) params.set('cursor', options.cursor);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  return request(
    `/layers/${encodeURIComponent(layerId)}/features${search(params)}`,
    pageOf(featureSchema),
    { signal: options.signal },
  );
}

export async function createFeature(
  layerId: string,
  input: CreateFeatureInput,
): Promise<Feature> {
  if (isMockMode()) return mockApi.createFeature(layerId, input);
  return request(`/layers/${encodeURIComponent(layerId)}/features`, featureSchema, {
    method: 'POST',
    body: JSON.stringify({ ...input, layerId }),
  });
}

/** PATCH com `version`: 409 VERSION_CONFLICT quando a linha andou no servidor. */
export async function updateFeature(
  featureId: string,
  input: UpdateFeatureInput,
): Promise<Feature> {
  if (isMockMode()) return mockApi.updateFeature(featureId, input);
  return request(`/features/${encodeURIComponent(featureId)}`, featureSchema, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, id: featureId }),
  });
}

export async function deleteFeature(featureId: string, signal?: AbortSignal): Promise<void> {
  if (isMockMode()) return mockApi.deleteFeature(featureId, signal);
  const response = await send(`/features/${encodeURIComponent(featureId)}`, {
    method: 'DELETE',
    signal,
  });
  if (!response.ok) throw toApiError(response.status, await readPayload(response));
}

function bboxToParam(bbox: Bbox): string {
  return `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
}
