import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatus } from "./SyncStatus";

const mocks = vi.hoisted(() => ({
  listOutbox: vi.fn(),
  listConflicts: vi.fn(),
  setMeta: vi.fn(),
  getMeta: vi.fn(),
  syncNow: vi.fn(),
  resumeRecoveryPause: vi.fn(),
  recoverStaleSyncClaim: vi.fn(),
}));
vi.mock("../api-client", () => ({ API_MODE: "live" }));
vi.mock("../local-repositories", () => ({ localRepository: mocks }));
vi.mock("./sync-engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./sync-engine")>()),
  syncNow: mocks.syncNow,
  resumeRecoveryPause: mocks.resumeRecoveryPause,
  recoverStaleSyncClaim: mocks.recoverStaleSyncClaim,
}));

const PAUSE_A = { kind: "restore", generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const PAUSE_B = { kind: "restore", generation: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
const CLAIM_TOKEN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VALID_CLAIM = { protocol: "weblocks-v1", token: CLAIM_TOKEN };
const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
const enableLocks = () => Object.defineProperty(navigator, "locks", {
  configurable: true, value: { request: vi.fn() },
});

beforeEach(() => {
  mocks.listOutbox.mockResolvedValue([]);
  mocks.listConflicts.mockResolvedValue([]);
  mocks.setMeta.mockResolvedValue(undefined);
  mocks.resumeRecoveryPause.mockResolvedValue(true);
  mocks.recoverStaleSyncClaim.mockResolvedValue(false);
  mocks.getMeta.mockResolvedValue(undefined);
  mocks.syncNow.mockResolvedValue({ state: "synced", pushed: 0, pulled: 0, conflicts: 0, pending: 0 });
});

afterEach(() => {
  cleanup();
  if (originalLocks) Object.defineProperty(navigator, "locks", originalLocks);
  else Reflect.deleteProperty(navigator, "locks");
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const showPaused = async () => {
  mocks.getMeta.mockImplementation(async (key: string) => key === "syncPausedAfterRestore" ? PAUSE_A : undefined);
  await act(async () => {
    window.dispatchEvent(new CustomEvent("geonexo-sync-status", {
      detail: { state: "paused", pushed: 0, pulled: 0, conflicts: 0, pending: 0 },
    }));
  });
};

describe("pausa após restauração", () => {
  it("mostra a pausa persistente mesmo offline sem iniciar sync", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    mocks.getMeta.mockImplementation(async (key: string) => key === "syncPausedAfterRestore" ? PAUSE_A : undefined);
    render(<SyncStatus />);
    expect(await screen.findByText("Sincronização pausada após restauração")).toBeInTheDocument();
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });

  it("mostra pausa por segurança se a leitura do marcador falhar", async () => {
    mocks.getMeta.mockRejectedValue(new Error("IndexedDB indisponível"));
    render(<SyncStatus />);
    expect(await screen.findByText("Não foi possível verificar a sincronização local.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retomar sincronização" })).not.toBeInTheDocument();
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });

  it("apresenta trava existente como outra aba ou sincronização interrompida sem oferecer retomada", async () => {
    mocks.getMeta.mockImplementation(async (key: string) =>
      key === "syncInProgress" ? "token-existente" : PAUSE_A,
    );
    render(<SyncStatus />);
    expect(await screen.findByText(/Sincronização em outra aba ou interrompida/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retomar sincronização" })).not.toBeInTheDocument();
    expect(mocks.setMeta).not.toHaveBeenCalled();
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });

  it("só oferece revisão para claim v1 válido com Web Locks disponível", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
    mocks.getMeta.mockImplementation(async (key: string) => key === "syncInProgress" ? VALID_CLAIM : PAUSE_A);
    const first = render(<SyncStatus />);
    expect(await screen.findByText(/Sincronização em outra aba ou interrompida/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verificar sincronização interrompida" })).not.toBeInTheDocument();
    first.unmount();
    enableLocks();
    mocks.getMeta.mockImplementation(async (key: string) => key === "syncInProgress" ? "claim-legado" : PAUSE_A);
    render(<SyncStatus />);
    expect(await screen.findByText(/Sincronização em outra aba ou interrompida/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verificar sincronização interrompida" })).not.toBeInTheDocument();
    expect(mocks.recoverStaleSyncClaim).not.toHaveBeenCalled();
  });

  it.each(["ocupada", "alterada"])("trava %s não é liberada e não inicia sync", async (scenario) => {
    enableLocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let active = VALID_CLAIM;
    mocks.getMeta.mockImplementation(async (key: string) => key === "syncInProgress" ? active : PAUSE_A);
    mocks.recoverStaleSyncClaim.mockResolvedValue(false);
    render(<SyncStatus />);
    const button = await screen.findByRole("button", { name: "Verificar sincronização interrompida" });
    if (scenario === "alterada") active = { protocol: "weblocks-v1", token: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível liberar a trava");
    expect(mocks.recoverStaleSyncClaim).toHaveBeenCalledWith(CLAIM_TOKEN);
    expect(mocks.syncNow).not.toHaveBeenCalled();
    expect(mocks.resumeRecoveryPause).not.toHaveBeenCalled();
    expect(mocks.setMeta).not.toHaveBeenCalled();
  });

  it("revisão confirmada libera somente claim, mantém pausa e não inicia sync", async () => {
    enableLocks();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    let active: typeof VALID_CLAIM | undefined = VALID_CLAIM;
    mocks.getMeta.mockImplementation(async (key: string) => key === "syncInProgress" ? active : PAUSE_A);
    mocks.recoverStaleSyncClaim.mockImplementation(async (token: string) => {
      expect(token).toBe(CLAIM_TOKEN);
      active = undefined;
      return true;
    });
    render(<SyncStatus />);
    fireEvent.click(await screen.findByRole("button", { name: "Verificar sincronização interrompida" }));
    expect(await screen.findByText("Sincronização pausada após restauração")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Retomar sincronização" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Confirme a retomada separadamente");
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/requisição anterior pode já ter sido enviada/i));
    expect(mocks.syncNow).not.toHaveBeenCalled();
    expect(mocks.resumeRecoveryPause).not.toHaveBeenCalled();
    expect(mocks.setMeta).not.toHaveBeenCalled();
  });

  it("mantém aviso de trava quando o claim existe mas não expõe um valor legível", async () => {
    mocks.getMeta.mockResolvedValue(undefined);
    render(<SyncStatus />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("geonexo-sync-status", {
        detail: { state: "locked", pushed: 0, pulled: 0, conflicts: 0, pending: 0 },
      }));
    });
    expect(await screen.findByText(/Sincronização em outra aba ou interrompida/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retomar sincronização" })).not.toBeInTheDocument();
  });

  it("não remove pausa quando uma trava aparece antes da confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SyncStatus />);
    await showPaused();
    const button = await screen.findByRole("button", { name: "Retomar sincronização" });
    mocks.getMeta.mockImplementation(async (key: string) =>
      key === "syncInProgress" ? "token-existente" : PAUSE_A,
    );
    mocks.resumeRecoveryPause.mockResolvedValue(false);
    fireEvent.click(button);
    expect(await screen.findByText(/Sincronização em outra aba ou interrompida/)).toBeInTheDocument();
    expect(mocks.setMeta).not.toHaveBeenCalled();
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });

  it("exige confirmação explícita antes de reativar e sincronizar", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<SyncStatus />);
    await showPaused();
    const button = await screen.findByRole("button", { name: "Retomar sincronização" });
    fireEvent.click(button);
    expect(mocks.resumeRecoveryPause).not.toHaveBeenCalled();
    expect(mocks.syncNow).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/outras abas/i));
    fireEvent.click(button);
    await waitFor(() => expect(mocks.resumeRecoveryPause).toHaveBeenCalledWith(PAUSE_A.generation));
    await waitFor(() => expect(mocks.syncNow).toHaveBeenCalledOnce());
  });

  it("não autoriza geração nova com confirmação exibida para pausa anterior", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<SyncStatus />);
    await showPaused();
    const button = await screen.findByRole("button", { name: "Retomar sincronização" });
    mocks.getMeta.mockImplementation(async (key: string) => key === "syncPausedAfterRestore" ? PAUSE_B : undefined);
    mocks.resumeRecoveryPause.mockResolvedValue(false);
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("A pausa mudou");
    expect(mocks.resumeRecoveryPause).toHaveBeenCalledWith(PAUSE_A.generation);
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });

  it("não chama sync se a remoção da pausa falhar", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.resumeRecoveryPause.mockResolvedValue(false);
    render(<SyncStatus />);
    await showPaused();
    fireEvent.click(await screen.findByRole("button", { name: "Retomar sincronização" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A pausa mudou ou existe sincronização");
    expect(mocks.syncNow).not.toHaveBeenCalled();
  });
});
