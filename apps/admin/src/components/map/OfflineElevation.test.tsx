import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OfflineElevation,
  describeOfflineElevationError,
  hasOfflineElevation,
  terrainGridAsDem,
} from "./OfflineElevation";
import type { TerrainGrid } from "../../lib/elevation/terrain-client";

const mocks = vi.hoisted(() => ({
  getTerrainPoint: vi.fn(),
  getCachedTerrainGrid: vi.fn(),
  downloadTerrainGrid: vi.fn(),
  getActiveRevision: vi.fn(),
  assetAtRevision: vi.fn(),
  validateRegionalDem: vi.fn(),
}));
vi.mock("../../lib/elevation/terrain-client", () => ({
  getTerrainPoint: mocks.getTerrainPoint,
  getCachedTerrainGrid: mocks.getCachedTerrainGrid,
  downloadTerrainGrid: mocks.downloadTerrainGrid,
}));
vi.mock("../../lib/storage/offline-map-store", () => ({
  offlineMapStore: {
    getActiveRevision: mocks.getActiveRevision,
    assetAtRevision: mocks.assetAtRevision,
  },
}));
vi.mock("@markmap/maps/elevation/regional-dem.mjs", () => ({
  MAX_REGIONAL_DEM_BYTES: 2 * 1024 * 1024,
  sampleRegionalDem: (grid: { values: number[] }) =>
    grid.values[0] === -32768 ? null : grid.values[0],
  computeRegionalElevationProfile: () => ({
    samples: [
      { distanceMeters: 0, elevationMeters: 100 },
      { distanceMeters: 10, elevationMeters: 120 },
    ],
    totalMeters: 10,
    gainMeters: 20,
    lossMeters: 0,
    minElevationMeters: 100,
    maxElevationMeters: 120,
    coveragePercent: 100,
    missingCount: 0,
  }),
  validateRegionalDem: mocks.validateRegionalDem,
}));

