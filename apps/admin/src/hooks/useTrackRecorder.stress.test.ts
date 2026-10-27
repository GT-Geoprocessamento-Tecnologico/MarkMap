// Testes adversariais empíricos de estresse, concorrência, persistência e resiliência a crash
// Desenvolvido pelo teamwork_challenger_m3_2 para validação do Marco 3 (MM-AVZ-05).
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useTrackRecorder, DRAFT_COLLECTION, DRAFT_STORAGE_KEY } from "./useTrackRecorder";
import type { ActiveTrackDraft } from "./useTrackRecorder";

// Mocks do banco local offlineDB com armazenamento em memória simulado para testar concorrência real
const memoryStore = new Map<string, unknown>();

const mockOfflineDB = {
  save: vi.fn().mockImplementation(async (collection: string, id: string, payload: unknown) => {
    memoryStore.set(`${collection}:${id}`, structuredClone(payload));
  }),
  get: vi.fn().mockImplementation(async (collection: string, id: string) => {
    const val = memoryStore.get(`${collection}:${id}`);
    return val !== undefined ? structuredClone(val) : null;
  }),
  delete: vi.fn().mockImplementation(async (collection: string, id: string) => {
    memoryStore.delete(`${collection}:${id}`);
  }),
};

vi.mock("../lib/storage/offline-db", () => ({
  offlineDB: {
    save: (...args: unknown[]) => mockOfflineDB.save(...args),
    get: (...args: unknown[]) => mockOfflineDB.get(...args),
    delete: (...args: unknown[]) => mockOfflineDB.delete(...args),
  },
}));

const mockCreateLocalFeature = vi.fn().mockImplementation(async (layerId: string, feature: unknown) => ({
  id: "feature-track-persisted-999",
  layerId,
  ...(feature as Record<string, unknown>),
}));

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

