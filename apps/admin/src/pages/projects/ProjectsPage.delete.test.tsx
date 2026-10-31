import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "./ProjectsPage";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(async () => ({ meshCleanupPending: false })),
  toast: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode; to: string; params?: unknown }) =>
    <a href={rest.to}>{children}</a>,
}));
vi.mock("@markmap/ui", () => ({
  Button: ({ children, loading: _loading, ...props }: { children: React.ReactNode; loading?: boolean; [key: string]: unknown }) => <button {...props}>{children}</button>,
  Input: (props: Record<string, unknown>) => <input {...props} />,
  EmptyState: () => <div />,
  Skeleton: () => <div />,
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("../../lib/hooks/projects", () => ({
  useProjectPages: () => ({ data: { items: [{ id: "project-1", name: "Campo A", status: "active", updatedAt: "2026-10-30T00:00:00Z" }] },
    isLoading: false, isError: false, hasNextPage: false }),
  useCreateProject: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteProject: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));

describe("exclusão confirmada em Projetos", () => {
  beforeEach(() => {
    mocks.remove.mockReset().mockResolvedValue({ meshCleanupPending: false });
    mocks.toast.mockClear();
  });
  it("permite cancelar ou confirmar com dois cliques, sem digitar o nome", async () => {
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto Campo A" }));
    expect(screen.getByText(/Esta ação não poderá ser desfeita/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Confirmar nome do projeto" })).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Excluir definitivamente" });
    expect(confirm).toBeEnabled();
    expect(mocks.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Excluir definitivamente" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto Campo A" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(1));
    expect(mocks.remove).toHaveBeenCalledWith({ projectId: "project-1", expectedName: "Campo A" });
  });

  it("mantém a confirmação aberta quando a exclusão falha", async () => {
    mocks.remove.mockRejectedValueOnce(new Error("O registro mudou em outra aba."));
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto Campo A" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Não foi possível excluir o projeto", variant: "error",
    })));
    expect(screen.getByRole("button", { name: "Excluir definitivamente" })).toBeInTheDocument();
  });
});
