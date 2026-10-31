import { createElement } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "../lib/api-client";
import {
  useCreateProject,
  useProject,
  useProjectPages,
} from "../lib/hooks/projects";

const localRepository = vi.hoisted(() => ({
  workspaceId: vi.fn(),
  listEntities: vi.fn(),
  getEntity: vi.fn(),
  mutate: vi.fn(),
  pendingProjectMeshCleanupIds: vi.fn(),
}));

vi.mock("../lib/api-client", () => ({ listProjects: vi.fn() }));
vi.mock("../lib/local-repositories", () => ({ localRepository }));

const workspaceId = "00000000-0000-4000-8000-000000000010";
const projectId = "00000000-0000-4000-8000-000000000011";

const project = {
  id: projectId,
  name: "Araguaína local",
  description: "Projeto salvo no dispositivo",
  status: "active" as const,
  createdAt: "2026-09-30T12:00:00.000Z",
  updatedAt: "2026-09-30T12:00:00.000Z",
};

function entityFor(value: typeof project) {
  return {
    key: `${workspaceId}:project:${value.id}`,
    workspaceId,
    entity: "project" as const,
    entityId: value.id,
    version: 0,
    deleted: false,
    payload: { entity: "project" as const, data: value },
    updatedAt: value.updatedAt,
    predecessorOperationId: "00000000-0000-4000-8000-000000000012",
  };
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localRepository.workspaceId.mockResolvedValue(workspaceId);
  localRepository.listEntities.mockResolvedValue([]);
  localRepository.getEntity.mockResolvedValue(null);
  localRepository.mutate.mockResolvedValue({});
  localRepository.pendingProjectMeshCleanupIds.mockResolvedValue([]);
});

describe("projetos locais", () => {
  it("lista os projetos do repositório local sem chamar a API", async () => {
    localRepository.listEntities.mockResolvedValue([entityFor(project)]);
    const client = newClient();

    const { result } = renderHook(() => useProjectPages(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([project]);
    expect(localRepository.workspaceId).toHaveBeenCalled();
    expect(localRepository.listEntities).toHaveBeenCalledWith(
      "project",
      workspaceId,
    );
    expect(listProjects).not.toHaveBeenCalled();
    client.clear();
  });

  it("lê o detalhe do projeto pelo workspace e pelo identificador local", async () => {
    localRepository.getEntity.mockResolvedValue(entityFor(project));
    const client = newClient();

    const { result } = renderHook(() => useProject(projectId), {
      wrapper: wrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(project);
    expect(localRepository.getEntity).toHaveBeenCalledWith(
      workspaceId,
      "project",
      projectId,
    );
    expect(listProjects).not.toHaveBeenCalled();
    client.clear();
  });

  it("cria projeto com payload canônico e invalida a lista local", async () => {
    let localEntities: unknown[] = [];
    localRepository.listEntities.mockImplementation(async () => localEntities);
    localRepository.mutate.mockImplementation(async (input) => {
      localEntities = [
        {
          ...entityFor(input.payload.data),
          predecessorOperationId: input.entityId,
        },
      ];
      return input;
    });
    const client = newClient();

    const { result } = renderHook(
      () => ({ pages: useProjectPages(), create: useCreateProject() }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({
        name: "  Projeto offline  ",
        description: "  descrição local  ",
      });
    });

    const [mutation] = localRepository.mutate.mock.calls;
    expect(mutation[0]).toMatchObject({
      entity: "project",
      operation: "upsert",
      baseVersion: null,
    });
    expect(mutation[0].entityId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(mutation[0].payload).toMatchObject({
      entity: "project",
      data: {
        id: mutation[0].entityId,
        name: "Projeto offline",
        description: "descrição local",
        status: "active",
      },
    });
    expect(mutation[0].payload.data.createdAt).toEqual(
      mutation[0].payload.data.updatedAt,
    );
    await waitFor(() =>
      expect(result.current.pages.data?.items[0]?.name).toBe("Projeto offline"),
    );
    expect(localRepository.listEntities.mock.calls.length).toBeGreaterThan(1);
    expect(listProjects).not.toHaveBeenCalled();
    client.clear();
  });
});
