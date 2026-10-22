import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectPage from "./ProjectPage";

const mocks = vi.hoisted(() => ({
  useProject: vi.fn(),
  useProjectLayers: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, ...props }: { children: React.ReactNode; to: string; params?: { projectId?: string }; [key: string]: unknown }) => (
    <a href={params?.projectId ? to.replace("$projectId", params.projectId) : to} {...props}>{children}</a>
  ),
  useParams: () => ({ projectId: "project-1" }),
}));
vi.mock("@markmap/ui", () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <button {...props}>{children}</button>,
  Skeleton: (props: Record<string, unknown>) => <div {...props} />,
}));
vi.mock("../../lib/hooks/projects", () => ({ useProject: mocks.useProject }));
vi.mock("../../lib/hooks/layers", () => ({ useProjectLayers: mocks.useProjectLayers }));

const project = {
  id: "project-1",
  name: "Projeto local",
  description: null,
  status: "active",
};

describe("ProjectPage local layers", () => {
  it("does not show the empty message while layers are pending or failed", () => {
    mocks.useProject.mockReturnValue({ data: project, isLoading: false, isError: false });
    mocks.useProjectLayers.mockReturnValue({ isLoading: true, isError: false, data: undefined });
    const { rerender } = render(<ProjectPage />);
    expect(screen.getByText("Carregando camadas locais…", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/Ainda não há camadas/)).not.toBeInTheDocument();

    mocks.useProjectLayers.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch: vi.fn() });
    rerender(<ProjectPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.queryByText(/Ainda não há camadas/)).not.toBeInTheDocument();
  });

  it("renders the local project layers and partial-result notice", () => {
    mocks.useProject.mockReturnValue({ data: project, isLoading: false, isError: false });
    mocks.useProjectLayers.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [{ id: "layer-1", name: "Pontos", geometryType: "Point", kind: "point" }],
        nextCursor: "100",
      },
    });

    render(<ProjectPage />);
    expect(screen.getByRole("list", { name: "Camadas locais do projeto" })).toHaveTextContent("Pontos");
    expect(screen.getByText("Resumo parcial: até 100 camadas deste projeto.", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/Ainda não há camadas/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir mapa" })).toHaveAttribute("href", "/projects/project-1/map");
  });

  it("shows the empty message only after a successful empty response", () => {
    mocks.useProject.mockReturnValue({ data: project, isLoading: false, isError: false });
    mocks.useProjectLayers.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [], nextCursor: null },
    });

    render(<ProjectPage />);
    expect(screen.getByText(/Ainda não há camadas neste projeto local/)).toBeInTheDocument();
  });
});
