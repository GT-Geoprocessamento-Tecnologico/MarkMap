// Desenvolvido por MtsFerreira. Hook de gravação contínua de trilhas GNSS (MM-AVZ-05).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  TrackRecorder,
  type RawPoint,
  type SmoothedPoint,
  type TrackStats,
  type TrackRecorderStatus,
} from "@markmap/maps";
import type { Feature, LineString } from "@markmap/contracts";
import { ensureLocationPermission } from "../lib/device-location-permission";
import { rememberLocationApproval } from "../lib/location-consent";
import { offlineDB } from "../lib/storage/offline-db";
import { createLocalFeature } from "../lib/hooks/features";
import { queryKeys } from "../lib/query-keys";

export const DRAFT_COLLECTION = "telemetry";
export const DRAFT_STORAGE_KEY = "active_track";
export const DEFAULT_ACCURACY_THRESHOLD_M = 15;
export const DRAFT_FLUSH_INTERVAL_MS = 4000;

export interface ActiveTrackDraft {
  id: string;
  name: string;
  status: "recording" | "paused";
  startedAt: string;
  updatedAt: string;
  pausedDurationMs: number;
  lastPauseStartMs: number | null;
  points: Array<{
    lat: number;
    lon: number;
    alt: number;
    timestamp: number;
    accuracy?: number;
  }>;
  stats: {
    distanceMeters: number;
    durationSeconds: number;
    avgSpeedKmh: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    minElevationMeters: number | null;
    maxElevationMeters: number | null;
    pointsCount: number;
    rejectedPointsCount: number;
  };
}

export interface UseTrackRecorderOptions {
  projectId?: string;
  defaultLayerId?: string;
  accuracyThresholdMeters?: number;
  autoRestoreDraft?: boolean;
  onPointAdded?: (point: SmoothedPoint) => void;
  onError?: (error: string) => void;
}

