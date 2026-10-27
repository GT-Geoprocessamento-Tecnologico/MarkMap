import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  FieldExportModal,
  filterAndNormalizeFeatures,
  type ExportScope,
} from "./FieldExportModal";
import type { DrawingSession } from "@markmap/maps";

// Mock do downloadBlob para inspecionar parâmetros exatos
vi.mock("../../lib/file-download", () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from "../../lib/file-download";

describe("FieldExportModal — Adversarial Empirical Stress Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // VETOR 1: Lista de Feições Vazia e Robustez de UI
  // =========================================================================
  describe("Vetor 1: Condição Vazia Absoluta", () => {
    it("não quebra e desabilita exportação quando projectFeatures=[], sem desenho e sem trilha", () => {
      const onClose = vi.fn();
      render(
        <FieldExportModal
          open={true}
          onClose={onClose}
          projectName="Fazenda Vazia"
          projectFeatures={[]}
          activeDrawingSession={null}
          activeTrackGeoJson={null}
        />,
      );

      // Resumo dinâmico exibe zero
      expect(screen.getByText("0 total")).toBeInTheDocument();
      expect(screen.getByText(/0 pontos/)).toBeInTheDocument();
      expect(screen.getByText(/0 linhas/)).toBeInTheDocument();
      expect(screen.getByText(/0 polígonos/)).toBeInTheDocument();

      // Mensagem de aviso presente
      expect(
        screen.getByText("Nenhuma feição encontrada no escopo selecionado."),
      ).toBeInTheDocument();

      // Botão desabilitado
      const submitBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
      expect(submitBtn).toBeDisabled();

      // Tentativa de submissão forçada via form
      const dialog = screen.getByRole("dialog");
      const form = dialog.querySelector("form");
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      // downloadBlob NÃO deve ser chamado e modal NÃO deve fechar
      expect(downloadBlob).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("lida com projectFeatures contendo elementos nulos ou indefinidos sem crash", () => {
      const corruptFeatures = [
        null as unknown as GeoJSON.Feature,
        undefined as unknown as GeoJSON.Feature,
        { type: "Feature", properties: {}, geometry: null } as unknown as GeoJSON.Feature,
      ];

      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectFeatures={corruptFeatures}
        />,
      );

      expect(screen.getByText("0 total")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Exportar Arquivo" })).toBeDisabled();
    });
  });

  // =========================================================================
  // VETOR 2: Sessão de Desenho e Trilha Ativa Incompletas
  // =========================================================================
  describe("Vetor 2: Sessões Ativas Incompletas (try/catch discard)", () => {
    it("descarta com segurança LineString com apenas 1 vértice", () => {
      const incompleteLine: DrawingSession = {
        type: "LineString",
        vertices: [[-48.2, -7.1]], // insuficiente: precisa >= 2
        undoStack: [],
        redoStack: [],
        isFinished: false,
      };

      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectFeatures={[]}
          activeDrawingSession={incompleteLine}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Ativo no Momento" }));
      expect(screen.getByText("0 total")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Exportar Arquivo" })).toBeDisabled();
    });

    it("descarta com segurança Polygon com apenas 1 vértice", () => {
      const incompletePolygon1: DrawingSession = {
        type: "Polygon",
        vertices: [[-48.2, -7.1]], // insuficiente: precisa >= 3
        undoStack: [],
        redoStack: [],
        isFinished: false,
      };

      const res = filterAndNormalizeFeatures("active", [], incompletePolygon1, null);
      expect(res.features).toHaveLength(0);
      expect(res.counts.total).toBe(0);
    });

    it("descarta com segurança Polygon com apenas 2 vértices", () => {
      const incompletePolygon2: DrawingSession = {
        type: "Polygon",
        vertices: [
          [-48.2, -7.1],
          [-48.25, -7.15],
        ], // insuficiente: precisa >= 3
        undoStack: [],
        redoStack: [],
        isFinished: false,
      };

      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectFeatures={[]}
          activeDrawingSession={incompletePolygon2}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Ativo no Momento" }));
      expect(screen.getByText("0 total")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Exportar Arquivo" })).toBeDisabled();
    });

    it("descarta trilha ativa com menos de 2 coordenadas (linha degenerada)", () => {
      const degenerateTrack: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[-48.2, -7.1]], // apenas 1 coordenada
        },
        properties: { name: "Trilha Incompleta" },
      };

      const res = filterAndNormalizeFeatures("active", [], null, degenerateTrack);
      expect(res.features).toHaveLength(0);
      expect(res.counts.total).toBe(0);
    });
  });

  // =========================================================================
  // VETOR 3: Alternância Rápida entre os 4 Escopos
  // =========================================================================
  describe("Vetor 3: Estresse de Alternância Rápida de Escopos", () => {
    const complexDataset: GeoJSON.Feature[] = [
      {
        type: "Feature",
        id: "draw-pt-1",
        properties: { name: "Sede", type: "drawing" },
        geometry: { type: "Point", coordinates: [-48.2, -7.1] },
      },
      {
        type: "Feature",
        id: "draw-poly-1",
        properties: { name: "Talhão Sul", type: "drawing" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-48.2, -7.1],
              [-48.2, -7.2],
              [-48.3, -7.2],
              [-48.2, -7.1],
            ],
          ],
        },
      },
      {
        type: "Feature",
        id: "track-gnss-1",
        properties: { name: "Trilha Trator 1", type: "gps_track" },
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
        id: "track-gnss-2",
        properties: { name: "Trilha Pulverizador", source: "markmap-gnss-logger" },
        geometry: {
          type: "LineString",
          coordinates: [
            [-48.22, -7.12],
            [-48.23, -7.13],
          ],
        },
      },
    ];

    const validActiveDrawing: DrawingSession = {
      type: "LineString",
      vertices: [
        [-48.25, -7.15],
        [-48.26, -7.16],
      ],
      undoStack: [],
      redoStack: [],
      isFinished: false,
    };

    const validActiveTrack: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-48.27, -7.17],
          [-48.28, -7.18],
        ],
      },
      properties: { name: "Trilha Ao Vivo" },
    };

    it("mantém contagens e consistência estrita em 50 alternâncias consecutivas", () => {
      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectFeatures={complexDataset}
          activeDrawingSession={validActiveDrawing}
          activeTrackGeoJson={validActiveTrack}
        />,
      );

      const btnAll = screen.getByRole("button", { name: "Todas as Feições" });
      const btnDrawings = screen.getByRole("button", { name: "Apenas Desenhos" });
      const btnTracks = screen.getByRole("button", { name: "Apenas Trilhas GNSS" });
      const btnActive = screen.getByRole("button", { name: "Ativo no Momento" });

      const scopesSequence: ExportScope[] = [
        "all", "drawings", "tracks", "active",
        "drawings", "all", "active", "tracks",
        "all", "tracks", "drawings", "active",
      ];

      for (let cycle = 0; cycle < 4; cycle++) {
        for (const s of scopesSequence) {
          act(() => {
            if (s === "all") fireEvent.click(btnAll);
            if (s === "drawings") fireEvent.click(btnDrawings);
            if (s === "tracks") fireEvent.click(btnTracks);
            if (s === "active") fireEvent.click(btnActive);
          });

          // Validações determinísticas
          if (s === "all") {
            // 2 desenhos salvos + 2 trilhas salvas + 1 desenho ativo + 1 trilha ativa = 6
            expect(screen.getByText("6 total")).toBeInTheDocument();
            expect(screen.getByText(/1 ponto/)).toBeInTheDocument();
            expect(screen.getByText(/4 linhas/)).toBeInTheDocument();
            expect(screen.getByText(/1 polígono/)).toBeInTheDocument();
          } else if (s === "drawings") {
            // 2 desenhos salvos + 1 desenho ativo = 3 (1 ponto, 1 linha, 1 polígono)
            expect(screen.getByText("3 total")).toBeInTheDocument();
            expect(screen.getByText(/1 ponto/)).toBeInTheDocument();
            expect(screen.getByText(/1 linha/)).toBeInTheDocument();
            expect(screen.getByText(/1 polígono/)).toBeInTheDocument();
          } else if (s === "tracks") {
            // 2 trilhas salvas + 1 trilha ativa = 3 linhas
            expect(screen.getByText("3 total")).toBeInTheDocument();
            expect(screen.getByText(/0 pontos/)).toBeInTheDocument();
            expect(screen.getByText(/3 linhas/)).toBeInTheDocument();
            expect(screen.getByText(/0 polígonos/)).toBeInTheDocument();
          } else if (s === "active") {
            // 1 desenho ativo (linha) + 1 trilha ativa (linha) = 2 linhas
            expect(screen.getByText("2 total")).toBeInTheDocument();
            expect(screen.getByText(/0 pontos/)).toBeInTheDocument();
            expect(screen.getByText(/2 linhas/)).toBeInTheDocument();
            expect(screen.getByText(/0 polígonos/)).toBeInTheDocument();
          }
        }
      }
    });
  });

  // =========================================================================
  // VETOR 4: Nomes de Arquivo Customizados e Espaços Excessivos
  // =========================================================================
  describe("Vetor 4: Nomes de Arquivo Customizados, Espaços e Caracteres", () => {
    const singleFeature: GeoJSON.Feature[] = [
      {
        type: "Feature",
        id: "pt-1",
        properties: { name: "Ponto A" },
        geometry: { type: "Point", coordinates: [-48.2, -7.1] },
      },
    ];

    it("remove espaços nas extremidades (trim) antes de salvar", () => {
      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectFeatures={singleFeature}
        />,
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "   meu_mapa_campo   " } });

      const exportBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
      fireEvent.click(exportBtn);

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;
      expect(filenameArg).toBe("meu_mapa_campo.kml");
    });

    it("recorre ao nome padrão se o usuário apagar tudo ou digitar apenas espaços", () => {
      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectName="Fazenda Santa Rita"
          projectFeatures={singleFeature}
        />,
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "     " } });

      const exportBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
      fireEvent.click(exportBtn);

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;
      // Deve usar o fallback seguro derivado do projectName
      expect(filenameArg).toMatch(/^fazenda_santa_rita_.*\.kml$/);
    });

    it("avalia o comportamento empírico quando o usuário insere caracteres especiais de filesystem", () => {
      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectFeatures={singleFeature}
        />,
      );

      const input = screen.getByRole("textbox");
      // Caracteres proibidos em Windows/Linux: / \ : * ? " < > |
      const unsafeName = 'talhao/01\\setor:norte*teste?versao"1<2>3|ok';
      fireEvent.change(input, { target: { value: unsafeName } });

      const exportBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
      fireEvent.click(exportBtn);

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;
      // Registramos o comportamento atual do componente
      expect(filenameArg).toBe(`${unsafeName}.kml`);
    });

    it("avalia se o usuário digitar a extensão manualmente no input (ex: arquivo.kml)", () => {
      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectFeatures={singleFeature}
        />,
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "talhao_01.kml" } });

      const exportBtn = screen.getByRole("button", { name: "Exportar Arquivo" });
      fireEvent.click(exportBtn);

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;
      // Registramos se gera extensão duplicada .kml.kml
      expect(filenameArg).toBe("talhao_01.kml.kml");
    });
  });

  // =========================================================================
  // VETOR 5: Download via Blob, MIME Type e Extensões
  // =========================================================================
  describe("Vetor 5: Rigor de MIME Type e Formato de Blob", () => {
    const singleFeature: GeoJSON.Feature[] = [
      {
        type: "Feature",
        id: "pt-1",
        properties: { name: "Sede" },
        geometry: { type: "Point", coordinates: [-48.2, -7.1] },
      },
    ];

    it("gera Blob KML com MIME type oficial application/vnd.google-earth.kml+xml e extensão .kml", async () => {
      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectName="Gleba 1"
          projectFeatures={singleFeature}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Exportar Arquivo" }));

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [blobArg, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;

      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe("application/vnd.google-earth.kml+xml;charset=utf-8");
      expect(filenameArg.endsWith(".kml")).toBe(true);

      const readBlobText = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsText(blob);
        });

      const text = await readBlobText(blobArg);
      expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(text).toContain('<kml xmlns="http://www.opengis.net/kml/2.2"');
      expect(text).toContain("<Placemark>");
      expect(text).toContain("<name>Sede</name>");
    });

    it("gera Blob GPX com MIME type oficial application/gpx+xml e extensão .gpx", async () => {
      render(
        <FieldExportModal
          open={true}
          onClose={vi.fn()}
          projectName="Gleba 1"
          projectFeatures={singleFeature}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /GPX 1\.1/ }));
      fireEvent.click(screen.getByRole("button", { name: "Exportar Arquivo" }));

      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [blobArg, filenameArg] = vi.mocked(downloadBlob).mock.calls[0]!;

      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe("application/gpx+xml;charset=utf-8");
      expect(filenameArg.endsWith(".gpx")).toBe(true);

      const readBlobText = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsText(blob);
        });

      const text = await readBlobText(blobArg);
      expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(text).toContain('<gpx version="1.1"');
      expect(text).toContain('<wpt lat="-7.1" lon="-48.2">');
      expect(text).toContain("<name>Sede</name>");
    });
  });

  // =========================================================================
  // VETOR 6: Carga Extrema e Integridade de Dados
  // =========================================================================
  describe("Vetor 6: Estresse de Carga (5.000 Feições)", () => {
    it("processa e conta 5.000 feições sem latência perceptível e sem estouro de pilha", () => {
      const massiveFeatures: GeoJSON.Feature[] = Array.from(
        { length: 5000 },
        (_, i) => ({
          type: "Feature" as const,
          id: `point-${i}`,
          geometry: {
            type: "Point" as const,
            coordinates: [-48.2 + (i % 100) * 0.001, -7.1 + Math.floor(i / 100) * 0.001],
          },
          properties: {
            name: `Piquete ${i}`,
            type: i % 2 === 0 ? "drawing" : "gps_track",
          },
        }),
      );

      const startTime = performance.now();
      const res = filterAndNormalizeFeatures("all", massiveFeatures, null, null);
      const elapsedMs = performance.now() - startTime;

      expect(res.counts.total).toBe(5000);
      expect(res.counts.points).toBe(5000);
      expect(elapsedMs).toBeLessThan(150); // Deve ser sub-150ms para 5.000 feições
    });
  });
});
