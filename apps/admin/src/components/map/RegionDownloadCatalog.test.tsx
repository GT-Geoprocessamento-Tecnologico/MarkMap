import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RegionDownloadCatalog } from "./RegionDownloadCatalog";

const mock = vi.hoisted(() => ({
  catalog: vi.fn(), list: vi.fn(), permission: vi.fn(), position: vi.fn(),
  auto: vi.fn(), persist: vi.fn(), install: vi.fn(), ensure: vi.fn(),
  locations: vi.fn(), selected: vi.fn(),
}));

vi.mock("../../lib/storage/offline-map-store", () => ({
  offlineMapStore: { list: mock.list },
}));
vi.mock("../../lib/storage/offline-map-selection", () => ({
  getSelectedOfflineMapId: () => null,
  setSelectedOfflineMapId: mock.selected,
  subscribeSelectedOfflineMapId: () => () => undefined,
}));
vi.mock("../../lib/storage/region-catalog-events.mjs", () => ({
  subscribeRegionCatalogChanges: () => () => undefined,
}));
vi.mock("../../lib/storage/resumable-installer", () => ({
  ResumableInstaller: class { abortInstall() {} },
}));
vi.mock("../../lib/storage/region-source-registry", () => ({
  rememberRegionSource: vi.fn(),
}));
vi.mock("../../lib/storage/region-install-feedback.mjs", () => ({
  describeRegionInstallError: () => ({ message: "Falha simulada" }),
}));
vi.mock("../../lib/storage/catalog-region-install", () => ({
  installCatalogRegion: mock.install,
}));
vi.mock("../../lib/location-consent", () => ({
  shouldAutoLocateOnOpen: mock.permission,
  getFreshDevicePosition: mock.position,
  rememberLocationApproval: vi.fn(async () => undefined),
}));
vi.mock("../../lib/device-location-permission", () => ({
  ensureLocationPermission: mock.ensure,
}));
vi.mock("../../lib/storage/auto-region-download", () => ({
  getAutomaticRegionDownload: mock.auto,
  setAutomaticRegionDownload: mock.persist,
}));
vi.mock("../../lib/storage/public-region-catalog", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/storage/public-region-catalog")>(),
  fetchPublicRegionCatalog: mock.catalog,
}));
vi.mock("../../lib/storage/region-location-index", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/storage/region-location-index")>(),
  fetchRegionLocationIndex: mock.locations,
}));

const region = {
  id: "araguaina", label: "Araguaína", area: "Tocantins",
  bounds: [-48.5, -7.6, -48.0, -7.0],
  manifestUrl: "https://maps.example.org/araguaina/manifest.json",
  sizeBytes: 2_000_000, attribution: "Fonte de testes",
};

