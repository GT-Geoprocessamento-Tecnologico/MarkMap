import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  projectSchema,
  syncEntityPayloadSchema,
  type CreateProject,
  type Project,
} from "@markmap/contracts";
import { localRepository } from "../local-repositories";
import { meshStore } from "../mesh/mesh-store";
import { ensureDemoWorkspace } from "../local-repositories/demo-workspace";
import { queryKeys } from "../query-keys";

/** Repair a previous crash between the main DB tombstone commit and the
 * separate GLB IndexedDB cleanup, without blocking the project list. */
export async function retryPendingProjectMeshes(): Promise<void> {
  for (const projectId of await localRepository.pendingProjectMeshCleanupIds()) {
    try {
      await meshStore.removeProjectMeshes(projectId);
      await localRepository.completeProjectMeshCleanup(projectId);
    } catch { /* Durable cleanup marker remains for the next load. */ }
  }
}

async function listLocalProjects(): Promise<Project[]> {
  await ensureDemoWorkspace();
  await retryPendingProjectMeshes();
  const workspaceId = await localRepository.workspaceId();
  const entities = await localRepository.listEntities("project", workspaceId);
  return entities.map((entity) => {
    const parsed = projectSchema.parse(
      entity.payload?.entity === "project" ? entity.payload.data : undefined,
    );
    if (parsed.id !== entity.entityId) {
      throw new Error("O projeto local não corresponde ao identificador armazenado.");
    }
    return parsed;
  });
}

async function getLocalProject(projectId: string): Promise<Project | null> {
  const workspaceId = await localRepository.workspaceId();
  const entity = await localRepository.getEntity(workspaceId, "project", projectId);
  if (!entity || entity.deleted) return null;
  const parsed = projectSchema.parse(
    entity.payload?.entity === "project" ? entity.payload.data : undefined,
  );
  if (parsed.id !== projectId) {
    throw new Error("O projeto local não corresponde ao identificador solicitado.");
  }
  return parsed;
}

export function useProjects(options: { cursor?: string; limit?: number } = {}) {
  const { cursor, limit } = options;
  return useQuery({
    queryKey: [...queryKeys.projectsList(cursor), limit ?? "all", "local"],
    queryFn: async () => {
      const items = await listLocalProjects();
      const offset = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0;
      const page = limit ? items.slice(offset, offset + limit) : items.slice(offset);
      return { items: page, nextCursor: null };
    },
  });
}

export function useProjectPages() {
  const query = useQuery({
    queryKey: [...queryKeys.projects(), "local-pages"],
    queryFn: async () => ({ items: await listLocalProjects(), nextCursor: null }),
  });
  return {
    ...query,
    data: query.data,
    hasNextPage: false,
    fetchNextPage: async () => undefined,
    isFetchingNextPage: false,
  };
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: [...queryKeys.project(projectId), "local"],
    queryFn: () => getLocalProject(projectId),
    enabled: projectId.trim().length > 0,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProject): Promise<Project> => {
      const createdAt = new Date().toISOString();
      const project = projectSchema.parse({
        id: crypto.randomUUID(),
        name: input.name.trim(),
        ...(input.description?.trim()
          ? { description: input.description.trim() }
          : {}),
        status: "active",
        createdAt,
        updatedAt: createdAt,
      });
      const payload = syncEntityPayloadSchema.parse({
        entity: "project",
        data: project,
      });
      await localRepository.mutate({
        entity: "project",
        entityId: project.id,
        operation: "upsert",
        baseVersion: null,
        payload,
      });
      return project;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
  });
}


/** A delete is durable offline before any mesh cleanup is attempted. */
export async function deleteLocalProject(projectId: string, expectedName: string): Promise<{ meshCleanupPending: boolean }> {
  await localRepository.deleteOwnedTree({ kind: "project", id: projectId, expectedName });
  try {
    await meshStore.removeProjectMeshes(projectId);
    await localRepository.completeProjectMeshCleanup(projectId);
    return { meshCleanupPending: false };
  } catch {
    // Do not claim that the mesh bytes were removed. This marker is retried
    // when projects are listed again, even after an app restart.
    return { meshCleanupPending: true };
  }
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, expectedName }: { projectId: string; expectedName: string }) =>
      deleteLocalProject(projectId, expectedName),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
        queryClient.invalidateQueries({ queryKey: ["layers"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.features() }),
        queryClient.invalidateQueries({ queryKey: ["analytics-layers"] }),
        queryClient.invalidateQueries({ queryKey: ["meshes"] }),
      ]);
    },
  });
}
