import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLayer, getLayer, listProjectLayers } from '../api-client';
import type { CreateLayerInput } from '../api-types';
import { queryKeys } from '../query-keys';

interface ListLayersOptions {
  cursor?: string;
  limit?: number;
}

export function useProjectLayers(projectId: string, options: ListLayersOptions = {}) {
  const { cursor, limit } = options;
  return useQuery({
    queryKey: [...queryKeys.layersPage(projectId, cursor), limit ?? 'default'],
    queryFn: ({ signal }) => listProjectLayers(projectId, { cursor, limit, signal }),
    enabled: projectId.trim().length > 0,
  });
}

export function useLayer(layerId: string) {
  return useQuery({
    queryKey: queryKeys.layer(layerId),
    queryFn: ({ signal }) => getLayer(layerId, signal),
    enabled: layerId.trim().length > 0,
  });
}

export function useCreateLayer(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLayerInput) => createLayer(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.layersByProject(projectId) }),
  });
}
