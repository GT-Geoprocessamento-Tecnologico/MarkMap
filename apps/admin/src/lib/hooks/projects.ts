import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProject } from '@geonexo/contracts';
import { createProject, getProject, listProjects } from '../api-client';
import { queryKeys } from '../query-keys';

interface ListProjectsOptions {
  cursor?: string;
  limit?: number;
}

export function useProjects(options: ListProjectsOptions = {}) {
  const { cursor, limit } = options;
  return useQuery({
    queryKey: queryKeys.projectsList(cursor),
    queryFn: ({ signal }) => listProjects({ cursor, limit, signal }),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => getProject(projectId, signal),
    enabled: projectId.trim().length > 0,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProject) => createProject(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
  });
}
