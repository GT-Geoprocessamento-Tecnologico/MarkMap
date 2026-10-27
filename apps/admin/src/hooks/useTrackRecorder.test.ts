import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  useTrackRecorder,
  DRAFT_COLLECTION,
  DRAFT_STORAGE_KEY,
} from "./useTrackRecorder";

// Mocks
const mockOfflineDB = {
  save: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../lib/storage/offline-db", () => ({
  offlineDB: {
    save: (...args: unknown[]) => mockOfflineDB.save(...args),
    get: (...args: unknown[]) => mockOfflineDB.get(...args),
    delete: (...args: unknown[]) => mockOfflineDB.delete(...args),
  },
}));

const mockCreateLocalFeature = vi.fn().mockResolvedValue({
  id: "feature-track-01",
  layerId: "layer-01",
  geometry: { type: "LineString", coordinates: [] },
  properties: {},
});

vi.mock("../lib/hooks/features", () => ({
  createLocalFeature: (...args: unknown[]) => mockCreateLocalFeature(...args),
}));

vi.mock("../lib/device-location-permission", () => ({
  ensureLocationPermission: vi.fn().mockResolvedValue({ state: "granted" }),
}));

vi.mock("../lib/location-consent", () => ({
  rememberLocationApproval: vi.fn().mockResolvedValue(undefined),
}));

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

