import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assertGeometryCompatible,
  createFeatureSchema,
  featureSchema,
  layerSchema,
  syncEntityPayloadSchema,
  type Bbox,
  type Feature,
} from "@markmap/contracts";
import type { CreateFeatureInput, UpdateFeatureInput } from "../api-types";
import { localRepository } from "../local-repositories";
import { queryKeys } from "../query-keys";

export interface UpdateFeatureVariables extends UpdateFeatureInput {
  id: string;
}

function overlapsBbox(feature: Feature, bbox?: Bbox): boolean {
  if (!bbox) return true;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      minLng = Math.min(minLng, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLng = Math.max(maxLng, value[0]);
      maxLat = Math.max(maxLat, value[1]);
      return;
    }
    for (const child of value) visit(child);
  };
  visit(feature.geometry.coordinates);
  return !(
    maxLng < bbox.minLng ||
    minLng > bbox.maxLng ||
    maxLat < bbox.minLat ||
    minLat > bbox.maxLat
  );
}

async function localLayerGeometryType(layerId: string) {
  const workspaceId = await localRepository.workspaceId();
  const layerEntity = await localRepository.getEntity(workspaceId, "layer", layerId);
  if (!layerEntity || layerEntity.deleted)
    throw new Error("Camada não encontrada neste dispositivo.");
  return layerSchema.parse(
    layerEntity.payload?.entity === "layer"
      ? layerEntity.payload.data
      : undefined,
  ).geometryType;
}

export async function listLocalFeatures(layerId: string, bbox?: Bbox): Promise<Feature[]> {
  const entities = await localRepository.listEntities("feature");
  return entities
    .map((entity) =>
      featureSchema.parse(
        entity.payload?.entity === "feature" ? entity.payload.data : undefined,
      ),
    )
    .filter((feature) => feature.layerId === layerId && overlapsBbox(feature, bbox))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function useFeatures(layerId: string, bbox?: Bbox) {
  return useQuery({
    queryKey: [...queryKeys.featuresPage(layerId, bbox), "local"],
    queryFn: async () => ({
      items: await listLocalFeatures(layerId, bbox),
      nextCursor: null,
    }),
    enabled: layerId.trim().length > 0,
  });
}

export async function createLocalFeature(
  layerId: string,
  input: CreateFeatureInput,
): Promise<Feature> {
  const parsed = createFeatureSchema.parse({ ...input, layerId });
  assertGeometryCompatible(
    parsed.geometry,
    await localLayerGeometryType(layerId),
  );
  const timestamp = new Date().toISOString();
  const feature = featureSchema.parse({
    id: crypto.randomUUID(),
    layerId,
    geometry: parsed.geometry,
    properties: parsed.properties,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const payload = syncEntityPayloadSchema.parse({
    entity: "feature",
    data: feature,
  });
  await localRepository.mutate({
    entity: "feature",
    entityId: feature.id,
    operation: "upsert",
    baseVersion: null,
    payload,
  });
  return feature;
}

export function useCreateFeature(layerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFeatureInput) =>
      createLocalFeature(layerId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.featuresByLayer(layerId) }),
  });
}

export async function updateLocalFeature(variables: UpdateFeatureVariables): Promise<Feature> {
  const workspaceId = await localRepository.workspaceId();
  const entity = await localRepository.getEntity(
    workspaceId,
    "feature",
    variables.id,
  );
  if (!entity || entity.deleted || entity.payload?.entity !== "feature")
    throw new Error("Feição não encontrada neste dispositivo.");
  const current = featureSchema.parse(entity.payload.data);
  if (current.version !== variables.version)
    throw new Error(
      "Esta feição mudou desde a última edição. Reabra os dados antes de salvar.",
    );
  const nextGeometry = variables.geometry ?? current.geometry;
  assertGeometryCompatible(
    nextGeometry,
    await localLayerGeometryType(current.layerId),
  );
  const next = featureSchema.parse({
    ...current,
    geometry: nextGeometry,
    properties: variables.properties ?? current.properties,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  });
  const payload = syncEntityPayloadSchema.parse({
    entity: "feature",
    data: next,
  });
  await localRepository.mutate({
    entity: "feature",
    entityId: next.id,
    operation: "upsert",
    baseVersion: entity.version,
    payload,
  });
  return next;
}

export function useUpdateFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateLocalFeature,
    onSuccess: (feature) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.featuresByLayer(feature.layerId),
      }),
  });
}

export async function deleteLocalFeature(featureId: string): Promise<void> {
  const workspaceId = await localRepository.workspaceId();
  const entity = await localRepository.getEntity(
    workspaceId,
    "feature",
    featureId,
  );
  if (!entity || entity.deleted)
    throw new Error("Feição não encontrada neste dispositivo.");
  await localRepository.mutate({
    entity: "feature",
    entityId: featureId,
    operation: "delete",
    baseVersion: entity.version,
  });
}

export function useDeleteFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteLocalFeature,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.features() }),
  });
}