const bounds: [number, number, number, number] = [-48.3, -7.3, -48.1, -7.1];
const terrainGrid = (regionId = "viewport"): TerrainGrid => ({
  schemaVersion: 1,
  regionId,
  metadata: {
    bounds,
    width: 2,
    height: 2,
    noDataValue: -32768,
    resolutionMeters: 254,
    attribution: "AWS Terrain Tiles",
    license: "Open data",
    sourceUrl: "https://registry.opendata.aws/terrain-tiles/",
    verticalDatum: "Referência vertical varia conforme a fonte",
    source: "aws-terrain-tiles",
    sourceVersion: "v1",
    tileZoom: 8,
  },
  values: [254, 254, 254, 254],
});
const emptyRoute = null;
const props = {
  packageId: null,
  route: emptyRoute,
  open: true,
  onClose: vi.fn(),
  center: [-48.2, -7.2] as [number, number],
  viewportBounds: bounds,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.getActiveRevision.mockResolvedValue(null);
  mocks.assetAtRevision.mockResolvedValue(null);
  mocks.getCachedTerrainGrid.mockResolvedValue(null);
  mocks.getTerrainPoint.mockResolvedValue({
    elevationMeters: 254,
    resolutionMeters: 254,
  });
  mocks.validateRegionalDem.mockImplementation((value: unknown) => value);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function settlePoint() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("offline elevation capability", () => {
  it("reports no altitude capability without a DEM reference", () =>
    expect(hasOfflineElevation({ demGrid: undefined })).toBe(false));
  it("recognizes a DEM reference", () =>
    expect(hasOfflineElevation({ demGrid: {} as never })).toBe(true));
  it("adapts a cached terrain grid without inventing missing samples", () => {
    const dem = terrainGridAsDem({
      ...terrainGrid(),
      values: [254, -32768, 255, 256],
    });
    expect(dem.metadata.noDataValue).toBe(-32768);
    expect(dem.values[1]).toBe(-32768);
    expect(dem.metadata.resolutionMeters).toBe(254);
  });
  it("sanitizes unknown package errors", () =>
    expect(describeOfflineElevationError(new Error("internal path"))).toBe(
      "Dados altimétricos indisponíveis. Verifique o pacote offline em Configurações.",
    ));
});

describe("OfflineElevation UI", () => {
  it("does not query online while closed", async () => {
    render(<OfflineElevation {...props} open={false} />);
    await settlePoint();
    expect(mocks.getTerrainPoint).not.toHaveBeenCalled();
  });

  it("shows an online point with honest source metadata", async () => {
    render(<OfflineElevation {...props} />);
    await settlePoint();
    await waitFor(() =>
      expect(screen.getByText(/Ponto: 254 m/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/AWS Terrain Tiles/)).toBeInTheDocument();
    expect(screen.getByText(/Referência vertical varia/)).toBeInTheDocument();
  });

  it("clears old height when center changes and latest failure wins", async () => {
    let rejectFirst!: (error: Error) => void;
    mocks.getTerrainPoint
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce({ elevationMeters: 300, resolutionMeters: 250 });
    const view = render(<OfflineElevation {...props} />);
    await settlePoint();
    await waitFor(
      () => expect(mocks.getTerrainPoint).toHaveBeenCalledTimes(1),
      { timeout: 1500 },
    );
    view.rerender(<OfflineElevation {...props} center={[-48.21, -7.21]} />);
    expect(screen.queryByText(/Ponto:/)).not.toBeInTheDocument();
    await waitFor(
      () => expect(mocks.getTerrainPoint).toHaveBeenCalledTimes(2),
      { timeout: 1500 },
    );
    rejectFirst(new Error("stale failure"));
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByText(/Ponto: 300 m/)).toBeInTheDocument(),
    );
    expect(screen.queryByText("stale failure")).not.toBeInTheDocument();
  });

  it("reopens a viewport cache without a package id and avoids online fetch", async () => {
    mocks.getCachedTerrainGrid.mockResolvedValue(terrainGrid());
    render(<OfflineElevation {...props} />);
    await settlePoint();
    await waitFor(() =>
      expect(screen.getByText(/Ponto: 254 m/)).toBeInTheDocument(),
    );
    expect(mocks.getCachedTerrainGrid).toHaveBeenCalledWith("viewport", bounds);
    expect(mocks.getTerrainPoint).not.toHaveBeenCalled();
  });

  it("cancels a download without publishing a late grid", async () => {
    let resolveDownload!: (grid: TerrainGrid) => void;
    mocks.downloadTerrainGrid.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        }),
    );
    render(<OfflineElevation {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Baixar altitude deste mapa" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    resolveDownload(terrainGrid());
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      screen.queryByText("Altitude baixada e disponível sem internet."),
    ).not.toBeInTheDocument();
  });

  it("keeps the offline availability notice after the downloaded grid refreshes the point", async () => {
    mocks.downloadTerrainGrid.mockResolvedValue(terrainGrid());
    render(<OfflineElevation {...props} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Baixar altitude deste mapa" }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText("Altitude disponível offline nesta região.").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByText(/Ponto: 254 m/)).toBeInTheDocument();
  });

  it("uses manifest DEM before the online source", async () => {
    const assetJson = JSON.stringify({
      schemaVersion: 1,
      regionId: "araguaina",
      metadata: {
        bounds,
        source: "srtm",
        verticalDatum: "EGM96",
        attribution: "Manifest source",
        license: "Open data",
        sourceUrl: "https://example.test/dem",
        resolutionMeters: 30,
        noDataValue: -32768,
        dataType: "int16",
        width: 2,
        height: 2,
      },
      values: [700, 700, 700, 700],
    });
    const assetBytes = new TextEncoder().encode(assetJson);
    const asset = {
      size: assetBytes.byteLength,
      arrayBuffer: async () => assetBytes.buffer,
      text: async () => assetJson,
    } as unknown as Blob;
    mocks.assetAtRevision.mockResolvedValue(asset);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(assetJson),
    );
    const checksum = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const manifest = {
      id: "araguaina",
      bounds,
      demGrid: {
        path: "elevation/dem.json",
        blob: { bytes: asset.size, sha256: checksum },
      },
    };
    mocks.getActiveRevision.mockResolvedValue({ generation: "g1", manifest });
    mocks.validateRegionalDem.mockReturnValue({
      schemaVersion: 1,
      regionId: "araguaina",
      metadata: {
        bounds,
        source: "srtm",
        verticalDatum: "EGM96",
        attribution: "Manifest source",
        license: "Open data",
        sourceUrl: "https://example.test/dem",
        resolutionMeters: 30,
        noDataValue: -32768,
        dataType: "int16",
        width: 2,
        height: 2,
      },
      values: [700, 700, 700, 700],
    });
    render(<OfflineElevation {...props} packageId="araguaina" />);
    await settlePoint();
    await waitFor(() =>
      expect(screen.getByText(/Ponto: 700 m/)).toBeInTheDocument(),
    );
    expect(mocks.getTerrainPoint).not.toHaveBeenCalled();
    void digest;
  });
});
