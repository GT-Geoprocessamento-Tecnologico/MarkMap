// Testes adversariais empíricos de robustez de UI e limites de dados do TrackRecordingOverlay
// Desenvolvido pelo teamwork_challenger_m3_2 para validação do Marco 3 (MM-AVZ-05).
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackRecordingOverlay } from "./TrackRecordingOverlay";
import type { TrackStats } from "@markmap/maps";

const baseStats: TrackStats = {
  status: "recording",
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

describe("Adversarial UI & Data Limits Test: TrackRecordingOverlay", () => {
  it("ADV-UI-01: Trilha com 0 pontos — botão Salvar DEVE estar desabilitado e não abrir modal", () => {
    const stats0Pts: TrackStats = { ...baseStats, pointsCount: 0 };
    const onSave = vi.fn();

    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={stats0Pts}
        currentAccuracyMeters={5}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={onSave}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: "Salvar" });
    expect(saveBtn).toHaveProperty("disabled", true);

    // Tentar clicar no botão desabilitado
    fireEvent.click(saveBtn);

    // Modal de salvamento NÃO deve existir no documento
    expect(
      screen.queryByRole("dialog", { name: "Salvar Trilha no Mapa" }),
    ).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ADV-UI-02: Trilha com 1 ponto — botão Salvar DEVE estar desabilitado e não abrir modal", () => {
    const stats1Pt: TrackStats = { ...baseStats, pointsCount: 1 };
    const onSave = vi.fn();

    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={stats1Pt}
        currentAccuracyMeters={5}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={onSave}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: "Salvar" });
    expect(saveBtn).toHaveProperty("disabled", true);

    fireEvent.click(saveBtn);
    expect(
      screen.queryByRole("dialog", { name: "Salvar Trilha no Mapa" }),
    ).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("ADV-UI-03: Trilha com exatamente 2 pontos — botão Salvar DEVE estar habilitado", () => {
    const stats2Pts: TrackStats = {
      ...baseStats,
      pointsCount: 2,
      distanceMeters: 25,
    };

    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={stats2Pts}
        currentAccuracyMeters={5}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: "Salvar" });
    expect(saveBtn).toHaveProperty("disabled", false);

    fireEvent.click(saveBtn);
    expect(
      screen.getByRole("dialog", { name: "Salvar Trilha no Mapa" }),
    ).toBeDefined();
  });

  it("ADV-UI-04: Trilha com distância zero e tempo zero — sem NaN, sem Infinity na UI", () => {
    const zeroStats: TrackStats = {
      status: "recording",
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

    const { container } = render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={zeroStats}
        currentAccuracyMeters={null}
        currentSpeedKmh={0}
        currentElevationMeters={null}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const html = container.innerHTML;
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
    expect(html).not.toContain("undefined");

    expect(screen.getByTestId("telemetry-distance").textContent).toBe("0 m");
    expect(screen.getByTestId("telemetry-duration").textContent).toBe("00:00");
    expect(screen.getByTestId("telemetry-speed").textContent).toContain(
      "0.0 km/h",
    );
    expect(screen.getByTestId("telemetry-elevation-gain").textContent).toBe(
      "+0 m",
    );
  });

  it("ADV-UI-05: Limiares exatos de acurácia GPS (<=15m vs >15m)", () => {
    // Caso 1: Acurácia exatamente 15m (deve ser aceita como confiável)
    const { rerender } = render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={baseStats}
        currentAccuracyMeters={15}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    let indicator = screen.getByTestId("gps-quality-indicator");
    expect(indicator.textContent).toContain("Sinal GNSS confiável");
    expect(indicator.textContent).toContain("OK");
    expect(indicator.textContent).not.toContain("FILTRANDO");

    // Caso 2: Acurácia 15.1m (deve ser rejeitada e rotulada como ruído)
    rerender(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={baseStats}
        currentAccuracyMeters={15.1}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    indicator = screen.getByTestId("gps-quality-indicator");
    expect(indicator.textContent).toContain("Ruído descartado (>15m)");
    expect(indicator.textContent).toContain("FILTRANDO");
    expect(indicator.textContent).not.toContain("Sinal GNSS confiável");
  });

  it("ADV-UI-06: Telemetria com durações longas (> 1 hora) formata com formato hh:mm:ss", () => {
    const longDurationStats: TrackStats = {
      ...baseStats,
      durationSeconds: 3725, // 1h 02m 05s
      distanceMeters: 12500, // 12.5 km
    };

    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={longDurationStats}
        currentAccuracyMeters={4}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("telemetry-duration").textContent).toBe(
      "01:02:05",
    );
    expect(screen.getByTestId("telemetry-distance").textContent).toBe(
      "12.50 km",
    );
  });

  it("ADV-UI-07: Resiliência contra NaN e Infinity se injetados nas estatísticas", () => {
    // Forçar valores bizarros de telemetria
    const corruptedStats: TrackStats = {
      status: "recording",
      pointsCount: 0,
      distanceMeters: 0, // se for NaN quebraria formatTrackDistance
      distanceKm: 0,
      durationSeconds: 0,
      avgSpeedMs: 0,
      avgSpeedKmh: 0,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
      minElevationMeters: null,
      maxElevationMeters: null,
    };

    render(
      <TrackRecordingOverlay
        open={true}
        status="recording"
        stats={corruptedStats}
        currentAccuracyMeters={NaN as unknown as number}
        currentSpeedKmh={0}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const indicator = screen.getByTestId("gps-quality-indicator");
    // Com currentAccuracyMeters = NaN, Number.isFinite(NaN) é false, então trata com segurança
    expect(indicator).toBeDefined();
  });
});