describe("useTrackRecorder", () => {
  let watchPositionSuccessCallback:
    ((pos: GeolocationPosition) => void) | null = null;
  const watchPositionId = 123;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOfflineDB.get.mockResolvedValue(null);

    // Mock do navigator.geolocation
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: vi.fn().mockImplementation((success) => {
          watchPositionSuccessCallback = success;
          return watchPositionId;
        }),
        clearWatch: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    watchPositionSuccessCallback = null;
  });

  const sendGpsFix = (
    lat: number,
    lon: number,
    alt: number,
    accuracy: number,
    timestamp = Date.now(),
  ) => {
    act(() => {
      watchPositionSuccessCallback?.({
        coords: {
          latitude: lat,
          longitude: lon,
          altitude: alt,
          accuracy,
          altitudeAccuracy: 1,
          heading: null,
          speed: 5,
        },
        timestamp,
      } as GeolocationPosition);
    });
  };

  it("inicia em estado 'idle' com valores zerados", () => {
    const { result } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-1" }),
    );

    expect(result.current.status).toBe("idle");
    expect(result.current.isIdle).toBe(true);
    expect(result.current.points).toHaveLength(0);
    expect(result.current.stats.distanceMeters).toBe(0);
  });

  it("inicia gravação ao chamar startRecording e captura pontos GPS com acurácia válida", async () => {
    const { result } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-1" }),
    );

    let started = false;
    await act(async () => {
      started = await result.current.startRecording("Trilha do Piquete");
    });

    expect(started).toBe(true);
    expect(result.current.status).toBe("recording");
    expect(result.current.isRecording).toBe(true);

    // Envia primeiro ponto GPS (acurácia 6m <= 15m)
    sendGpsFix(-23.5501, -46.6331, 750, 6, 1000);

    expect(result.current.points).toHaveLength(1);
    expect(result.current.gpsAccuracy).toBe(6);
    expect(result.current.isGpsDegraded).toBe(false);

    // Envia segundo ponto GPS (acurácia 8m)
    sendGpsFix(-23.5505, -46.6335, 755, 8, 3000);

    expect(result.current.points).toHaveLength(2);
    expect(result.current.stats.distanceMeters).toBeGreaterThan(0);
  });

  it("descarta amostras de GPS com acurácia degradada (> 15m)", async () => {
    const { result } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-1" }),
    );

    await act(async () => {
      await result.current.startRecording("Trilha Ruído");
    });

    // Ponto válido (10m)
    sendGpsFix(-23.5501, -46.6331, 750, 10, 1000);
    expect(result.current.points).toHaveLength(1);

    // Ponto degradado (25m > 15m) -> deve ser descartado
    sendGpsFix(-23.551, -46.634, 760, 25, 2000);

    expect(result.current.points).toHaveLength(1);
    expect(result.current.isGpsDegraded).toBe(true);
    expect(result.current.gpsAccuracy).toBe(25);
  });

  it("pausa e retoma a gravação", async () => {
    const { result } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-1" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    sendGpsFix(-23.5501, -46.6331, 750, 5, 1000);

    await act(async () => {
      await result.current.pauseRecording();
    });

    expect(result.current.status).toBe("paused");
    expect(result.current.isPaused).toBe(true);

    // Ponto emitido durante pausa não deve ser adicionado ao track
    sendGpsFix(-23.5505, -46.6335, 755, 5, 3000);
    expect(result.current.points).toHaveLength(1);

    await act(async () => {
      await result.current.resumeRecording();
    });

    expect(result.current.status).toBe("recording");
    expect(result.current.isRecording).toBe(true);

    // Ponto após retorno deve ser gravado
    sendGpsFix(-23.5506, -46.6336, 756, 5, 5000);
    expect(result.current.points).toHaveLength(2);
  });

  it("recusa salvar trilha com menos de 2 pontos válidos", async () => {
    const { result } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-1" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    sendGpsFix(-23.5501, -46.6331, 750, 5, 1000);

    let saved = null;
    await act(async () => {
      saved = await result.current.saveTrack("Trilha Curta");
    });

    expect(saved).toBeNull();
    expect(result.current.error).toContain("Trilha muito curta");
    expect(mockCreateLocalFeature).not.toHaveBeenCalled();
  });

  it("salva a trilha com sucesso quando há pelo menos 2 pontos e remove o rascunho", async () => {
    const { result } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-1" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    sendGpsFix(-23.5501, -46.6331, 750, 5, 1000);
    sendGpsFix(-23.5505, -46.6335, 755, 5, 3000);

    let savedFeature = null;
    await act(async () => {
      savedFeature = await result.current.saveTrack(
        "Minha Trilha Completa",
        "layer-dest",
      );
    });

    expect(savedFeature).not.toBeNull();
    expect(mockCreateLocalFeature).toHaveBeenCalledWith(
      "layer-dest",
      expect.objectContaining({
        geometry: expect.objectContaining({ type: "LineString" }),
        properties: expect.objectContaining({ name: "Minha Trilha Completa" }),
      }),
    );

    expect(mockOfflineDB.delete).toHaveBeenCalledWith(
      DRAFT_COLLECTION,
      DRAFT_STORAGE_KEY,
    );
    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.points).toHaveLength(0);
  });

  it("descarta a trilha e limpa o armazenamento local ao chamar discardTrack", async () => {
    const { result } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-1" }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    sendGpsFix(-23.5501, -46.6331, 750, 5, 1000);

    await act(async () => {
      await result.current.discardTrack();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.points).toHaveLength(0);
    expect(mockOfflineDB.delete).toHaveBeenCalledWith(
      DRAFT_COLLECTION,
      DRAFT_STORAGE_KEY,
    );
  });

  it("detecta e restaura rascunho recuperado após reload/crash", async () => {
    const mockDraft = {
      id: "trk-crash-1",
      name: "Trilha Pré-Crash",
      status: "recording" as const,
      startedAt: "2026-10-27T10:00:00Z",
      updatedAt: "2026-10-27T10:05:00Z",
      pausedDurationMs: 0,
      lastPauseStartMs: null,
      points: [
        {
          lat: -23.5501,
          lon: -46.6331,
          alt: 750,
          timestamp: 1000,
          accuracy: 5,
        },
        {
          lat: -23.5505,
          lon: -46.6335,
          alt: 755,
          timestamp: 3000,
          accuracy: 5,
        },
      ],
      stats: {
        distanceMeters: 60,
        durationSeconds: 2,
        avgSpeedKmh: 108,
        elevationGainMeters: 5,
        elevationLossMeters: 0,
        minElevationMeters: 750,
        maxElevationMeters: 755,
        pointsCount: 2,
        rejectedPointsCount: 0,
      },
    };

    mockOfflineDB.get.mockResolvedValueOnce(mockDraft);

    const { result } = renderHook(() =>
      useTrackRecorder({ autoRestoreDraft: true }),
    );

    // Aguarda promise do useEffect
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.hasRecoveredDraft).toBe(true);
    expect(result.current.recoveredDraft?.id).toBe("trk-crash-1");

    // Restaura o rascunho
    await act(async () => {
      await result.current.restoreDraft();
    });

    expect(result.current.status).toBe("paused");
    expect(result.current.points).toHaveLength(2);
    expect(result.current.hasRecoveredDraft).toBe(false);
  });
});