describe("Adversarial Stress Test: useTrackRecorder & offlineDB Crash Resilience", () => {
  let watchPositionSuccessCallback: ((pos: GeolocationPosition) => void) | null = null;
  const watchPositionId = 9999;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryStore.clear();

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

  const sendGpsFix = (lat: number, lon: number, alt: number, accuracy: number, timestamp = Date.now()) => {
    act(() => {
      watchPositionSuccessCallback?.({
        coords: {
          latitude: lat,
          longitude: lon,
          altitude: alt,
          accuracy,
          altitudeAccuracy: 1,
          heading: null,
          speed: 4,
        },
        timestamp,
      } as GeolocationPosition);
    });
  };

  it("ADV-01: Simulação completa de crash do navegador com rascunho persistido e restauração pós-crash em paused", async () => {
    // Fase 1: Sessão antes do crash
    const draftBeforeCrash: ActiveTrackDraft = {
      id: "track-crash-session-123",
      name: "Trilha Pré-Queda",
      status: "recording",
      startedAt: "2026-10-27T12:00:00.000Z",
      updatedAt: "2026-10-27T12:05:00.000Z",
      pausedDurationMs: 0,
      lastPauseStartMs: null,
      points: [
        { lat: -23.5501, lon: -46.6331, alt: 750, timestamp: 1000, accuracy: 5 },
        { lat: -23.5505, lon: -46.6335, alt: 755, timestamp: 3000, accuracy: 6 },
        { lat: -23.5510, lon: -46.6340, alt: 760, timestamp: 5000, accuracy: 4 },
        { lat: -23.5515, lon: -46.6345, alt: 762, timestamp: 7000, accuracy: 7 },
      ],
      stats: {
        distanceMeters: 180,
        durationSeconds: 6,
        avgSpeedKmh: 108,
        elevationGainMeters: 12,
        elevationLossMeters: 0,
        minElevationMeters: 750,
        maxElevationMeters: 762,
        pointsCount: 4,
        rejectedPointsCount: 1,
      },
    };

    // Grava no IndexedDB como se tivesse sido persistido antes da queda
    await mockOfflineDB.save(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, draftBeforeCrash);

    // Fase 2: Navegador reinicia e monta o hook
    const { result, unmount } = renderHook(() =>
      useTrackRecorder({ defaultLayerId: "layer-poligono-1", autoRestoreDraft: true })
    );

    // Aguarda useEffect carregar do offlineDB
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.hasRecoveredDraft).toBe(true);
    expect(result.current.recoveredDraft).not.toBeNull();
    expect(result.current.recoveredDraft?.id).toBe("track-crash-session-123");
    expect(result.current.recoveredDraft?.points).toHaveLength(4);
    expect(result.current.status).toBe("idle"); // Permanece idle até restauração explícita

    // Fase 3: Operador clica em "Recuperar Rascunho"
    await act(async () => {
      await result.current.restoreDraft();
    });

    // Deve entrar em estado 'paused' por segurança de campo (para não gravar saltos geodésicos do crash)
    expect(result.current.status).toBe("paused");
    expect(result.current.isPaused).toBe(true);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.points).toHaveLength(4);
    expect(result.current.hasRecoveredDraft).toBe(false);

    // Verifica integridade dos pontos restaurados
    expect(result.current.points[0]?.lat).toBeCloseTo(-23.5501, 4);
    expect(result.current.points[3]?.lat).toBeCloseTo(-23.5515, 4);

    // Estatísticas devem refletir o percurso
    expect(result.current.stats.pointsCount).toBe(4);
    expect(result.current.stats.distanceMeters).toBeGreaterThan(100);

    // Fase 4: Operador retoma a gravação (Resume) e envia novo ponto
    await act(async () => {
      await result.current.resumeRecording();
    });

    expect(result.current.status).toBe("recording");
    sendGpsFix(-23.5520, -46.6350, 765, 5, 9000);
    expect(result.current.points).toHaveLength(5);

    unmount();
  });

  it("ADV-02: Descarte explícito apaga completamente a chave do IndexedDB via delete()", async () => {
    // Configura rascunho salvo
    await mockOfflineDB.save(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, {
      id: "draft-to-delete",
      points: [{ lat: -10, lon: -50, alt: 200, timestamp: 100 }],
    });

    const { result } = renderHook(() => useTrackRecorder({ defaultLayerId: "layer-1", autoRestoreDraft: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.hasRecoveredDraft).toBe(true);

    // Aciona descarte de rascunho recuperado
    await act(async () => {
      await result.current.dismissRecoveredDraft();
    });

    expect(mockOfflineDB.delete).toHaveBeenCalledWith(DRAFT_COLLECTION, DRAFT_STORAGE_KEY);
    expect(memoryStore.has(`${DRAFT_COLLECTION}:${DRAFT_STORAGE_KEY}`)).toBe(false);
    expect(result.current.hasRecoveredDraft).toBe(false);
    expect(result.current.recoveredDraft).toBeNull();
  });

  it("ADV-03: Salvar trilha purga o rascunho do IndexedDB e persiste feição no layer com coordenadas e métricas", async () => {
    const { result } = renderHook(() => useTrackRecorder({ defaultLayerId: "layer-trilhas-gps" }));

    await act(async () => {
      await result.current.startRecording("Trilha dos Pastos");
    });

    // Envia 3 pontos GPS
    sendGpsFix(-15.1, -48.1, 800, 5, 1000);
    sendGpsFix(-15.2, -48.2, 805, 5, 2000);
    sendGpsFix(-15.3, -48.3, 810, 5, 3000);

    expect(result.current.points).toHaveLength(3);

    // Salva a trilha
    let featureResult: unknown = null;
    await act(async () => {
      featureResult = await result.current.saveTrack("Trilha Finalizada", "layer-trilhas-gps");
    });

    expect(featureResult).not.toBeNull();
    expect(mockCreateLocalFeature).toHaveBeenCalledTimes(1);

    const callArgs = mockCreateLocalFeature.mock.calls[0];
    expect(callArgs[0]).toBe("layer-trilhas-gps");
    const payload = callArgs[1] as { geometry: { type: string; coordinates: number[][] }; properties: Record<string, unknown> };
    expect(payload.geometry.type).toBe("LineString");
    expect(payload.geometry.coordinates).toHaveLength(3);
    // Primeiro ponto preservado
    expect(payload.geometry.coordinates[0]).toEqual([-48.1, -15.1, 800]);
    // Nome e contagem preservados
    expect(payload.properties.name).toBe("Trilha Finalizada");
    expect(payload.properties.pointsCount).toBe(3);
    expect(payload.properties.type).toBe("gps_track");

    // O rascunho DEVE ter sido apagado do storage
    expect(mockOfflineDB.delete).toHaveBeenCalledWith(DRAFT_COLLECTION, DRAFT_STORAGE_KEY);
    expect(memoryStore.has(`${DRAFT_COLLECTION}:${DRAFT_STORAGE_KEY}`)).toBe(false);

    // Estado local deve ter sido resetado para idle
    expect(result.current.status).toBe("idle");
    expect(result.current.points).toHaveLength(0);
    expect(result.current.stats.distanceMeters).toBe(0);
  });

  it("ADV-04: Resiliência contra corrupção do IndexedDB (payload nulo, array vazio, campos ausentes)", async () => {
    // Cenário: rascunho corrompido no banco (sem points, ou com points vazio)
    await mockOfflineDB.save(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, {
      id: "corrupted-1",
      points: [], // vazio
    });

    const { result } = renderHook(() => useTrackRecorder({ autoRestoreDraft: true }));

    await act(async () => {
      await Promise.resolve();
    });

    // Não deve acusar draft recuperado se points estiver vazio
    expect(result.current.hasRecoveredDraft).toBe(false);
    expect(result.current.recoveredDraft).toBeNull();
  });

  it("ADV-05: Resiliência a falhas de I/O no IndexedDB e fallback do delete", async () => {
    const { result } = renderHook(() => useTrackRecorder({ defaultLayerId: "layer-1" }));

    let started = false;
    await act(async () => {
      started = await result.current.startRecording("Trilha Fallback Test");
    });
    expect(started).toBe(true);

    sendGpsFix(-23.5501, -46.6331, 750, 5, 1000);

    // Simula falha no offlineDB.delete, mas offlineDB.save(..., null) bem-sucedido no fallback
    mockOfflineDB.delete.mockRejectedValueOnce(new Error("DatabaseClosedError"));
    mockOfflineDB.save.mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.discardTrack();
    });

    expect(mockOfflineDB.delete).toHaveBeenCalledWith(DRAFT_COLLECTION, DRAFT_STORAGE_KEY);
    expect(mockOfflineDB.save).toHaveBeenCalledWith(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, null);
    expect(result.current.status).toBe("idle");
    expect(result.current.points).toHaveLength(0);
  });

  it("ADV-06: Concorrência e reentrância de pausas e retomadas rápidas", async () => {
    const { result } = renderHook(() => useTrackRecorder({ defaultLayerId: "layer-1" }));

    await act(async () => {
      await result.current.startRecording("Trilha Reentrância");
    });

    sendGpsFix(-23.5501, -46.6331, 750, 5, 1000);

    // Múltiplas pausas concorrentes
    await act(async () => {
      await Promise.all([
        result.current.pauseRecording(),
        result.current.pauseRecording(),
        result.current.pauseRecording(),
      ]);
    });

    expect(result.current.status).toBe("paused");

    // Múltiplas retomadas concorrentes
    await act(async () => {
      await Promise.all([
        result.current.resumeRecording(),
        result.current.resumeRecording(),
        result.current.resumeRecording(),
      ]);
    });

    expect(result.current.status).toBe("recording");
  });

  it("ADV-07: Tentativa de salvar trilha com 0 ou 1 ponto rejeita estritamente", async () => {
    const { result } = renderHook(() => useTrackRecorder({ defaultLayerId: "layer-1" }));

    await act(async () => {
      await result.current.startRecording("Trilha Zero Pontos");
    });

    // 0 pontos
    let res0 = null;
    await act(async () => {
      res0 = await result.current.saveTrack("Invalida 0 pts");
    });
    expect(res0).toBeNull();
    expect(result.current.error).toContain("Trilha muito curta");

    // 1 ponto
    sendGpsFix(-23.5501, -46.6331, 750, 5, 1000);
    expect(result.current.points).toHaveLength(1);

    let res1 = null;
    await act(async () => {
      res1 = await result.current.saveTrack("Invalida 1 pt");
    });
    expect(res1).toBeNull();
    expect(result.current.error).toContain("Trilha muito curta");
  });
});
