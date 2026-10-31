import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AnalyticsPage from "./AnalyticsPage";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(async () => ({ deleted: true })),
  toast: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { rows: [{ id: "layer-1", name: "Pontos", geometryType: "Point", kind: "point", createdAt: "2026-10-30T00:00:00Z" }] }, isLoading: false, isError: false }),
}));
vi.mock("@markmap/contracts", () => ({ layerSchema: { parse: (value: unknown) => value } }));
vi.mock("@markmap/ui", () => ({
  Button: ({ children, loading: _loading, ...props }: { children: React.ReactNode; loading?: boolean; [key: string]: unknown }) => <button {...props}>{children}</button>,
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("../../lib/hooks/projects", () => ({
  useProjects: () => ({ isSuccess: true, isLoading: false, isError: false, data: { items: [{ id: "p1" }], nextCursor: null } }),
}));
vi.mock("../../lib/hooks/layers", () => ({
  useDeleteLayer: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));

describe("exclusão de camada em Análises e Métricas", () => {
  it("exige confirmação por nome, sem permitir apagar apenas o contador", async () => {
    mocks.remove.mockClear();
    render(<AnalyticsPage />);
    expect(screen.getByText("Projetos consultados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir camada Pontos" }));
    expect(screen.getByText(/indicadores exibidos aqui são calculados/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Excluir definitivamente" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Confirmar nome da camada" }), { target: { value: "Pontos" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ layerId: "layer-1", expectedName: "Pontos" }));
  });
});
