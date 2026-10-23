import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImportsPage from "./ImportsPage";
import {
  exportDataset,
  exportDatasetGeoJSON,
  listDatasets,
  parseDatasetFile,
  saveDataset,
} from "../../lib/datasets/dataset-store";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@markmap/ui", () => ({
  useToast: () => ({ toast }),
}));
vi.mock("../../components/AppIcon", () => ({
  AppIcon: () => <span aria-hidden="true" />,
}));
vi.mock("../../components/elevation/TrackElevationProfile", () => ({
  TrackElevationProfile: () => null,
}));
vi.mock("../../lib/pdf/pdf-preview", () => ({
  PdfPreview: () => null,
  sha256Blob: vi.fn(),
}));
vi.mock("../../lib/mesh/mesh-store", () => ({
  listMeshes: vi.fn().mockResolvedValue([]),
  removeMesh: vi.fn(),
  saveMesh: vi.fn(),
}));
vi.mock("../../lib/local-repositories", () => ({
  localRepository: {
    listOriginals: vi.fn().mockResolvedValue([]),
    saveOriginal: vi.fn(),
  },
}));
vi.mock("../../lib/datasets/dataset-store", async () => ({
  ...(await vi.importActual<typeof import("../../lib/datasets/dataset-store")>(
    "../../lib/datasets/dataset-store",
  )),
  listDatasets: vi.fn().mockResolvedValue([]),
  parseDatasetFile: vi.fn(),
  saveDataset: vi.fn(),
  removeDataset: vi.fn(),
  exportDataset: vi.fn(),
  exportDatasetGeoJSON: vi.fn(),
}));

const validDataset = {
  id: "d1",
  name: "route.kml",
  format: "KML",
  sizeBytes: 12,
  featuresCount: 1,
  uploadedAt: new Date().toISOString(),
  crs: "EPSG:4326",
  originalBlob: new Blob(["kml"]),
  geojson: { type: "FeatureCollection", features: [] },
};

function file(name: string, contents = "<kml/>") {
  return new File([contents], name, { type: "application/octet-stream" });
}

describe("ImportsPage mobile file selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDatasets).mockResolvedValue([]);
  });

  it("leaves OS file filtering open and validates unsupported files through the parser", async () => {
    vi.mocked(parseDatasetFile).mockRejectedValueOnce(
      new Error("Formato não suportado."),
    );
    render(<ImportsPage />);
    const input = screen.getByLabelText(
      "Selecionar GeoJSON, GPX, KML, KMZ, PDF ou GLB",
    );
    expect(input).not.toHaveAttribute("accept");

    fireEvent.change(input, { target: { files: [file("route.exe", "MZ")] } });
    await screen.findByRole("alert");
    expect(parseDatasetFile).toHaveBeenCalledOnce();
    expect(saveDataset).not.toHaveBeenCalled();
  });

  it("passes a selected KML through validation and local save", async () => {
    vi.mocked(parseDatasetFile).mockResolvedValueOnce(validDataset as never);
    render(<ImportsPage />);
    const input = screen.getByLabelText(
      "Selecionar GeoJSON, GPX, KML, KMZ, PDF ou GLB",
    );
    fireEvent.change(input, { target: { files: [file("route.kml")] } });
    await waitFor(() => expect(saveDataset).toHaveBeenCalledWith(validDataset));
  });

  it.each([
    ["Exportar GeoJSON", exportDatasetGeoJSON],
    ["Exportar arquivo original", exportDataset],
  ] as const)(
    "reports a failed %s without an unhandled rejection",
    async (label, exporter) => {
      vi.mocked(listDatasets).mockResolvedValue([validDataset as never]);
      vi.mocked(exporter).mockRejectedValueOnce(
        new Error("Armazenamento indisponível."),
      );
      render(<ImportsPage />);
      fireEvent.click(await screen.findByRole("button", { name: label }));
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Exportação não concluída",
            description: "Armazenamento indisponível.",
            variant: "error",
          }),
        ),
      );
    },
  );
});
