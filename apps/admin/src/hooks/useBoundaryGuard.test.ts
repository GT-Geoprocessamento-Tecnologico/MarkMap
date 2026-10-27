import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBoundaryGuard, type UseBoundaryGuardOptions } from "./useBoundaryGuard";
import {
  setBoundaryAudioMuted,
  resetBoundaryAudioThrottleForTests,
  resetBoundaryAudioContextForTests,
} from "../lib/sound/boundary-audio";
import { setupMockAudioContext, type MockAudioContext } from "../test/mock-audio-context";

// Polígono de teste representando uma propriedade rural na latitude -16.0 (Goiás)
// Dimensões aprox: 0.1 deg (~11.1 km de lado)
const mockFarmFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  id: "fazenda-santa-helena",
  properties: {
    nome: "Fazenda Santa Helena",
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

const mockReservaLegalFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: "Feature",
  id: "rl-santa-helena",
  properties: {
    nome: "Reserva Legal",
    tipo: "RESERVA_LEGAL",
  },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-47.98, -16.02],
        [-47.92, -16.02],
        [-47.92, -16.08],
        [-47.98, -16.08],
        [-47.98, -16.02],
      ],
    ],
  },
};

describe("useBoundaryGuard Hook", () => {
  let audioContextScope: { mockCtx: MockAudioContext; restore: () => void };

  beforeEach(() => {
    localStorage.clear();
    setBoundaryAudioMuted(false);
    resetBoundaryAudioThrottleForTests();
    resetBoundaryAudioContextForTests();
    audioContextScope = setupMockAudioContext();
  });

  afterEach(() => {
    audioContextScope.restore();
    resetBoundaryAudioContextForTests();
    localStorage.clear();
  });

  it("remains inactive when currentPosition or features are absent", () => {
    const { result, rerender } = renderHook(
      (props: UseBoundaryGuardOptions) => useBoundaryGuard(props),
      {
        initialProps: {
          currentPosition: null as { lat: number; lng: number } | null,
          features: [mockFarmFeature],
        },
      }
    );

    expect(result.current.status).toBe("inactive");
    expect(result.current.distanceToBoundaryMeters).toBeNull();
    expect(result.current.activeAlert).toBeNull();

    // Rerender com posição mas sem feições
    rerender({
      currentPosition: { lat: -16.05, lng: -47.95 },
      features: [],
    });

    expect(result.current.status).toBe("inactive");
  });

  it("evaluates user as 'safe' when deep inside the rural property (>50m from boundary)", () => {
    const onStatusChange = vi.fn();
    const { result } = renderHook(() =>
      useBoundaryGuard({
        currentPosition: { lat: -16.05, lng: -47.95 }, // centro da fazenda (~5.5km das cercas)
        features: [mockFarmFeature],
        warningThresholdMeters: 50,
        onStatusChange,
      })
    );

    expect(result.current.status).toBe("safe");
    expect(result.current.nearestPolygonName).toBe("Fazenda Santa Helena");
    expect(result.current.distanceToBoundaryMeters).toBeGreaterThan(1000);
    expect(onStatusChange).toHaveBeenCalledWith("safe", expect.anything());

    // Não deve disparar alerta sonoro quando em safe
    const { mockCtx } = audioContextScope;
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
  });

  it("evaluates user as 'approaching' when within warningThresholdMeters", () => {
    // Latitude da borda norte é -16.0.
    // 30 metros ao sul da borda norte (dentro da fazenda):
    // 30m / 111195 m/deg = ~0.00027 graus
    const lat30mInsideNorth = -16.0 - 30 / 111195;

    const { result } = renderHook(() =>
      useBoundaryGuard({
        currentPosition: [-47.95, lat30mInsideNorth],
        features: [mockFarmFeature],
        warningThresholdMeters: 50,
      })
    );

    expect(result.current.status).toBe("approaching");
    expect(result.current.distanceToBoundaryMeters).toBeCloseTo(30, -1);
    expect(result.current.nearestPolygonName).toBe("Fazenda Santa Helena");

    // Alerta sonoro de approaching deve ter sido disparado
    const { mockCtx } = audioContextScope;
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("evaluates user as 'breach' when outside property polygon", () => {
    const onStatusChange = vi.fn();
    const { result } = renderHook(() =>
      useBoundaryGuard({
        currentPosition: { lat: -15.9, lng: -47.95 }, // fora da fazenda (ao norte)
        features: [mockFarmFeature],
        warningThresholdMeters: 50,
        onStatusChange,
      })
    );

    expect(result.current.status).toBe("breach");
    expect(result.current.activeAlert).not.toBeNull();
    expect(result.current.activeAlert?.status).toBe("breach");
    expect(onStatusChange).toHaveBeenCalledWith("breach", expect.anything());

    // Alerta sonoro de breach (tom descendente)
    const { mockCtx } = audioContextScope;
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("prioritizes CAR AREA_IMOVEL over other layers", () => {
    const { result } = renderHook(() =>
      useBoundaryGuard({
        currentPosition: { lat: -16.05, lng: -47.95 },
        features: [mockReservaLegalFeature, mockFarmFeature],
      })
    );

    // AREA_IMOVEL deve vir em primeiro lugar
    expect(result.current.nearestPolygonName).toBe("Fazenda Santa Helena");
  });

  it("allows toggling mute via hook return value", () => {
    const { result } = renderHook(() =>
      useBoundaryGuard({
        currentPosition: { lat: -16.05, lng: -47.95 },
        features: [mockFarmFeature],
      })
    );

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.setMuted(false);
    });

    expect(result.current.isMuted).toBe(false);
  });
});