const initialStats: TrackStats = {
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

export interface UseTrackRecorderReturn {
  status: TrackRecorderStatus;
  isRecording: boolean;
  isPaused: boolean;
  isIdle: boolean;

  stats: TrackStats;
  points: SmoothedPoint[];
  currentFix: RawPoint | null;
  gpsAccuracy: number | null;
  isGpsDegraded: boolean;

  liveGeoJson: GeoJSON.Feature<GeoJSON.LineString> | null;

  hasRecoveredDraft: boolean;
  recoveredDraft: ActiveTrackDraft | null;

  error: string | null;
  clearError: () => void;

  startRecording: (name?: string) => Promise<boolean>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  saveTrack: (name: string, targetLayerId?: string) => Promise<Feature | null>;
  discardTrack: () => Promise<void>;
  restoreDraft: () => Promise<void>;
  dismissRecoveredDraft: () => Promise<void>;

  // Aliases de conveniência
  start: (name?: string) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  save: (name: string, targetLayerId?: string) => Promise<Feature | null>;
  discard: () => Promise<void>;
  currentAccuracyMeters: number | null;
  currentSpeedKmh: number;
  currentElevationMeters: number | null;
  hasDraft: boolean;
}

export function useTrackRecorder(
  options: UseTrackRecorderOptions = {},
): UseTrackRecorderReturn {
  const {
    defaultLayerId,
    accuracyThresholdMeters = DEFAULT_ACCURACY_THRESHOLD_M,
    autoRestoreDraft = true,
    onPointAdded,
    onError,
  } = options;

  const queryClient = useQueryClient();

  const recorderRef = useRef<TrackRecorder>(new TrackRecorder());
  const [status, setStatus] = useState<TrackRecorderStatus>("idle");
  const [stats, setStats] = useState<TrackStats>(initialStats);
  const [points, setPoints] = useState<SmoothedPoint[]>([]);
  const [currentFix, setCurrentFix] = useState<RawPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isGpsDegraded, setIsGpsDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState<ActiveTrackDraft | null>(
    null,
  );

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const rejectedCountRef = useRef(0);
  const draftMetaRef = useRef<{ id: string; name: string; startedAt: string }>({
    id: "",
    name: "",
    startedAt: "",
  });

  const clearError = useCallback(() => setError(null), []);

  const reportError = useCallback(
    (msg: string) => {
      setError(msg);
      onError?.(msg);
    },
    [onError],
  );

  // Solicita wake lock do navegador se disponível
  const acquireWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      // Ignora erro silenciosamente caso a aba não esteja visível
    }
  }, []);

  // Libera o wake lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignora
      }
      wakeLockRef.current = null;
    }
  }, []);

  // Salva rascunho Nível 1 no IndexedDB
  const flushDraftImmediate = useCallback(async () => {
    if (status === "idle" && points.length === 0) return;

    try {
      const currentStats = recorderRef.current.getStats();
      const draft: ActiveTrackDraft = {
        id: draftMetaRef.current.id || `track-${Date.now()}`,
        name:
          draftMetaRef.current.name ||
          `Trilha ${new Date().toLocaleDateString("pt-BR")}`,
        status: status === "recording" ? "recording" : "paused",
        startedAt: draftMetaRef.current.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pausedDurationMs: 0,
        lastPauseStartMs: status === "paused" ? Date.now() : null,
        points: recorderRef.current.getTrack().map((p) => ({
          lat: p.lat,
          lon: p.lon,
          alt: p.alt,
          timestamp: p.timestamp,
          accuracy: p.accuracy,
        })),
        stats: {
          distanceMeters: currentStats.distanceMeters,
          durationSeconds: currentStats.durationSeconds,
          avgSpeedKmh: currentStats.avgSpeedKmh,
          elevationGainMeters: currentStats.elevationGainMeters,
          elevationLossMeters: currentStats.elevationLossMeters,
          minElevationMeters: currentStats.minElevationMeters,
          maxElevationMeters: currentStats.maxElevationMeters,
          pointsCount: currentStats.pointsCount,
          rejectedPointsCount: rejectedCountRef.current,
        },
      };

      await offlineDB.save(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, draft);
      isDirtyRef.current = false;
    } catch (err) {
      // Falha de auto-save local não deve quebrar a execução
      console.warn("Falha no auto-save de rascunho da trilha:", err);
    }
  }, [points.length, status]);

  // Agenda flush com debounce de 4 segundos
  const scheduleDraftFlush = useCallback(() => {
    isDirtyRef.current = true;
    if (flushTimerRef.current) return;

    flushTimerRef.current = setTimeout(async () => {
      flushTimerRef.current = null;
      if (isDirtyRef.current) {
        await flushDraftImmediate();
      }
    }, DRAFT_FLUSH_INTERVAL_MS);
  }, [flushDraftImmediate]);

  // Limpa watcher do GPS
  const stopGpsWatcher = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    void releaseWakeLock();
  }, [releaseWakeLock]);

  // Inicia watcher do GPS
  const startGpsWatcher = useCallback(() => {
    if (watchIdRef.current !== null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reportError("Geolocalização não disponível no dispositivo.");
      return;
    }

    void acquireWakeLock();

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, altitude, accuracy } = pos.coords;
        const now = pos.timestamp || Date.now();

        const raw: RawPoint = {
          lat: latitude,
          lon: longitude,
          alt:
            typeof altitude === "number" && Number.isFinite(altitude)
              ? altitude
              : 0,
          timestamp: now,
          accuracy:
            typeof accuracy === "number" && Number.isFinite(accuracy)
              ? accuracy
              : undefined,
        };

        setCurrentFix(raw);
        setGpsAccuracy(
          typeof accuracy === "number" && Number.isFinite(accuracy)
            ? accuracy
            : null,
        );

        // Filtro estrito de acurácia > 15m
        if (
          typeof accuracy === "number" &&
          accuracy > accuracyThresholdMeters
        ) {
          setIsGpsDegraded(true);
          rejectedCountRef.current += 1;
          return;
        }

        setIsGpsDegraded(false);

        // Se estiver em estado ativo de gravação, adiciona amostra ao motor
        if (recorderRef.current.getStatus() === "recording") {
          const smoothed = recorderRef.current.addPoint(raw);
          if (smoothed && smoothed.filtered) {
            setPoints(recorderRef.current.getTrack());
            setStats(recorderRef.current.getStats());
            scheduleDraftFlush();
            onPointAdded?.(smoothed);
          }
        }
      },
      (err) => {
        setIsGpsDegraded(true);
        if (err.code === err.PERMISSION_DENIED) {
          reportError("Permissão de GPS negada pelo usuário.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  }, [
    accuracyThresholdMeters,
    acquireWakeLock,
    onPointAdded,
    reportError,
    scheduleDraftFlush,
  ]);

  // Inicia a gravação (Start)
  const startRecording = useCallback(
    async (trackName?: string): Promise<boolean> => {
      try {
        const perm = await ensureLocationPermission();
        if (perm.state !== "granted") {
          reportError(
            "Acesso à localização do dispositivo é necessário para gravar a trilha.",
          );
          return false;
        }

        await rememberLocationApproval();

        const now = Date.now();
        const id = crypto.randomUUID ? crypto.randomUUID() : `track-${now}`;
        const name =
          trackName?.trim() ||
          `Trilha ${new Date(now).toLocaleDateString("pt-BR")}`;

        draftMetaRef.current = {
          id,
          name,
          startedAt: new Date(now).toISOString(),
        };
        rejectedCountRef.current = 0;

        recorderRef.current = new TrackRecorder({
          id,
          name,
          startTime: now,
        });

        recorderRef.current.start(now);
        setStatus("recording");
        setStats(recorderRef.current.getStats(now));
        setPoints([]);
        clearError();

        startGpsWatcher();
        await flushDraftImmediate();
        return true;
      } catch (err) {
        reportError(
          err instanceof Error
            ? err.message
            : "Erro ao iniciar gravação de trilha.",
        );
        return false;
      }
    },
    [clearError, flushDraftImmediate, reportError, startGpsWatcher],
  );

  // Pausa a gravação (Pause)
  const pauseRecording = useCallback(async () => {
    if (status !== "recording") return;
    const now = Date.now();
    recorderRef.current.pause(now);
    setStatus("paused");
    setStats(recorderRef.current.getStats(now));
    await flushDraftImmediate();
  }, [flushDraftImmediate, status]);

  // Retoma a gravação (Resume)
  const resumeRecording = useCallback(async () => {
    if (status !== "paused") return;
    const now = Date.now();
    recorderRef.current.resume(now);
    setStatus("recording");
    setStats(recorderRef.current.getStats(now));
    startGpsWatcher();
    await flushDraftImmediate();
  }, [flushDraftImmediate, startGpsWatcher, status]);

  // Salva a trilha na camada vetorial (Nível 2)
  const saveTrack = useCallback(
    async (name: string, targetLayerId?: string): Promise<Feature | null> => {
      const currentTrack = recorderRef.current.getTrack();
      if (currentTrack.length < 2) {
        reportError(
          "Trilha muito curta: são necessários pelo menos 2 pontos GPS válidos para salvar uma linha.",
        );
        return null;
      }

      const layerId = targetLayerId ?? defaultLayerId;
      if (!layerId) {
        reportError(
          "Nenhuma camada de destino compatível foi selecionada para salvar a trilha.",
        );
        return null;
      }

      try {
        const currentStats = recorderRef.current.getStats();
        recorderRef.current.stop();

        const geometry: LineString = {
          type: "LineString",
          coordinates: currentTrack.map((p) =>
            p.alt !== undefined && Number.isFinite(p.alt)
              ? [p.lon, p.lat, Math.round(p.alt * 10) / 10]
              : [p.lon, p.lat],
          ),
        };

        const properties = {
          name:
            name.trim() ||
            draftMetaRef.current.name ||
            `Trilha ${new Date().toLocaleDateString("pt-BR")}`,
          type: "gps_track",
          source: "markmap-gnss-logger",
          recordedAt:
            draftMetaRef.current.startedAt || new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          distanceMeters: Math.round(currentStats.distanceMeters * 10) / 10,
          distanceKm: Number((currentStats.distanceMeters / 1000).toFixed(2)),
          durationSeconds: Math.round(currentStats.durationSeconds),
          avgSpeedKmh: Number(currentStats.avgSpeedKmh.toFixed(1)),
          elevationGainMeters:
            Math.round(currentStats.elevationGainMeters * 10) / 10,
          pointsCount: currentStats.pointsCount,
          rejectedPointsCount: rejectedCountRef.current,
        };

        const feature = await createLocalFeature(layerId, {
          geometry,
          properties,
        });

        // Invalida cache React Query da camada
        await queryClient.invalidateQueries({
          queryKey: queryKeys.featuresByLayer(layerId),
        });

        // Remove rascunho Nível 1 do IndexedDB
        try {
          await offlineDB.delete(DRAFT_COLLECTION, DRAFT_STORAGE_KEY);
        } catch {
          await offlineDB.save(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, null);
        }

        // Reseta estado local
        stopGpsWatcher();
        recorderRef.current.clear();
        setStatus("idle");
        setStats(initialStats);
        setPoints([]);
        setHasRecoveredDraft(false);
        setRecoveredDraft(null);

        return feature;
      } catch (err) {
        reportError(
          err instanceof Error
            ? err.message
            : "Erro ao salvar trilha na camada.",
        );
        return null;
      }
    },
    [defaultLayerId, queryClient, reportError, stopGpsWatcher],
  );

  // Descarta a trilha atual
  const discardTrack = useCallback(async () => {
    stopGpsWatcher();
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    isDirtyRef.current = false;

    try {
      await offlineDB.delete(DRAFT_COLLECTION, DRAFT_STORAGE_KEY);
    } catch {
      await offlineDB.save(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, null);
    }

    recorderRef.current.clear();
    setStatus("idle");
    setStats(initialStats);
    setPoints([]);
    setHasRecoveredDraft(false);
    setRecoveredDraft(null);
  }, [stopGpsWatcher]);

  // Restaura o rascunho recuperado
  const restoreDraft = useCallback(async () => {
    if (
      !recoveredDraft ||
      !recoveredDraft.points ||
      recoveredDraft.points.length === 0
    )
      return;

    try {
      const rec = new TrackRecorder({
        id: recoveredDraft.id,
        name: recoveredDraft.name,
        startTime: new Date(recoveredDraft.startedAt).getTime() || Date.now(),
      });

      rec.start(new Date(recoveredDraft.startedAt).getTime() || Date.now());

      for (const p of recoveredDraft.points) {
        rec.addPoint(p);
      }

      rec.pause(Date.now());

      recorderRef.current = rec;
      draftMetaRef.current = {
        id: recoveredDraft.id,
        name: recoveredDraft.name,
        startedAt: recoveredDraft.startedAt,
      };

      setStatus("paused");
      setPoints(rec.getTrack());
      setStats(rec.getStats());
      setHasRecoveredDraft(false);
    } catch (err) {
      reportError("Falha ao restaurar rascunho de trilha anterior.");
    }
  }, [recoveredDraft, reportError]);

  // Descarta o rascunho recuperado sem carregar
  const dismissRecoveredDraft = useCallback(async () => {
    try {
      await offlineDB.delete(DRAFT_COLLECTION, DRAFT_STORAGE_KEY);
    } catch {
      await offlineDB.save(DRAFT_COLLECTION, DRAFT_STORAGE_KEY, null);
    }
    setHasRecoveredDraft(false);
    setRecoveredDraft(null);
  }, []);

  // Inicialização e Detecção de Crash / Rascunho existente
  useEffect(() => {
    if (!autoRestoreDraft) return;

    let isMounted = true;
    (async () => {
      try {
        const saved = (await offlineDB.get(
          DRAFT_COLLECTION,
          DRAFT_STORAGE_KEY,
        )) as ActiveTrackDraft | null;
        if (isMounted && saved && saved.points && saved.points.length > 0) {
          setRecoveredDraft(saved);
          setHasRecoveredDraft(true);
        }
      } catch {
        // Falha silenciosa de leitura inicial
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [autoRestoreDraft]);

  // Listener para salvamento emergencial antes de fechar a aba
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        void flushDraftImmediate();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isDirtyRef.current) {
        void flushDraftImmediate();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopGpsWatcher();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [flushDraftImmediate, stopGpsWatcher]);

  // Feature GeoJSON em tempo real para desenhar no MapLibre
  const liveGeoJson =
    useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
      if (points.length < 2) return null;
      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: points.map((p) =>
            p.alt !== undefined && Number.isFinite(p.alt)
              ? [p.lon, p.lat, p.alt]
              : [p.lon, p.lat],
          ),
        },
        properties: {
          status,
          distanceMeters: stats.distanceMeters,
          durationSeconds: stats.durationSeconds,
        },
      };
    }, [points, stats.distanceMeters, stats.durationSeconds, status]);

  const currentSpeedKmh = useMemo(() => {
    if (currentFix?.timestamp && points.length > 0) {
      return stats.avgSpeedKmh;
    }
    return 0;
  }, [currentFix?.timestamp, points.length, stats.avgSpeedKmh]);

  return {
    status,
    isRecording: status === "recording",
    isPaused: status === "paused",
    isIdle: status === "idle",

    stats,
    points,
    currentFix,
    gpsAccuracy,
    isGpsDegraded,

    liveGeoJson,

    hasRecoveredDraft,
    recoveredDraft,

    error,
    clearError,

    startRecording,
    pauseRecording,
    resumeRecording,
    saveTrack,
    discardTrack,
    restoreDraft,
    dismissRecoveredDraft,

    // Aliases
    start: startRecording,
    pause: pauseRecording,
    resume: resumeRecording,
    save: saveTrack,
    discard: discardTrack,
    currentAccuracyMeters: gpsAccuracy,
    currentSpeedKmh,
    currentElevationMeters: currentFix?.alt ?? null,
    hasDraft: hasRecoveredDraft,
  };
}
