import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  FieldExportModal,
  filterAndNormalizeFeatures,
} from "./FieldExportModal";
import type { DrawingSession } from "@markmap/maps";

// Mock do downloadBlob
vi.mock("../../lib/file-download", () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from "../../lib/file-download";

describe("FieldExportModal", () => {
  const mockFeatures: GeoJSON.Feature[] = [
    {
      type: "Feature",
      id: "pt-1",
      properties: { name: "Ponto Sede", type: "drawing" },
      geometry: { type: "Point", coordinates: [-48.2, -7.1] },
    },
    {
      type: "Feature",
      id: "line-1",
      properties: { name: "Cerca Norte", type: "drawing" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-48.2, -7.1],
          [-48.21, -7.11],
        ],
      },
    },
    {
      type: "Feature",
      id: "poly-1",
      properties: { name: "Talhão 01", type: "drawing" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-48.2, -7.1],
            [-48.2, -7.15],
            [-48.25, -7.15],
            [-48.25, -7.1],
            [-48.2, -7.1],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: "track-saved-1",
      properties: {
        name: "Trilha Trator 01",
        type: "gps_track",
        source: "markmap-gnss-logger",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [-48.2, -7.1],
          [-48.201, -7.101],
        ],
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada quando open é false", () => {
    const { container } = render(
      <FieldExportModal
        open={false}
        onClose={vi.fn()}
        projectFeatures={mockFeatures}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza modal acessível quando open é true", () => {
    render(
      <FieldExportModal
        open={true}
        onClose={vi.fn()}
        projectName="Fazenda Teste"
        projectFeatures={mockFeatures}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Exportar Desenhos e Trilhas")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fechar exportador" }),
    ).toBeInTheDocument();
  });

  it("chama onClose ao clicar no botão fechar ou cancelar", () => {
    const onClose = vi.fn();
    render(
      <FieldExportModal
        open={true}
        onClose={onClose}
        projectFeatures={mockFeatures}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar exportador" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("exibe contagem correta para o escopo 'all' (todas as feições)", () => {
    render(
      <FieldExportModal
        open={true}
        onClose={vi.fn()}
        projectFeatures={mockFeatures}
      />,
    );

    expect(screen.getByText("4 total")).toBeInTheDocument();
    expect(screen.getByText(/1 ponto/)).toBeInTheDocument();
    expect(screen.getByText(/2 linhas/)).toBeInTheDocument();
    expect(screen.getByText(/1 polígono/)).toBeInTheDocument();
  });

  it("filtra corretamente ao selecionar escopo 'drawings'", () => {
    render(
      <FieldExportModal
        open={true}
        onClose={vi.fn()}
        projectFeatures={mockFeatures}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Apenas Desenhos" }));

    // Deve excluir a trilha GPS e manter 3 feições de desenho
    expect(screen.getByText("3 total")).toBeInTheDocument();
    expect(screen.getByText(/1 ponto/)).toBeInTheDocument();
    expect(screen.getByText(/1 linha/)).toBeInTheDocument();
    expect(screen.getByText(/1 polígono/)).toBeInTheDocument();
  });

  it("filtra corretamente ao selecionar escopo 'tracks'", () => {
    render(
      <FieldExportModal
        open={true}
        onClose={vi.fn()}
        projectFeatures={mockFeatures}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Apenas Trilhas GNSS" }),
    );

    // Deve manter apenas a trilha salva
    expect(screen.getByText("1 total")).toBeInTheDocument();
    expect(screen.getByText(/0 pontos/)).toBeInTheDocument();
    expect(screen.getByText(/1 linha/)).toBeInTheDocument();
  });

  it("inclui desenho ativo e trilha ativa em andamento", () => {
    const mockActiveDrawing: DrawingSession = {
      type: "Polygon",
      vertices: [
        [-48.2, -7.1],
        [-48.2, -7.2],
        [-48.3, -7.2],
        [-48.2, -7.1],
      ],
      undoStack: [],
      redoStack: [],
      isFinished: false,
    };

    const mockActiveTrack: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-48.2, -7.1],
          [-48.201, -7.101],
          [-48.202, -7.102],
        ],
      },
      properties: { name: "Trilha em Tempo Real" },
    };

    render(
      <FieldExportModal
        open={true}
        onClose={vi.fn()}
        projectFeatures={[]}
        activeDrawingSession={mockActiveDrawing}
        activeTrackGeoJson={mockActiveTrack}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ativo no Momento" }));

    // 1 polígono ativo + 1 linha de trilha ativa
    expect(screen.getByText("2 total")).toBeInTheDocument();
    expect(screen.getByText(/1 linha/)).toBeInTheDocument();
    expect(screen.getByText(/1 polígono/)).toBeInTheDocument();
  });

  it("desabilita botão de exportar e exibe aviso quando não há feições", () => {
    render(
      <FieldExportModal
        open={true}
        onClose={vi.fn()}
        projectFeatures={[]}
      />,
    );

    expect(screen.getByText("0 total")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma feição encontrada no escopo selecionado."),
    ).toBeInTheDocument();

    const exportBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
    expect(exportBtn).toBeDisabled();
  });

  it("alterna formato entre KML e GPX e atualiza indicador de extensão", () => {
    render(
      <FieldExportModal
        open={true}
        onClose={vi.fn()}
        projectFeatures={mockFeatures}
      />,
    );

    expect(screen.getByText(".kml")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /GPX 1\.1/ }),
    );

    expect(screen.getByText(".gpx")).toBeInTheDocument();
  });

  it("dispara downloadBlob com formato KML e fecha modal", () => {
    const onClose = vi.fn();
    render(
      <FieldExportModal
        open={true}
        onClose={onClose}
        projectName="Fazenda Esperança"
        projectFeatures={mockFeatures}
      />,
    );

    const exportBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
    fireEvent.click(exportBtn);

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blobArg, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toContain("application/vnd.google-earth.kml+xml");
    expect(filenameArg).toMatch(/^fazenda_esperan_a_.*\.kml$/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dispara downloadBlob com formato GPX quando selecionado", () => {
    const onClose = vi.fn();
    render(
      <FieldExportModal
        open={true}
        onClose={onClose}
        projectName="Projeto Campo"
        projectFeatures={mockFeatures}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /GPX 1\.1/ }));
    const exportBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
    fireEvent.click(exportBtn);

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blobArg, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toContain("application/gpx+xml");
    expect(filenameArg).toMatch(/^projeto_campo_.*\.gpx$/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("filterAndNormalizeFeatures helper", () => {
  it("descarta com segurança desenhos incompletos que lançam erro ao finalizar", () => {
    const incompleteDrawing: DrawingSession = {
      type: "LineString",
      vertices: [[-48.2, -7.1]], // apenas 1 vértice, precisa de 2
      undoStack: [],
      redoStack: [],
      isFinished: false,
    };

    const res = filterAndNormalizeFeatures("active", [], incompleteDrawing, null);
    expect(res.features).toHaveLength(0);
    expect(res.counts.total).toBe(0);
  });

  it("gera nomes padrão e preserva timestamp e descrição", () => {
    const anonymousFeatures: GeoJSON.Feature[] = [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-48.2, -7.1] },
        properties: { distanceKm: 5.2, durationSeconds: 600 },
      },
    ];

    const res = filterAndNormalizeFeatures("all", anonymousFeatures, null, null);
    expect(res.features[0]!.properties?.name).toBe("Ponto 1");
    expect(res.features[0]!.properties?.description).toContain("Distância: 5.2 km");
    expect(res.features[0]!.properties?.time).toBeDefined();
  });
});