describe("GPS region download UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.catalog.mockResolvedValue([region]);
    mock.list.mockResolvedValue([]);
    mock.permission.mockResolvedValue(true);
    mock.position.mockResolvedValue({ lon: -48.2, lat: -7.2, accuracyM: 20 });
    mock.auto.mockResolvedValue(false);
    mock.persist.mockResolvedValue(undefined);
    mock.ensure.mockResolvedValue({ state: "granted" });
    mock.install.mockResolvedValue({ kind: "error", code: "offline" });
    mock.locations.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("suggests the current region but does not download without consent", async () => {
    render(<RegionDownloadCatalog />);
    await screen.findByText(/Mapa sugerido pelo GPS: Araguaína/);
    expect(mock.install).not.toHaveBeenCalled();
    expect((screen.getByRole("checkbox", {
      name: "Baixar automaticamente o mapa da minha região",
    }) as HTMLInputElement).checked).toBe(false);
  });

  it("automatically downloads only after saved opt-in", async () => {
    mock.auto.mockResolvedValue(true);
    render(<RegionDownloadCatalog />);
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(1));
    expect(mock.install.mock.calls[0]?.[0].id).toBe(region.id);
    await screen.findByText("Falha simulada");
    expect(mock.install).toHaveBeenCalledTimes(1);
  });

  it("never reads GPS without permission and allows a manual gesture", async () => {
    mock.permission.mockResolvedValue(false);
    mock.auto.mockResolvedValue(true);
    render(<RegionDownloadCatalog />);
    await screen.findByText("Araguaína");
    expect(mock.position).not.toHaveBeenCalled();
    expect(mock.install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Encontrar mapa da minha localização" }));
    await waitFor(() => expect(mock.position).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(1));
  });

  it("checks immediately but downloads only after consent is durably saved", async () => {
    let finishSave: (() => void) | undefined;
    mock.persist.mockReturnValue(new Promise<void>(resolve => {
      finishSave = resolve;
    }));
    render(<RegionDownloadCatalog />);
    await screen.findByText(/Mapa sugerido pelo GPS: Araguaína/);
    const input = screen.getByRole("checkbox", {
      name: "Baixar automaticamente o mapa da minha região",
    }) as HTMLInputElement;
    fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(mock.persist).toHaveBeenCalledWith(true);
    expect(mock.install).not.toHaveBeenCalled();
    finishSave?.();
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(1));
  });

  it("filters published locations and sends two selected regions through one queue", async () => {
    const second = { ...region, id: "palmas", label: "Palmas", area: "Tocantins" };
    mock.catalog.mockResolvedValue([region, second]);
    mock.locations.mockResolvedValue([
      { regionId: region.id, stateCode: "TO", stateName: "Tocantins", kind: "city", cityName: "Araguaína" },
      { regionId: second.id, stateCode: "TO", stateName: "Tocantins", kind: "city", cityName: "Palmas" },
    ]);
    mock.install.mockImplementation(async (item: { id: string }) => ({
      kind: "installed", manifest: { id: item.id, label: item.id },
    }));
    render(<RegionDownloadCatalog />);
    await screen.findByText("Palmas");
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Araguaína" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Palmas" }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar selecionados" }));
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(2));
  });

  it("shows availability counts and puts uninstalled maps before installed maps", async () => {
    const maps = ["Araguaína", "Palmas", "Belém", "Recife", "Curitiba"].map((label, index) => ({
      ...region, id: `map-${index}`, label, area: "Brasil",
    }));
    mock.catalog.mockResolvedValue(maps);
    mock.list.mockResolvedValue(maps.slice(2, 5).map(item => ({ manifest: { id: item.id, label: item.label } })));
    const view = render(<RegionDownloadCatalog />);
    await screen.findByText("Araguaína");
    expect(screen.getByText("2 mapa(s) disponível(is) para baixar · 3 no aparelho")).toBeTruthy();
    const firstList = view.container.querySelector("ul");
    expect(firstList?.textContent?.indexOf("Araguaína")).toBeLessThan(firstList?.textContent?.indexOf("Belém") ?? -1);
    expect(firstList?.textContent?.indexOf("Palmas")).toBeLessThan(firstList?.textContent?.indexOf("Curitiba") ?? -1);
  });

  it("clears search and location filters after a no-results state", async () => {
    mock.catalog.mockResolvedValue([region]);
    render(<RegionDownloadCatalog />);
    await screen.findByText("Araguaína");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar mapas disponíveis" }), { target: { value: "inexistente" } });
    await screen.findByText("Não encontramos uma região com esse nome.");
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await screen.findByText("Araguaína");
  });

  it("keeps the catalog usable when the location index is unavailable", async () => {
    mock.catalog.mockResolvedValue([region]);
    mock.locations.mockRejectedValue(new Error("index unavailable"));
    render(<RegionDownloadCatalog />);
    await screen.findByText("Araguaína");
    await screen.findByText(/filtros de estado e cidade estão temporariamente indisponíveis/);
    expect(screen.getByText("Araguaína")).toBeTruthy();
  });

  it("shows a retry after a stalled catalog request and recovers", async () => {
    vi.useFakeTimers();
    mock.catalog.mockImplementationOnce((_signal: AbortSignal) => new Promise((_resolve, reject) => {
      _signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })).mockResolvedValueOnce([region]);
    try {
      render(<RegionDownloadCatalog />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
      });
      expect(screen.getByText(/A consulta de novos mapas demorou mais que o esperado/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
      await vi.waitFor(() => expect(screen.getByText("Araguaína")).toBeTruthy());
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps the complete download count when selected maps are hidden by a filter", async () => {
    const second = { ...region, id: "sao-paulo", label: "São Paulo", area: "São Paulo" };
    mock.catalog.mockResolvedValue([region, second]);
    mock.locations.mockResolvedValue([
      { regionId: region.id, stateCode: "TO", stateName: "Tocantins", kind: "city", cityName: "Araguaína" },
      { regionId: second.id, stateCode: "SP", stateName: "São Paulo", kind: "city", cityName: "São Paulo" },
    ]);
    mock.install.mockImplementation(async (item: { id: string }) => ({ kind: "installed", manifest: { id: item.id, label: item.id } }));
    render(<RegionDownloadCatalog />);
    await screen.findByRole("checkbox", { name: "Selecionar São Paulo" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Araguaína" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar São Paulo" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por estado" }), { target: { value: "TO" } });
    expect(screen.getByText(/2 mapa\(s\) selecionado\(s\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Baixar selecionados" }));
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(2));
  });

  it("shows queue progress and cancels without starting the next map or changing the active map", async () => {
    const second = { ...region, id: "palmas", label: "Palmas" };
    mock.catalog.mockResolvedValue([region, second]);
    mock.install.mockImplementation((_item, _installer, options: { signal: AbortSignal }) => new Promise(resolve => {
      options.signal.addEventListener("abort", () => resolve({ kind: "error", code: "offline" }), { once: true });
    }));
    render(<RegionDownloadCatalog />);
    await screen.findByRole("checkbox", { name: "Selecionar Palmas" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Araguaína" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Palmas" }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar selecionados" }));
    const cancel = await screen.findByRole("button", { name: "Cancelar fila" });
    expect(screen.getAllByText(/Baixando 1 de 2: Araguaína/).length).toBeGreaterThan(0);
    fireEvent.click(cancel);
    await screen.findByText(/Fila interrompida/);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelar fila" })).toBeNull());
    expect(mock.install).toHaveBeenCalledTimes(1);
    expect(mock.selected).not.toHaveBeenCalled();
    expect((screen.getByRole("checkbox", { name: "Selecionar Palmas" }) as HTMLInputElement).checked).toBe(true);
  });

  it("retains earlier successes and the actionable failure without selecting a partial queue", async () => {
    const second = { ...region, id: "palmas", label: "Palmas" };
    const third = { ...region, id: "tocantins", label: "Tocantins" };
    mock.catalog.mockResolvedValue([region, second, third]);
    const saved: { manifest: { id: string; label: string } }[] = [];
    mock.list.mockImplementation(async () => saved);
    mock.install.mockImplementation(async (item: { id: string }) => {
      if (item.id !== region.id) return { kind: "error", code: "checksum-mismatch" };
      const manifest = { id: item.id, label: "Araguaína instalada" };
      saved.push({ manifest });
      return { kind: "installed", manifest };
    });
    render(<RegionDownloadCatalog />);
    await screen.findByRole("checkbox", { name: "Selecionar Tocantins" });
    for (const name of ["Araguaína", "Palmas", "Tocantins"]) fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar " + name }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar selecionados" }));
    await screen.findByText("Falha simulada");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelar fila" })).toBeNull());
    expect(mock.install).toHaveBeenCalledTimes(2);
    expect(mock.selected).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox", { name: "Selecionar Araguaína" })).toBeNull();
    expect((screen.getByRole("checkbox", { name: "Selecionar Palmas" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Selecionar Tocantins" }) as HTMLInputElement).checked).toBe(true);
  });

  it("requires the explicit version confirmation rather than approving it through a generic batch retry", async () => {
    mock.install.mockResolvedValue({ kind: "confirm" });
    render(<RegionDownloadCatalog />);
    await screen.findByRole("checkbox", { name: "Selecionar Araguaína" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Araguaína" }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar selecionados" }));
    await screen.findByRole("button", { name: "Confirmar nova versão e baixar" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelar fila" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Baixar selecionados" }));
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(2));
    expect(mock.install.mock.calls[1][2].replaceCheckpoint).not.toBe(true);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Cancelar fila" })).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Confirmar nova versão e baixar" }));
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(3));
    expect(mock.install.mock.calls[2][2].replaceCheckpoint).toBe(true);
  });

});
