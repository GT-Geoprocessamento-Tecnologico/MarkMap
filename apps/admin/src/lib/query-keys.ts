import type { Bbox } from "@markmap/contracts";

/**
 * Chaves de query centralizadas: todo acesso a cache passa por aqui para que
 * invalidacoes sejam por prefixo (list/detail/pages) e nunca duplicadas.
 */
export const bboxKey = (bbox?: Bbox): string =>
  bbox === undefined
    ? "all"
    : `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;

export const queryKeys = {
  projects: () => ["projects"] as const,
  projectsList: (cursor?: string) =>
    ["projects", "list", cursor ?? "first"] as const,
  project: (projectId: string) => ["projects", "detail", projectId] as const,

  layersByProject: (projectId: string) =>
    ["layers", "byProject", projectId] as const,
  layersPage: (projectId: string, cursor?: string) =>
    ["layers", "byProject", projectId, cursor ?? "first"] as const,
  layer: (layerId: string) => ["layers", "detail", layerId] as const,

  features: () => ["features"] as const,
  featuresByLayer: (layerId: string) => ["features", layerId] as const,
  featuresPage: (layerId: string, bbox?: Bbox) =>
    ["features", layerId, bboxKey(bbox)] as const,
};
