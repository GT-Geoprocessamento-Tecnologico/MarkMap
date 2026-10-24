import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listLocalLayersPage, useCreateLayer } from "./layers";

const { localRepository } = vi.hoisted(() => ({
  localRepository: { listEntities: vi.fn(), mutate: vi.fn() },
}));

vi.mock("../local-repositories", () => ({ localRepository }));
vi.mock("../local-repositories/demo-workspace", () => ({
  ensureDemoWorkspace: vi.fn(async () => undefined),
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const layerId = (index: number) => `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`;

const layerEntity = (index: number, owner = projectId) => ({
  entityId: layerId(index),
  payload: {
    entity: "layer",
    data: {
      id: layerId(index),
      projectId: owner,
      name: `Camada ${index}`,
      description: null,
      kind: "point",
      geometryType: "Point",
      srid: 4674,
      style: {},
      metadata: {},
      visibleByDefault: true,
      sortOrder: index,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
});

describe("local analytics layer reader", () => {
  it("reads validated local layers and enforces the per-project bound", async () => {
    localRepository.listEntities.mockResolvedValue([
      ...Array.from({ length: 101 }, (_, index) => layerEntity(index)),
      layerEntity(999, "22222222-2222-4222-8222-222222222222"),
    ]);

    const page = await listLocalLayersPage(projectId, 100);

    expect(page.items).toHaveLength(100);
    expect(page.items[0]?.name).toBe("Camada 0");
    expect(page.items.at(-1)?.name).toBe("Camada 99");
    expect(page.truncated).toBe(true);
  });

  it("invalidates the cached analytics snapshot after creating a local layer", async () => {
    localRepository.mutate.mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const analyticsKey = ["analytics-layers", [projectId], "bounded", 100];
    queryClient.setQueryData(analyticsKey, {
      rows: [{ id: "existing", name: "Existente" }],
      truncated: false,
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);
    const hook = renderHook(() => useCreateLayer(projectId), { wrapper });

    await act(async () => {
      await hook.result.current.mutateAsync({
        name: "Nova camada local",
        kind: "point",
        geometryType: "Point",
        srid: 4674,
        style: {},
        metadata: {},
      });
    });

    expect(queryClient.getQueryState(analyticsKey)?.isInvalidated).toBe(true);
    expect(localRepository.mutate).toHaveBeenCalledWith(expect.objectContaining({
      entity: "layer",
      entityId: expect.any(String),
    }));
  });
});
