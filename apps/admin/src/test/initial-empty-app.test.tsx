import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@geonexo/ui";
import CoordinateSystemsPage from "../pages/dashboard/CoordinateSystemsPage";
import AnalyticsPage from "../pages/dashboard/AnalyticsPage";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) =>
    <a href={to}>{children}</a>,
}));
vi.mock("../lib/hooks/projects", () => ({
  useProjects: () => ({
    data: { items: [], nextCursor: null },
    isSuccess: true, isLoading: false, isError: false, refetch: vi.fn(),
  }),
}));

describe("primeira instalação", () => {
  it("não pré-cadastra CRS na interface", () => {
    localStorage.removeItem("geonexo_crs_systems");
    render(<ToastProvider><CoordinateSystemsPage /></ToastProvider>);
    expect(screen.getByText(/Nenhum sistema cadastrado/)).toBeInTheDocument();
    expect(screen.queryByText("EPSG:4326")).not.toBeInTheDocument();
  });
  it("preserva os CRS que já foram salvos pelo usuário", () => {
    localStorage.setItem("geonexo_crs_systems", JSON.stringify([
      { code: "EPSG:32622", name: "Meu CRS", type: "Customizado", region: "Local" },
    ]));
    render(<ToastProvider><CoordinateSystemsPage /></ToastProvider>);
    expect(screen.getByText("EPSG:32622")).toBeInTheDocument();
    localStorage.removeItem("geonexo_crs_systems");
  });
  it("Análises exibe o estado vazio sem ficar carregando indefinidamente", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><AnalyticsPage /></QueryClientProvider>);
    expect(screen.getByText("Nenhuma camada cadastrada nos projetos consultados.")).toBeInTheDocument();
    expect(screen.queryByText("Carregando dados…")).not.toBeInTheDocument();
    client.clear();
  });
});
