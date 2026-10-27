import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { CarSummaryCard } from "./CarSummaryCard";
import type { CarPropertySummary } from "@markmap/maps";

describe("CarSummaryCard — Adversarial & Stress Testing", () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
  });

  const baseSummary: CarPropertySummary = {
    isCarDataset: true,
    carCode: "TO-1702109-1A2B3C4D5E6F",
    municipality: "Araguaína",
    state: "TO",
    status: "ATIVO",
    // 484.000 m² = 48,40 ha
    // No Paulista (2,42 ha = 24.200 m²): 484.000 / 24.200 = 20,00 alq
    // No Mineiro (4,84 ha = 48.400 m²): 484.000 / 48.400 = 10,00 alq
    // No Baiano (9,68 ha = 96.800 m²): 484.000 / 96.800 = 5,00 alq
    // No Do Norte (2,72 ha = 27.200 m²): 484.000 / 27.200 ≈ 17,79 alq
    areaImovelHa: 48.4,
    areaImovelSqMeters: 484000,
    // 96.800 m² = 9,68 ha (exatamente 20% do imóvel)
    // No Paulista: 96.800 / 24.200 = 4,00 alq
    // No Mineiro: 96.800 / 48.400 = 2,00 alq
    // No Baiano: 96.800 / 96.800 = 1,00 alq
    // No Do Norte: 96.800 / 27.200 ≈ 3,56 alq
    areaReservaLegalHa: 9.68,
    areaReservaLegalSqMeters: 96800,
    reservaLegalPercent: 20.0,
    layers: [
      {
        layerType: "AREA_IMOVEL",
        label: "Área do Imóvel",
        count: 1,
        areaHa: 48.4,
        areaSqMeters: 484000,
        style: { fillColor: "#FF9800", fillOpacity: 0.15, strokeColor: "#E65100", strokeWidth: 2 },
      },
      {
        layerType: "RESERVA_LEGAL",
        label: "Reserva Legal",
        count: 1,
        areaHa: 9.68,
        areaSqMeters: 96800,
        style: { fillColor: "#2E7D32", fillOpacity: 0.4, strokeColor: "#1B5E20", strokeWidth: 1.5 },
      },
    ],
  };

  describe("Alternância e Consistência de Alqueires Regionais", () => {
    it("updates BOTH imovel area and reserva legal area simultaneously across all 4 regional alqueire standards", () => {
      render(<CarSummaryCard summary={baseSummary} />);

      const select = screen.getByLabelText("Selecionar padrão regional de alqueire") as HTMLSelectElement;

      // 1. Padrão inicial: Paulista (2,42 ha)
      expect(select.value).toBe("alqueire_paulista");
      expect(screen.getByTestId("car-area-ha").textContent).toContain("48,40 ha");
      expect(screen.getByTestId("car-area-alqueires").textContent).toContain("20,00 alq. paulista");
      expect(screen.getByTestId("car-rl-ha").textContent).toContain("9,68 ha");
      expect(screen.getByTestId("car-rl-alqueires").textContent).toContain("4,00 alq. paulista");

      // 2. Mudança para Mineiro / Goiano (4,84 ha)
      fireEvent.change(select, { target: { value: "alqueire_mineiro" } });
      expect(screen.getByTestId("car-area-alqueires").textContent).toContain("10,00 alq. mineiro");
      expect(screen.getByTestId("car-rl-alqueires").textContent).toContain("2,00 alq. mineiro");

      // 3. Mudança para Baiano (9,68 ha)
      fireEvent.change(select, { target: { value: "alqueire_baiano" } });
      expect(screen.getByTestId("car-area-alqueires").textContent).toContain("5,00 alq. baiano");
      expect(screen.getByTestId("car-rl-alqueires").textContent).toContain("1,00 alq. baiano");

      // 4. Mudança para Do Norte (2,72 ha)
      fireEvent.change(select, { target: { value: "alqueire_norte" } });
      expect(screen.getByTestId("car-area-alqueires").textContent).toContain("17,79 alq. norte");
      expect(screen.getByTestId("car-rl-alqueires").textContent).toContain("3,56 alq. norte");

      // 5. Retorno para Paulista
      fireEvent.change(select, { target: { value: "alqueire_paulista" } });
      expect(screen.getByTestId("car-area-alqueires").textContent).toContain("20,00 alq. paulista");
      expect(screen.getByTestId("car-rl-alqueires").textContent).toContain("4,00 alq. paulista");
    });

    it("handles zero area (0 m²) without NaN or formatting corruption", () => {
      const zeroSummary: CarPropertySummary = {
        ...baseSummary,
        areaImovelHa: 0,
        areaImovelSqMeters: 0,
        areaReservaLegalHa: 0,
        areaReservaLegalSqMeters: 0,
        reservaLegalPercent: 0,
      };

      render(<CarSummaryCard summary={zeroSummary} />);

      expect(screen.getByTestId("car-area-ha").textContent).toContain("0,00 ha");
      expect(screen.getByTestId("car-area-alqueires").textContent).toContain("0,00 alq. paulista");
      expect(screen.getByTestId("car-rl-ha").textContent).toContain("0,00 ha");
      expect(screen.getByTestId("car-rl-alqueires").textContent).toContain("0,00 alq. paulista");
      expect(screen.getByTestId("car-rl-percent").textContent).toBe("0.0%");
    });

    it("handles huge land tracts (100.000 ha) with correct thousands formatting", () => {
      // 100.000 ha = 1.000.000.000 m²
      const hugeSummary: CarPropertySummary = {
        ...baseSummary,
        areaImovelHa: 100000,
        areaImovelSqMeters: 1000000000,
      };

      render(<CarSummaryCard summary={hugeSummary} />);

      expect(screen.getByTestId("car-area-ha").textContent).toContain("100.000,00 ha");
      // 1.000.000.000 / 24.200 ≈ 41.322,31 alq. paulista
      expect(screen.getByTestId("car-area-alqueires").textContent).toContain("41.322,31 alq. paulista");
    });
  });

  describe("Reserva Legal Progress Bar Clamping & Integrity", () => {
    it("clamps progress bar width to 100% when RL percentage exceeds 100%", () => {
      const overflowSummary: CarPropertySummary = {
        ...baseSummary,
        reservaLegalPercent: 135.5,
      };

      render(<CarSummaryCard summary={overflowSummary} />);

      expect(screen.getByTestId("car-rl-percent").textContent).toBe("135.5%");
      const progress = screen.getByRole("progressbar");
      expect(progress.getAttribute("aria-valuenow")).toBe("135.5");

      // Progress bar fill style width must be clamped to 100%
      const fillBar = progress.firstElementChild as HTMLElement;
      expect(fillBar.style.width).toBe("100%");
    });

    it("clamps progress bar width to 0% when RL percentage is negative", () => {
      const negativeSummary: CarPropertySummary = {
        ...baseSummary,
        reservaLegalPercent: -10,
      };

      render(<CarSummaryCard summary={negativeSummary} />);

      const progress = screen.getByRole("progressbar");
      const fillBar = progress.firstElementChild as HTMLElement;
      expect(fillBar.style.width).toBe("0%");
    });
  });

  describe("Clipboard Resiliency & Edge Cases", () => {
    it("does not throw when navigator.clipboard is undefined/unavailable", () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });

      render(<CarSummaryCard summary={baseSummary} />);

      const copyBtn = screen.getByLabelText("Copiar código do CAR");
      expect(() => fireEvent.click(copyBtn)).not.toThrow();
      expect(screen.queryByText("Copiado!")).toBeNull();
    });

    it("gracefully catches writeText rejection (e.g. permission denied) without crashing UI", async () => {
      const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError: Permission denied"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      render(<CarSummaryCard summary={baseSummary} />);

      const copyBtn = screen.getByLabelText("Copiar código do CAR");
      fireEvent.click(copyBtn);

      expect(writeText).toHaveBeenCalledWith("TO-1702109-1A2B3C4D5E6F");
      // "Copiado!" should NOT appear on failure
      await waitFor(() => {
        expect(screen.queryByText("Copiado!")).toBeNull();
      });
    });

    it("displays 'Copiado!' on successful copy and auto-dismisses", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });

      render(<CarSummaryCard summary={baseSummary} />);

      const copyBtn = screen.getByLabelText("Copiar código do CAR");
      fireEvent.click(copyBtn);

      expect(writeText).toHaveBeenCalledWith("TO-1702109-1A2B3C4D5E6F");

      // Verify "Copiado!" appears
      await waitFor(() => {
        expect(screen.getByText("Copiado!")).toBeDefined();
      });

      // Wait 2100ms for real timeout to dismiss
      await waitFor(
        () => {
          expect(screen.queryByText("Copiado!")).toBeNull();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("Status Badge Varied Scenarios", () => {
    it.each([
      ["ATIVO", "border-emerald-300"],
      ["ativo no sicar", "border-emerald-300"],
      ["PENDENTE", "border-amber-300"],
      ["pendente de analise", "border-amber-300"],
      ["SUSPENSO", "border-rose-300"],
      ["CANCELADO", "border-rose-300"],
      ["EM_ANALISE_ESTADUAL", "border-outline-variant"],
    ])("status '%s' maps to correct badge styling with token %s", (status, expectedClass) => {
      const summary: CarPropertySummary = {
        ...baseSummary,
        status,
      };

      const { unmount } = render(<CarSummaryCard summary={summary} />);
      const badge = screen.getByTestId("car-status-badge");
      expect(badge.className).toContain(expectedClass);
      unmount();
    });
  });

  describe("WCAG AA Contrast Semantic Tokens Check", () => {
    it("uses semantic theme tokens for background, border, text and progress bar", () => {
      const { container } = render(<CarSummaryCard summary={baseSummary} />);
      const rootSection = container.querySelector("section");

      expect(rootSection?.className).toContain("bg-surface-container");
      expect(rootSection?.className).toContain("border-outline-variant");
      expect(rootSection?.className).toContain("text-on-surface");
    });
  });
});
