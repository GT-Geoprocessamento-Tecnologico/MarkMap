import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackRecordingOverlay } from "./TrackRecordingOverlay";
import type { TrackStats } from "@markmap/maps";

const mockIdleStats: TrackStats = {
  status: "idle",
  pointsCount: 0,
  distanceMeters: 0,
  distanceKm: 0,
  durationSeconds: 0,
  avgSpeedMs: 0,
  avgSpeedKmh: 0,
  elevationGainMeters: 0,
  elevationLossMeters: 0,
  minElevationMeters: null,
  maxElevationMeters: null,
};

const mockActiveStats: TrackStats = {
  status: "recording",
  pointsCount: 42,
  distanceMeters: 1420,
  distanceKm: 1.42,
  durationSeconds: 125,
  avgSpeedMs: 11.36,
  avgSpeedKmh: 40.9,
  elevationGainMeters: 35,
  elevationLossMeters: 5,
  minElevationMeters: 740,
  maxElevationMeters: 775,
};

describe("TrackRecordingOverlay", () => {
  it("não renderiza nada quando open é false", () => {
    const { container } = render(
      <TrackRecordingOverlay
        open={false}
        status="idle"
        stats={mockIdleStats}
        currentAccuracyMeters={null}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza estado idle com botão 'Iniciar Trilha' e indicador 'Pronto'", () => {
    const onStart = vi.fn();
    render(
      <TrackRecordingOverlay
        open={true}
        status="idle"
        stats={mockIdleStats}
        currentAccuracyMeters={8}
        onStart={onStart}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("status-idle-badge")).toBeDefined();
    const startBtn = screen.getByRole("button", { name: "Iniciar Trilha" });
    expect(startBtn).toBeDefined();
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("exibe badge pulsante REC e telemetria formatada em gravação ativa", () => {
    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={mockActiveStats}
        currentAccuracyMeters={4}
        currentSpeedKmh={42.5}
        currentElevationMeters={760}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("status-recording-badge").textContent).toContain("REC Ativo");
    expect(screen.getByTestId("telemetry-distance").textContent).toBe("1.42 km");
    expect(screen.getByTestId("telemetry-duration").textContent).toBe("02:05");
    expect(screen.getByTestId("telemetry-speed").textContent).toContain("42.5 km/h");
    expect(screen.getByTestId("telemetry-elevation-gain").textContent).toBe("+35 m");
  });

  it("formata distâncias menores que 1000m em metros dinamicamente", () => {
    const subKmStats: TrackStats = { ...mockActiveStats, distanceMeters: 450, distanceKm: 0.45 };
    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={subKmStats}
        currentAccuracyMeters={5}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("telemetry-distance").textContent).toBe("450 m");
  });

  it("exibe aviso visual e status de descarte quando acurácia GPS > 15m", () => {
    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={mockActiveStats}
        currentAccuracyMeters={22}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const gpsIndicator = screen.getByTestId("gps-quality-indicator");
    expect(gpsIndicator.textContent).toContain("Ruído descartado (>15m)");
    expect(gpsIndicator.textContent).toContain("FILTRANDO");
  });

  it("permite pausar e retomar a gravação através dos botões", () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const { rerender } = render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={mockActiveStats}
        currentAccuracyMeters={3}
        onStart={vi.fn()}
        onPause={onPause}
        onResume={onResume}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const pauseBtn = screen.getByRole("button", { name: "Pausar" });
    fireEvent.click(pauseBtn);
    expect(onPause).toHaveBeenCalledTimes(1);

    // Rerenderiza em estado pausado
    rerender(
      <TrackRecordingOverlay
        open={true}
        status="paused"
        stats={{ ...mockActiveStats, status: "paused" }}
        currentAccuracyMeters={3}
        onStart={vi.fn()}
        onPause={onPause}
        onResume={onResume}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("status-paused-badge")).toBeDefined();
    const resumeBtn = screen.getByRole("button", { name: "Retomar" });
    fireEvent.click(resumeBtn);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("abre modal ao clicar em Salvar e submete com nome da trilha", async () => {
    const onSave = vi.fn();
    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={mockActiveStats}
        currentAccuracyMeters={4}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={onSave}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(saveBtn);

    // Modal dialog aberto
    expect(screen.getByRole("dialog", { name: "Salvar Trilha no Mapa" })).toBeDefined();
    const input = screen.getByLabelText("Nome da Trilha") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Trilha Piquete 4" } });

    const confirmBtn = screen.getByRole("button", { name: "Confirmar e Salvar" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Trilha Piquete 4");
    });
  });

  it("abre diálogo de confirmação ao clicar em Descartar e cancela/confirma", async () => {
    const onDiscard = vi.fn();
    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={mockActiveStats}
        currentAccuracyMeters={4}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={onDiscard}
        onClose={vi.fn()}
      />
    );

    const discardBtn = screen.getByRole("button", { name: "Descartar trilha" });
    fireEvent.click(discardBtn);

    expect(screen.getByRole("dialog", { name: "Descartar Trilha?" })).toBeDefined();

    // Clicar em continuar gravando fecha o diálogo sem chamar onDiscard
    const continueBtn = screen.getByRole("button", { name: "Continuar Gravando" });
    fireEvent.click(continueBtn);
    expect(onDiscard).not.toHaveBeenCalled();

    // Clicar em descartar definitivamente
    fireEvent.click(discardBtn);
    const confirmDiscardBtn = screen.getByRole("button", { name: "Descartar Definitivamente" });
    fireEvent.click(confirmDiscardBtn);

    await waitFor(() => {
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });
  });

  it("alterna entre modo expandido e minimizado", () => {
    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={mockActiveStats}
        currentAccuracyMeters={4}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const minimizeBtn = screen.getByRole("button", { name: "Minimizar gravador de trilha" });
    fireEvent.click(minimizeBtn);

    // Modo minimizado
    expect(screen.getByRole("region", { name: "Gravador de trilha minimizado" })).toBeDefined();

    const expandBtn = screen.getByRole("button", { name: "Maximizar painel do gravador de trilha" });
    fireEvent.click(expandBtn);

    // Retorna ao modo expandido
    expect(screen.getByRole("region", { name: "Gravador de trilha GNSS" })).toBeDefined();
  });
});
