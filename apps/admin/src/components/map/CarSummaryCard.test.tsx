import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarSummaryCard, CAR_ALQUEIRE_STORAGE_KEY } from "./CarSummaryCard";
import type { CarPropertySummary } from "@markmap/maps";

const mockSummary: CarPropertySummary = {
  isCarDataset: true,
  carCode: "GO-5201108-8B7C9D01234",
  municipality: "Anápolis",
  state: "GO",
  status: "ATIVO",
  areaImovelHa: 100,
  areaImovelSqMeters: 1000000,
  areaReservaLegalHa: 20,
  areaReservaLegalSqMeters: 200000,
  reservaLegalPercent: 20,
  layers: [
    {
      layerType: "AREA_IMOVEL",
      label: "Área do Imóvel",
      count: 1,
      areaHa: 100,
      areaSqMeters: 1000000,
      style: { fillColor: "#FF9800", fillOpacity: 0.15, strokeColor: "#E65100", strokeWidth: 2 },
    },
    {
      layerType: "RESERVA_LEGAL",
      label: "Reserva Legal",
      count: 1,
      areaHa: 20,
      areaSqMeters: 200000,
      style: { fillColor: "#2E7D32", fillOpacity: 0.4, strokeColor: "#1B5E20", strokeWidth: 1.5 },
    },
    {
      layerType: "APP",
      label: "Área de Preservação Permanente (APP)",
      count: 2,
      areaHa: 10,
      areaSqMeters: 100000,
      style: { fillColor: "#00BCD4", fillOpacity: 0.4, strokeColor: "#006064", strokeWidth: 1.5 },
    },
    {
      layerType: "AREA_CONSOLIDADA",
      label: "Área Consolidada",
      count: 1,
      areaHa: 70,
      areaSqMeters: 700000,
      style: { fillColor: "#FFEB3B", fillOpacity: 0.3, strokeColor: "#F57F17", strokeWidth: 1.2 },
    },
  ],
};

describe("CarSummaryCard", () => {
  it("returns null when isCarDataset is false", () => {
    const { container } = render(
      <CarSummaryCard summary={{ ...mockSummary, isCarDataset: false }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders header with CAR code, status badge and locality", () => {
    render(<CarSummaryCard summary={mockSummary} />);

    expect(screen.getByTestId("car-code").textContent).toBe("GO-5201108-8B7C9D01234");
    expect(screen.getByTestId("car-status-badge").textContent).toBe("ATIVO");
    expect(screen.getByText("Anápolis - GO")).toBeDefined();
  });

  it("renders property area in hectares and updates when switching alqueire unit", () => {
    render(<CarSummaryCard summary={mockSummary} />);

    // 1.000.000 m² = 100 ha
    expect(screen.getByTestId("car-area-ha").textContent).toContain("100,00 ha");
    // Paulista: 1.000.000 / 24.200 ≈ 41,32 alq. paulista
    expect(screen.getByTestId("car-area-alqueires").textContent).toContain("41,32 alq. paulista");

    // Trocar para Mineiro / Goiano (4,84 ha): 1.000.000 / 48.400 ≈ 20,66 alq. mineiro
    const select = screen.getByLabelText("Selecionar padrão regional de alqueire");
    fireEvent.change(select, { target: { value: "alqueire_mineiro" } });
    expect(screen.getByTestId("car-area-alqueires").textContent).toContain("20,66 alq. mineiro");

    // Trocar para Baiano (9,68 ha): 1.000.000 / 96.800 ≈ 10,33 alq. baiano
    fireEvent.change(select, { target: { value: "alqueire_baiano" } });
    expect(screen.getByTestId("car-area-alqueires").textContent).toContain("10,33 alq. baiano");

    // Trocar para Do Norte (2,72 ha): 1.000.000 / 27.200 ≈ 36,76 alq. norte
    fireEvent.change(select, { target: { value: "alqueire_norte" } });
    expect(screen.getByTestId("car-area-alqueires").textContent).toContain("36,76 alq. norte");
  });

  it("renders Reserva Legal metrics and progress bar", () => {
    render(<CarSummaryCard summary={mockSummary} />);

    expect(screen.getByTestId("car-rl-percent").textContent).toBe("20.0%");
    expect(screen.getByTestId("car-rl-ha").textContent).toContain("20,00 ha");

    const progress = screen.getByRole("progressbar");
    expect(progress.getAttribute("aria-valuenow")).toBe("20");
    expect(progress.getAttribute("aria-valuemin")).toBe("0");
    expect(progress.getAttribute("aria-valuemax")).toBe("100");
  });

  it("discriminates layers without repeating AREA_IMOVEL in sublist", () => {
    render(<CarSummaryCard summary={mockSummary} />);

    const list = screen.getByTestId("car-layers-list");
    expect(list.textContent).toContain("Reserva Legal");
    expect(list.textContent).toContain("Área de Preservação Permanente (APP)");
    expect(list.textContent).toContain("Área Consolidada");
    // AREA_IMOVEL is not listed in sub-list
    expect(list.textContent).not.toContain("Área do Imóvel");
  });

  it("allows copying the CAR code to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<CarSummaryCard summary={mockSummary} />);

    const copyBtn = screen.getByLabelText("Copiar código do CAR");
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("GO-5201108-8B7C9D01234");
    await waitFor(() => {
      expect(screen.getByText("Copiado!")).toBeDefined();
    });
  });

  it("handles edge case with missing optional metadata gracefully", () => {
    const minimalSummary: CarPropertySummary = {
      isCarDataset: true,
      areaImovelHa: 50,
      areaImovelSqMeters: 500000,
      areaReservaLegalHa: 0,
      areaReservaLegalSqMeters: 0,
      reservaLegalPercent: 0,
      layers: [],
    };

    render(<CarSummaryCard summary={minimalSummary} />);

    expect(screen.queryByTestId("car-code")).toBeNull();
    expect(screen.queryByTestId("car-status-badge")).toBeNull();
    expect(screen.getByTestId("car-area-ha").textContent).toContain("50,00 ha");
    expect(screen.getByTestId("car-rl-percent").textContent).toBe("0.0%");
  });

  it("persists and restores alqueire regional preference via localStorage", () => {
    localStorage.clear();
    const { unmount } = render(<CarSummaryCard summary={mockSummary} />);
    const select = screen.getByLabelText("Selecionar padrão regional de alqueire") as HTMLSelectElement;
    expect(select.value).toBe("alqueire_paulista");

    fireEvent.change(select, { target: { value: "alqueire_mineiro" } });
    expect(localStorage.getItem(CAR_ALQUEIRE_STORAGE_KEY)).toBe("alqueire_mineiro");
    unmount();

    // Nova renderização restaura a preferência offline salva
    render(<CarSummaryCard summary={mockSummary} />);
    const restoredSelect = screen.getByLabelText("Selecionar padrão regional de alqueire") as HTMLSelectElement;
    expect(restoredSelect.value).toBe("alqueire_mineiro");
    expect(screen.getByTestId("car-area-alqueires").textContent).toContain("20,66 alq. mineiro");
    localStorage.clear();
  });
});
