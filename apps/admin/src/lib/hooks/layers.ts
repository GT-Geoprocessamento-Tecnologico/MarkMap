import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createLayerSchema,
  layerSchema,
  syncEntityPayloadSchema,
  type Layer,
} from "@markmap/contracts";
import type { CreateLayerInput } from "../api-types";
import { localRepository } from "../local-repositories";
import { ensureDemoWorkspace } from "../local-repositories/demo-workspace";
import { queryKeys } from "../query-keys";

interface ListLayersOptions {
  cursor?: string;
  limit?: number;
}

export async function listLocalLayers(projectId: string): Promise<Layer[]> {
  await ensureDemoWorkspace();
  const entities = await localRepository.listEntities("layer");
  return entities
    .map((entity) =>
      layerSchema.parse(
        entity.payload?.entity === "layer" ? entity.payload.data : undefined,
      ),
    )
    .filter((layer) => layer.projectId === projectId)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}

export async function listLocalLayersPage(
  projectId: string,
  limit = 100,
): Promise<{ items: Layer[]; truncated: boolean }> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const items = await listLocalLayers(projectId);
  return { items: items.slice(0, safeLimit), truncated: items.length > safeLimit };
}

async function getLocalLayer(layerId: string): Promise<Layer | null> {
  const workspaceId = await localRepository.workspaceId();
  const entity = await localRepository.getEntity(workspaceId, "layer", layerId);
  if (!entity || entity.deleted) return null;
  return layerSchema.parse(
    entity.payload?.entity === "layer" ? entity.payload.data : undefined,
  );
}

export function useProjectLayers(
  projectId: string,
  options: ListLayersOptions = {},
) {
  const { cursor, limit } = options;
  return useQuery({
    queryKey: [...queryKeys.layersPage(projectId, cursor), limit ?? "all", "local"],
    queryFn: async () => {
      const items = await listLocalLayers(projectId);
      const offset = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0;
      const page = limit ? items.slice(offset, offset + limit) : items.slice(offset);
      const nextOffset = limit && offset + limit < items.length ? offset + limit : null;
      return { items: page, nextCursor: nextOffset === null ? null : String(nextOffset) };
    },
    enabled: projectId.trim().length > 0,
  });
}

export function useLayer(layerId: string) {
  return useQuery({
    queryKey: [...queryKeys.layer(layerId), "local"],
    queryFn: () => getLocalLayer(layerId),
    enabled: layerId.trim().length > 0,
  });
}

export function useCreateLayer(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLayerInput): Promise<Layer> => {
      const parsed = createLayerSchema.parse({ ...input, projectId });
      const timestamp = new Date().toISOString();
      const layer = layerSchema.parse({
        id: crypto.randomUUID(),
        ...parsed,
        description: parsed.description ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      const payload = syncEntityPayloadSchema.parse({
        entity: "layer",
        data: layer,
      });
      await localRepository.mutate({
        entity: "layer",
        entityId: layer.id,
        operation: "upsert",
        baseVersion: null,
        payload,
      });
      return layer;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.layersByProject(projectId) }),
        queryClient.invalidateQueries({ queryKey: ["analytics-layers"] }),
      ]);
    },
  });
}
