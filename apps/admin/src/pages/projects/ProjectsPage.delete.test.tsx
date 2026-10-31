import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("não exclui sem digitar o nome exato, e permite cancelar", async () => {
    mocks.remove.mockClear();
    render(<ProjectsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto Campo A" }));
    const confirm = screen.getByRole("button", { name: "Excluir definitivamente" });
    expect(confirm).toBeDisabled();
    const input = screen.getByRole("textbox", { name: "Confirmar nome do projeto" });
    fireEvent.change(input, { target: { value: "Errado" } });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir projeto Campo A" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Confirmar nome do projeto" }), { target: { value: "Campo A" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir definitivamente" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ projectId: "project-1", expectedName: "Campo A" }));
  });
});
