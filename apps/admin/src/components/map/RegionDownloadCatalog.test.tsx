import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RegionDownloadCatalog } from "./RegionDownloadCatalog";

const mock = vi.hoisted(() => ({
  catalog: vi.fn(), list: vi.fn(), permission: vi.fn(), position: vi.fn(),
  auto: vi.fn(), persist: vi.fn(), install: vi.fn(), ensure: vi.fn(),
}));

vi.mock("../../lib/storage/offline-map-store", () => ({
  offlineMapStore: { list: mock.list },
}));
vi.mock("../../lib/storage/offline-map-selection", () => ({
  getSelectedOfflineMapId: () => null,
  setSelectedOfflineMapId: vi.fn(),
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

  it("saves new consent before starting the automatic download", async () => {
    render(<RegionDownloadCatalog />);
    await screen.findByText(/Mapa sugerido pelo GPS: Araguaína/);
    fireEvent.click(screen.getByRole("checkbox", {
      name: "Baixar automaticamente o mapa da minha região",
    }));
    await waitFor(() => expect(mock.persist).toHaveBeenCalledWith(true));
    await waitFor(() => expect(mock.install).toHaveBeenCalledTimes(1));
  });
});
