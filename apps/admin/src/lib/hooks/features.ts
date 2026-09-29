import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Bbox } from '@geonexo/contracts';
import { createFeature, deleteFeature, listFeatures, updateFeature } from '../api-client';
import type { CreateFeatureInput, UpdateFeatureInput } from '../api-types';
import { queryKeys } from '../query-keys';

/** Variaveis de `useUpdateFeature`: o `id` vem da feature selecionada. */
export interface UpdateFeatureVariables extends UpdateFeatureInput {
  id: string;
}

export function useFeatures(layerId: string, bbox?: Bbox) {
  return useQuery({
    queryKey: queryKeys.featuresPage(layerId, bbox),
    queryFn: ({ signal }) => listFeatures(layerId, { bbox, signal }),
    enabled: layerId.trim().length > 0,
  });
}

export function useCreateFeature(layerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFeatureInput) => createFeature(layerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.featuresByLayer(layerId) }),
  });
}

/**
 * Regras da mutacao de update (50-CONTRATOS-DE-INTEGRACAO.md:124-127):
 * - desative o botao enquanto `isPending` (guarda contra duplo submit);
 * - `retry` fica desligado, entao 409 chega em `error` como `ApiError`;
 * - nada de optimistic update: em conflito o usuario mantem o dado sujo
 *   e re-carrega (use `isConflict(error)` de `@/lib/errors`).
 */
export function useUpdateFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: UpdateFeatureVariables) => updateFeature(variables.id, variables),
    onSuccess: (feature) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.featuresByLayer(feature.layerId) }),
  });
}

export function useDeleteFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (featureId: string) => deleteFeature(featureId),
    // deleteFeature responde void (sem layerId), entao invalida a raiz features.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.features() }),
  });
}
