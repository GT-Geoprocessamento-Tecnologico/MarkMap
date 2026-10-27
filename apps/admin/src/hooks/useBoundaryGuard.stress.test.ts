// Desenvolvido por MtsFerreira. Testes adversariais e estresse empírico do Boundary Guard (M5).
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { useBoundaryGuard, type UseBoundaryGuardOptions } from "./useBoundaryGuard";
import {
  BoundaryAlertBanner,
  formatBoundaryDistance,
} from "../components/map/BoundaryAlertBanner";
import {
  setBoundaryAudioMuted,
  resetBoundaryAudioThrottleForTests,
  resetBoundaryAudioContextForTests,
} from "../lib/sound/boundary-audio";
import { setupMockAudioContext, type MockAudioContext } from "../test/mock-audio-context";

// Polígono representativo de fazenda em Goiás (latitude -16.0 deg)
// Dimensões aprox: 0.1 deg (~11.12 km de lado)
const mockFarmFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  id: "fazenda-rio-vermelho",
  properties: {
    nome: "Fazenda Rio Vermelho",
    tipo: "AREA_IMOVEL",
    nom_tema: "AREA_IMOVEL",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-48.0, -16.0],
        [-47.9, -16.0],
        [-47.9, -16.1],
        [-48.0, -16.1],
        [-48.0, -16.0],
      ],
    ],
  },
};

