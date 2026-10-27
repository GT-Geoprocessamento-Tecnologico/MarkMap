// Desenvolvido por MtsFerreira. Testes unitários do BoundaryAlertBanner com React Testing Library.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BoundaryAlertBanner,
  formatBoundaryDistance,
} from "./BoundaryAlertBanner";

describe("BoundaryAlertBanner", () => {
  it("não renderiza nada quando o status é 'inactive' ou 'safe'", () => {
    const { container: inactiveContainer } = render(
      <BoundaryAlertBanner
        status="inactive"
        distanceMeters={null}
        isMuted={false}
        onToggleMute={vi.fn()}
      />
    );
    expect(inactiveContainer.firstChild).toBeNull();

    const { container: safeContainer } = render(
      <BoundaryAlertBanner
        status="safe"
        distanceMeters={120}
        isMuted={false}
        onToggleMute={vi.fn()}
      />
    );
    expect(safeContainer.firstChild).toBeNull();
  });

  it("renderiza aviso amarelo/âmbar com 'status' role e texto formatado quando em 'approaching'", () => {
    render(
      <BoundaryAlertBanner
        status="approaching"
        distanceMeters={38.4}
        polygonName="Fazenda Boa Vista"
        isMuted={false}
        onToggleMute={vi.fn()}
      />
    );

    const banner = screen.getByTestId("boundary-alert-banner");
    expect(banner).toBeDefined();
    expect(banner.getAttribute("role")).toBe("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");

    const badge = screen.getByTestId("boundary-status-badge");
    expect(badge.textContent).toContain("Atenção: Divisa Próxima");

    const message = screen.getByTestId("boundary-alert-message");
    expect(message.textContent).toContain("38 m");
    expect(message.textContent).toContain("Fazenda Boa Vista");
  });

  it("renderiza alerta vermelho com 'alert' role quando em 'breach'", () => {
    render(
      <BoundaryAlertBanner
        status="breach"
        distanceMeters={12}
        polygonName="Gleba Norte"
        isMuted={false}
        onToggleMute={vi.fn()}
      />
    );

    const banner = screen.getByTestId("boundary-alert-banner");
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.getAttribute("aria-live")).toBe("assertive");

    const badge = screen.getByTestId("boundary-status-badge");
    expect(badge.textContent).toContain("Fora dos Limites");

    const message = screen.getByTestId("boundary-alert-message");
    expect(message.textContent).toContain("Fora dos limites de Gleba Norte");
  });

  it("permite silenciar e reativar o som através do botão de áudio", () => {
    const onToggleMute = vi.fn();
    const { rerender } = render(
      <BoundaryAlertBanner
        status="approaching"
        distanceMeters={25}
        isMuted={false}
        onToggleMute={onToggleMute}
      />
    );

    const muteBtn = screen.getByRole("button", {
      name: "Silenciar alertas sonoros de divisa",
    });
    expect(muteBtn).toBeDefined();
    fireEvent.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    // Rerender com estado mutado
    rerender(
      <BoundaryAlertBanner
        status="approaching"
        distanceMeters={25}
        isMuted={true}
        onToggleMute={onToggleMute}
      />
    );

    const unmuteBtn = screen.getByRole("button", {
      name: "Ativar alertas sonoros de divisa",
    });
    expect(unmuteBtn).toBeDefined();
  });

  it("permite dispensar o banner temporariamente e reativa ao transicionar para 'breach'", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <BoundaryAlertBanner
        status="approaching"
        distanceMeters={30}
        isMuted={false}
        onToggleMute={vi.fn()}
        onDismiss={onDismiss}
      />
    );

    const closeBtn = screen.getByRole("button", {
      name: "Dispensar alerta de divisa",
    });
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // O banner deve desaparecer
    expect(screen.queryByTestId("boundary-alert-banner")).toBeNull();

    // Se o estado evoluir para 'breach', o banner deve reaparecer automaticamente por segurança
    rerender(
      <BoundaryAlertBanner
        status="breach"
        distanceMeters={5}
        isMuted={false}
        onToggleMute={vi.fn()}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByTestId("boundary-alert-banner")).toBeDefined();
  });

  it("função auxiliar formatBoundaryDistance formata metros e quilômetros corretamente", () => {
    expect(formatBoundaryDistance(null)).toBe("divisa");
    expect(formatBoundaryDistance(45)).toBe("45 m");
    expect(formatBoundaryDistance(999)).toBe("999 m");
    expect(formatBoundaryDistance(1500)).toBe("1.50 km");
    expect(formatBoundaryDistance(2745)).toBe("2.75 km");
  });
});
