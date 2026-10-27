import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { sync, routerView, workspaceId } = vi.hoisted(() => ({
  sync: vi.fn(() => null),
  routerView: vi.fn(() => null),
  workspaceId: vi.fn(),
}));

vi.mock("./router", () => ({ router: {} }));
vi.mock("@tanstack/react-router", () => ({ RouterProvider: routerView }));
vi.mock("./lib/sync/SyncController", () => ({ SyncController: sync }));
vi.mock("./lib/sync/SyncStatus", () => ({ SyncStatus: () => null }));
vi.mock("./lib/local-repositories", () => ({ localRepository: { workspaceId, listOutbox: vi.fn() } }));
vi.mock("./components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("./components/pwa/NetworkStatusBanner", () => ({ NetworkStatusBanner: () => null }));
vi.mock("./components/pwa/PwaInstallPrompt", () => ({
  PwaInstallPrompt: () => <span>Instalação PWA</span>,
}));
vi.mock("./lib/pwa-install", () => ({
  isPwaStandalone: () => false,
  shouldShowPwaInstallFlow: (search: string, standalone: boolean) =>
    !standalone && new URLSearchParams(search).get("install") === "1",
}));
vi.mock("./components/backup/BackupRestoreCard", async () => {
  const { useQueryClient } = await import("@tanstack/react-query");
  const { useToast } = await import("@markmap/ui");
  return {
    BackupRestoreCard: () => {
      useQueryClient();
      useToast();
      return <button type="button">Restaurar Backup</button>;
    },
  };
});

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

describe("modo de recuperação do app", () => {
  it("oferece recuperação isolada sem montar sync, router ou inicializar workspace", () => {
      window.history.replaceState(null, "", "/?restore=1");
      render(<App />);
      expect(screen.getByRole("heading", { name: "Recuperar backup" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Restaurar Backup" })).toBeInTheDocument();
      expect(screen.getByText(/perfil novo ou vazio/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Voltar ao aplicativo" })).toHaveAttribute("href", "/");
      expect(sync).not.toHaveBeenCalled();
      expect(routerView).not.toHaveBeenCalled();
      expect(workspaceId).not.toHaveBeenCalled();
  });

  it("preserva o fluxo de instalação quando ambos os parâmetros estão presentes", () => {
    window.history.replaceState(null, "", "/?restore=1&install=1");
    render(<App />);
    expect(screen.getByText("Instalação PWA")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recuperar backup" })).not.toBeInTheDocument();
    expect(sync).not.toHaveBeenCalled();
    expect(routerView).not.toHaveBeenCalled();
    expect(workspaceId).not.toHaveBeenCalled();
  });

  it("monta o app operacional quando o modo de recuperação não foi solicitado", () => {
    window.history.replaceState(null, "", "/?restore=0");
    render(<App />);
    expect(sync).toHaveBeenCalled();
    expect(routerView).toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Recuperar backup" })).not.toBeInTheDocument();
  });
});