// Gerador procedural de polígono côncavo de alta complexidade com N vértices
function generateComplexPolygonFeature(vertexCount: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const centerLng = -47.95;
  const centerLat = -16.05;
  const baseRadius = 0.04;
  const coordinates: [number, number][] = [];

  for (let i = 0; i < vertexCount; i++) {
    const angle = (i / vertexCount) * 2 * Math.PI;
    // Variação radial sinusoidal simulando contornos de serra e rios
    const r = baseRadius * (1 + 0.25 * Math.sin(5 * angle) + 0.1 * Math.cos(13 * angle));
    const lng = centerLng + r * Math.cos(angle);
    const lat = centerLat + r * Math.sin(angle);
    coordinates.push([lng, lat]);
  }
  // Fecha o anel linear
  coordinates.push([coordinates[0]![0], coordinates[0]![1]]);

  return {
    type: "Feature",
    id: `complex-polygon-${vertexCount}`,
    properties: {
      nome: `Fazenda Complexa ${vertexCount} Vértices`,
      nom_tema: "AREA_IMOVEL",
    },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}

describe("Empirical Challenger M5-2: Boundary Guard Stress & Adversarial Suite", () => {
  let audioContextScope: { mockCtx: MockAudioContext; restore: () => void };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000); // Timestamp base determinístico
    localStorage.clear();
    setBoundaryAudioMuted(false);
    resetBoundaryAudioThrottleForTests();
    resetBoundaryAudioContextForTests();
    audioContextScope = setupMockAudioContext();
  });

  afterEach(() => {
    vi.useRealTimers();
    audioContextScope.restore();
    resetBoundaryAudioContextForTests();
    localStorage.clear();
  });

  // =========================================================================
  // FRENTE 1: Frequência extrema de GPS (10 Hz) e Throttle Estrito de 15s
  // =========================================================================
  describe("Frequência Extrema GNSS (10 Hz) e Throttle Contínuo", () => {
    it("mantém estritamente o throttle de 15 segundos sob 300 atualizações GNSS (10 Hz durante 30s) na zona de aproximação", async () => {
      const { mockCtx } = audioContextScope;
      const initialProps: UseBoundaryGuardOptions = {
        // ~30 metros ao sul do limite norte (-16.0) -> aproximação (< 50m)
        currentPosition: [-47.95, -16.0 - 30 / 111195],
        features: [mockFarmFeature],
        warningThresholdMeters: 50,
      };

      const { result, rerender } = renderHook(
        (props: UseBoundaryGuardOptions) => useBoundaryGuard(props),
        { initialProps }
      );

      expect(result.current.status).toBe("approaching");
      // Disparo inicial em t = 0s: tom duplo D5 cria exatamente 2 osciladores
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

      // Simula 30 segundos contínuos a 10 Hz (300 amostras a cada 100ms)
      // O operador caminha rente à cerca (distância oscilando entre 25m e 35m)
      for (let step = 1; step <= 300; step++) {
        act(() => {
          vi.advanceTimersByTime(100); // 100ms por ciclo GNSS (10 Hz)
        });

        const jitterDistance = 25 + (step % 10); // 25m .. 34m da cerca
        const jitterLat = -16.0 - jitterDistance / 111195;

        act(() => {
          rerender({
            currentPosition: [-47.95, jitterLat],
            features: [mockFarmFeature],
            warningThresholdMeters: 50,
          });
        });

        expect(result.current.status).toBe("approaching");

        // Verificações determinísticas de throttle nos marcos temporais:
        if (step < 150) {
          // De t = 0.1s até t = 14.9s: NENHUM novo oscilador deve ser criado!
          expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
        } else if (step === 150) {
          // Exatamente em t = 15.0s: o throttle de 15s expirou, segundo alerta toca (+2 osciladores = 4)
          expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);
        } else if (step < 300) {
          // De t = 15.1s até t = 29.9s: throttle ativo novamente
          expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);
        } else if (step === 300) {
          // Exatamente em t = 30.0s: terceiro alerta toca (+2 osciladores = 6)
          expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6);
        }
      }

      // Prova empírica: sob 300 updates a 10 Hz, foram criados exatamente 6 osciladores,
      // e não 600 osciladores (redução de 99% na pressão de áudio).
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6);
    });

    it("previne spam sonoro quando o GPS oscila bruscamente na fronteira de aproximação (49m <-> 51m a 10 Hz)", () => {
      const { mockCtx } = audioContextScope;
      const { result, rerender } = renderHook(
        (props: UseBoundaryGuardOptions) => useBoundaryGuard(props),
        {
          initialProps: {
            currentPosition: [-47.95, -16.0 - 48 / 111195], // 48m (approaching)
            features: [mockFarmFeature],
            warningThresholdMeters: 50,
          },
        }
      );

      expect(result.current.status).toBe("approaching");
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

      // Simula 20 oscilações rápidas entre seguro (52m) e alerta (48m) a 10 Hz
      for (let i = 0; i < 20; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
        });

        // Alterna entre 52m (safe) e 48m (approaching)
        const dist = i % 2 === 0 ? 52 : 48;
        act(() => {
          rerender({
            currentPosition: [-47.95, -16.0 - dist / 111195],
            features: [mockFarmFeature],
            warningThresholdMeters: 50,
          });
        });

        // Mesmo com a alternância entre safe e approaching, o throttle de 15s de approaching
        // no motor de áudio impede o disparo de novos alertas sonoros dentro da janela.
        expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      }
    });
  });

  // =========================================================================
  // FRENTE 2: Escalação Instantânea de Severidade (approaching -> breach)
  // =========================================================================
  describe("Escalação Instantânea de Severidade", () => {
    it("dispara imediatamente o tom de breach mesmo que o throttle de 15s de approaching ainda esteja ativo", () => {
      const { mockCtx } = audioContextScope;

      // Inicia em aproximação no instante t = 0s
      const { result, rerender } = renderHook(
        (props: UseBoundaryGuardOptions) => useBoundaryGuard(props),
        {
          initialProps: {
            currentPosition: [-47.95, -16.0 - 30 / 111195], // 30m dentro (approaching)
            features: [mockFarmFeature],
            warningThresholdMeters: 50,
          },
        }
      );

      expect(result.current.status).toBe("approaching");
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

      // 2 segundos se passam com GPS a 10 Hz (t = 2.0s; ainda faltam 13 segundos de throttle!)
      for (let i = 0; i < 20; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

      // Em t = 2.1s, o operador transpõe a divisa e sai da fazenda (-15.999 ao norte da divisa)
      act(() => {
        vi.advanceTimersByTime(100);
        rerender({
          currentPosition: [-47.95, -15.999], // Fora da propriedade -> BREACH
          features: [mockFarmFeature],
          warningThresholdMeters: 50,
        });
      });

      // Validação empírica: status escalado para breach imediatamente
      expect(result.current.status).toBe("breach");
      // O tom descendente de breach cria +1 oscilador imediatamente, totalizando 3
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);

      // O oscilador de breach sintetiza o tom descendente 440 -> 330 Hz
      const breachOsc = mockCtx.createdOscillators[2]!;
      expect(breachOsc.frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
      expect(breachOsc.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(330, expect.any(Number));

      // Se continuar fora a 10 Hz por mais 5 segundos (t = 2.2s .. 7.1s),
      // o throttle do breach garante que ele não toca novamente antes dos 15s
      for (let i = 0; i < 50; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
          rerender({
            currentPosition: [-47.95, -15.998 - i * 0.0001],
            features: [mockFarmFeature],
            warningThresholdMeters: 50,
          });
        });
      }
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(3);
    });

    it("BoundaryAlertBanner quebra automaticamente o estado dispensado (dismiss) quando ocorre transição para breach", () => {
      const onDismiss = vi.fn();
      const onToggleMute = vi.fn();

      const { rerender } = render(
        React.createElement(BoundaryAlertBanner, {
          status: "approaching",
          distanceMeters: 35,
          polygonName: "Fazenda Rio Vermelho",
          isMuted: false,
          onToggleMute,
          onDismiss,
        })
      );

      // Banner exibido em aproximação
      const banner = screen.getByTestId("boundary-alert-banner");
      expect(banner).toBeInTheDocument();
      expect(screen.getByText("Atenção: Divisa Próxima")).toBeInTheDocument();

      // Usuário clica no botão de fechar/dispensar
      const closeBtn = screen.getByRole("button", { name: "Dispensar alerta de divisa" });
      fireEvent.click(closeBtn);
      expect(onDismiss).toHaveBeenCalledTimes(1);

      // Banner deve ter sido dispensado da DOM
      expect(screen.queryByTestId("boundary-alert-banner")).not.toBeInTheDocument();

      // Agora simula escalação para 'breach' (usuário cruza a cerca)
      rerender(
        React.createElement(BoundaryAlertBanner, {
          status: "breach",
          distanceMeters: 10,
          polygonName: "Fazenda Rio Vermelho",
          isMuted: false,
          onToggleMute,
          onDismiss,
        })
      );

      // Trava de segurança: o banner DEVE reaparecer instantaneamente como 'breach'
      const rearmedBanner = screen.getByTestId("boundary-alert-banner");
      expect(rearmedBanner).toBeInTheDocument();
      expect(rearmedBanner).toHaveAttribute("data-status", "breach");
      expect(screen.getByText("Fora dos Limites")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // FRENTE 3: Não-Regressão Visual e Isolamento dos Atalhos Inferiores do Mapa
  // =========================================================================
  describe("Isolamento de UI e Ausência de Regressão em Atalhos Móveis", () => {
    it("não interfere fisicamente com a barra inferior de atalhos e preserva hierarquia z-index e posicionamento top-4", () => {
      const renderToolbar = () =>
        React.createElement(
          "div",
          {
            role: "toolbar",
            "aria-label": "Atalhos do mapa",
            className: "absolute bottom-4 left-4 right-4 z-20 flex gap-2",
          },
          React.createElement("button", { type: "button" }, "Buscar locais neste mapa"),
          React.createElement("button", { type: "button" }, "Altitude"),
          React.createElement("button", { type: "button" }, "Navegação GPS offline")
        );

      const { rerender } = render(
        React.createElement(
          "div",
          { className: "relative w-full h-[600px] overflow-hidden" },
          React.createElement(BoundaryAlertBanner, {
            status: "approaching",
            distanceMeters: 25,
            polygonName: "Fazenda Rio Vermelho",
            isMuted: false,
            onToggleMute: vi.fn(),
          }),
          renderToolbar()
        )
      );

      const banner = screen.getByTestId("boundary-alert-banner");
      const toolbar = screen.getByRole("toolbar", { name: "Atalhos do mapa" });

      expect(banner).toBeInTheDocument();
      expect(toolbar).toBeInTheDocument();

      // O banner está fixado no topo com absolute top-4 z-30
      expect(banner.className).toContain("absolute");
      expect(banner.className).toContain("top-4");
      expect(banner.className).toContain("z-30");

      // Transição de estados do banner não causa desmontagem da barra de atalhos
      const statuses: Array<"approaching" | "breach" | "safe" | "inactive"> = [
        "breach",
        "safe",
        "approaching",
        "inactive",
      ];

      for (const st of statuses) {
        rerender(
          React.createElement(
            "div",
            { className: "relative w-full h-[600px] overflow-hidden" },
            React.createElement(BoundaryAlertBanner, {
              status: st,
              distanceMeters: 15,
              polygonName: "Fazenda Rio Vermelho",
              isMuted: false,
              onToggleMute: vi.fn(),
            }),
            renderToolbar()
          )
        );

        // A barra de atalhos permanece intacta e acessível em todos os ciclos
        expect(screen.getByRole("toolbar", { name: "Atalhos do mapa" })).toBeInTheDocument();
      }
    });

    it("assegura touch-targets >= 44x44px para todos os botões do banner (WCAG AA)", () => {
      render(
        React.createElement(BoundaryAlertBanner, {
          status: "approaching",
          distanceMeters: 25,
          polygonName: "Fazenda Rio Vermelho",
          isMuted: false,
          onToggleMute: vi.fn(),
        })
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(2); // Mute e Dismiss

      for (const btn of buttons) {
        expect(btn.className).toContain("min-h-[44px]");
        expect(btn.className).toContain("min-w-[44px]");
      }
    });
  });

  // =========================================================================
  // FRENTE 4: Condições Extremas: Polígono Complexo, Jitter e Telemetria Espúria
  // =========================================================================
  describe("Resiliência Sob Condições Adversas e Anomalias GNSS", () => {
    it("processa polígono côncavo irregular de 500 vértices a 10 Hz sem degradação de performance", () => {
      const complexFeature = generateComplexPolygonFeature(500);
      const startTime = performance.now();

      const { result, rerender } = renderHook(
        (props: UseBoundaryGuardOptions) => useBoundaryGuard(props),
        {
          initialProps: {
            currentPosition: [-47.95, -16.05], // Centro
            features: [complexFeature],
          },
        }
      );

      expect(result.current.status).toBe("safe");

      // Executa 100 ciclos a 10 Hz contra o polígono de 500 vértices
      for (let i = 0; i < 100; i++) {
        act(() => {
          rerender({
            currentPosition: [-47.95 + 0.0001 * Math.sin(i), -16.05 + 0.0001 * Math.cos(i)],
            features: [complexFeature],
          });
        });
      }

      const totalTimeMs = performance.now() - startTime;
      // 100 iterações com projeção analítica tangente local devem rodar em tempo ínfimo (< 1000ms total)
      expect(totalTimeMs).toBeLessThan(1000);
      expect(result.current.status).toBe("safe");
    });

    it("tolera falha GNSS súbita (NaN, Infinity, coordenadas ausentes) sem quebrar o hook", () => {
      const { result, rerender } = renderHook(
        (props: UseBoundaryGuardOptions) => useBoundaryGuard(props),
        {
          initialProps: {
            currentPosition: [-47.95, -16.05] as [number, number] | null,
            features: [mockFarmFeature],
          },
        }
      );

      expect(result.current.status).toBe("safe");

      // Perda total de fix GNSS (satélites perdidos)
      act(() => {
        rerender({
          currentPosition: null,
          features: [mockFarmFeature],
        });
      });

      expect(result.current.status).toBe("inactive");
      expect(result.current.distanceToBoundaryMeters).toBeNull();
      expect(result.current.activeAlert).toBeNull();

      // Coordenadas com NaN simulando driver GPS com leitura corrompida
      act(() => {
        rerender({
          currentPosition: [Number.NaN, Number.NaN],
          features: [mockFarmFeature],
        });
      });

      // Não deve emitir som nem lançar exceção
      expect(result.current.status).toBe("breach"); // NaN cai fora do polígono seguro
    });

    it("respeita silenciamento reativo (Mute) acionado durante rajada GNSS ativa", () => {
      const { mockCtx } = audioContextScope;
      const { result, rerender } = renderHook(
        (props: UseBoundaryGuardOptions) => useBoundaryGuard(props),
        {
          initialProps: {
            currentPosition: [-47.95, -16.0 - 30 / 111195],
            features: [mockFarmFeature],
          },
        }
      );

      expect(result.current.status).toBe("approaching");
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);

      // Usuário ativa o mute pelo hook
      act(() => {
        result.current.setMuted(true);
      });
      expect(result.current.isMuted).toBe(true);

      // Avança o tempo além do throttle (20 segundos)
      act(() => {
        vi.advanceTimersByTime(20_000);
      });

      // Rerenderiza com nova posição em aproximação
      act(() => {
        rerender({
          currentPosition: [-47.95, -16.0 - 20 / 111195],
          features: [mockFarmFeature],
        });
      });

      // Como estava silenciado, o som NÃO foi tocado mesmo após expirar os 15s de throttle
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // FRENTE 5: Acessibilidade e Auditoria de Contraste Semântico
  // =========================================================================
  describe("Acessibilidade e Contraste Semântico", () => {
    it("atribui papéis e atributos ARIA corretos conforme a severidade", () => {
      const { rerender } = render(
        React.createElement(BoundaryAlertBanner, {
          status: "approaching",
          distanceMeters: 42,
          polygonName: "Fazenda Rio Vermelho",
          isMuted: false,
          onToggleMute: vi.fn(),
        })
      );

      let banner = screen.getByTestId("boundary-alert-banner");
      expect(banner).toHaveAttribute("role", "status");
      expect(banner).toHaveAttribute("aria-live", "polite");

      rerender(
        React.createElement(BoundaryAlertBanner, {
          status: "breach",
          distanceMeters: 0,
          polygonName: "Fazenda Rio Vermelho",
          isMuted: false,
          onToggleMute: vi.fn(),
        })
      );

      banner = screen.getByTestId("boundary-alert-banner");
      expect(banner).toHaveAttribute("role", "alert");
      expect(banner).toHaveAttribute("aria-live", "assertive");
    });

    it("formata distâncias de divisa com precisão métrica e quilométrica", () => {
      expect(formatBoundaryDistance(null)).toBe("divisa");
      expect(formatBoundaryDistance(Number.NaN)).toBe("divisa");
      expect(formatBoundaryDistance(0)).toBe("0 m");
      expect(formatBoundaryDistance(45.4)).toBe("45 m");
      expect(formatBoundaryDistance(999)).toBe("999 m");
      expect(formatBoundaryDistance(1500)).toBe("1.50 km");
      expect(formatBoundaryDistance(12345)).toBe("12.35 km");
    });
  });
});
