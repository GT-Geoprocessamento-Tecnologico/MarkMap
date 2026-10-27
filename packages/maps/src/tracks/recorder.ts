import { geodesicDistanceM } from "@markmap/geo";
import type { MarkMapFeature, GeoJsonPosition, GeoJsonLineString } from "@markmap/geo";
import { TrackKalmanEngine, type RawPoint, type SmoothedPoint } from "./kalman.js";

export type TrackRecorderStatus = "idle" | "recording" | "paused" | "stopped";

export interface TrackMetadata {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
}

export interface ElevationPoint {
  distanceMeters: number;
  elevation: number;
  timestamp: number;
}

export interface TrackStats {
  status: TrackRecorderStatus;
  pointsCount: number;
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  avgSpeedMs: number;
  avgSpeedKmh: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
}

export interface TrackRecorderOptions {
  /** Acurácia máxima aceitável em metros. Amostras com acurácia maior são descartadas. Padrão: 15. */
  maxAccuracyMeters?: number;
  /** Limiar mínimo de elevação em metros para histerese. Padrão: 0. */
  minElevationDeltaMeters?: number;
  /** Ruído de processo do filtro de Kalman para coordenadas (graus). Padrão: 0.001. */
  processNoise?: number;
  /** Ruído de medição do filtro de Kalman para coordenadas (graus). Padrão: 0.00001. */
  measurementNoise?: number;
  /** Ruído de processo do filtro de Kalman para altitude (metros). Padrão: 10. */
  altProcessNoise?: number;
  /** Ruído de medição do filtro de Kalman para altitude (metros). Padrão: 0.01. */
  altMeasurementNoise?: number;
}

export class TrackRecorder {
  private engine: TrackKalmanEngine;
  private metadata: TrackMetadata;
  private options: Required<Pick<TrackRecorderOptions, "maxAccuracyMeters" | "minElevationDeltaMeters">>;
  private status: TrackRecorderStatus = "idle";

  private accumulatedActiveDurationMs = 0;
  private currentIntervalStartMs: number | null = null;

  private distanceMeters = 0;
  private elevationGainMeters = 0;
  private elevationLossMeters = 0;
  private minElevationMeters: number | null = null;
  private maxElevationMeters: number | null = null;

  private lastSmoothedPoint: SmoothedPoint | null = null;
  private elevationProfile: ElevationPoint[] = [];

  constructor(metadata?: Partial<TrackMetadata>, options?: TrackRecorderOptions) {
    const defaultStartTime = Date.now();
    this.metadata = {
      id: metadata?.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `track-${defaultStartTime}`),
      name: metadata?.name ?? `Trilha ${new Date(defaultStartTime).toLocaleDateString("pt-BR")}`,
      startTime: metadata?.startTime ?? defaultStartTime,
      ...(metadata?.endTime !== undefined ? { endTime: metadata.endTime } : {}),
    };

    this.options = {
      maxAccuracyMeters: options?.maxAccuracyMeters ?? 15,
      minElevationDeltaMeters: options?.minElevationDeltaMeters ?? 0,
    };

    this.engine = new TrackKalmanEngine(
      options?.processNoise ?? 0.001,
      options?.measurementNoise ?? 0.00001,
      options?.altProcessNoise ?? 100,
      options?.altMeasurementNoise ?? 0.001
    );
  }

  /** Inicia a gravação da trilha. */
  start(timestamp?: number): void {
    if (this.status === "recording") return;

    const now = timestamp ?? Date.now();

    if (this.status === "idle" || this.status === "stopped") {
      this.clear();
      this.metadata.startTime = now;
      this.accumulatedActiveDurationMs = 0;
    }

    this.currentIntervalStartMs = now;
    this.status = "recording";
  }

  /** Pausa a gravação da trilha. Congela a contagem de tempo ativo. */
  pause(timestamp?: number): void {
    if (this.status !== "recording") return;

    const now = timestamp ?? Date.now();
    if (this.currentIntervalStartMs !== null) {
      this.accumulatedActiveDurationMs += Math.max(0, now - this.currentIntervalStartMs);
      this.currentIntervalStartMs = null;
    }

    this.status = "paused";
  }

  /** Retoma a gravação da trilha a partir da pausa. */
  resume(timestamp?: number): void {
    if (this.status !== "paused") return;

    const now = timestamp ?? Date.now();
    this.currentIntervalStartMs = now;
    this.status = "recording";
  }

  /** Finaliza a gravação da trilha e retorna os pontos suavizados acumulados. */
  stop(timestamp?: number): SmoothedPoint[] {
    const now = timestamp ?? Date.now();

    if (this.status === "recording" && this.currentIntervalStartMs !== null) {
      this.accumulatedActiveDurationMs += Math.max(0, now - this.currentIntervalStartMs);
      this.currentIntervalStartMs = null;
    }

    this.metadata.endTime = now;
    this.status = "stopped";
    return this.getTrack();
  }

  /** Limpa o histórico de pontos, filtros de Kalman e reinicia as estatísticas para estado 'idle'. */
  clear(): void {
    this.status = "idle";
    this.accumulatedActiveDurationMs = 0;
    this.currentIntervalStartMs = null;
    this.distanceMeters = 0;
    this.elevationGainMeters = 0;
    this.elevationLossMeters = 0;
    this.minElevationMeters = null;
    this.maxElevationMeters = null;
    this.lastSmoothedPoint = null;
    this.elevationProfile = [];
    this.engine.clear();
  }

  /** Retorna o status atual do gravador. */
  getStatus(): TrackRecorderStatus {
    return this.status;
  }

  /**
   * Submete uma amostra bruta de GPS ao gravador.
   * Descarta estritamente amostras se o status não for 'recording' ou se accuracy > maxAccuracyMeters (15m).
   */
  addPoint(point: RawPoint): SmoothedPoint | null {
    if (this.status !== "recording") {
      return null;
    }

    // Filtro de acurácia GPS: descarte estrito > 15m ou valores inválidos
    if (
      point.accuracy !== undefined &&
      (typeof point.accuracy !== "number" ||
        !Number.isFinite(point.accuracy) ||
        point.accuracy < 0 ||
        point.accuracy > this.options.maxAccuracyMeters)
    ) {
      return null;
    }

    // Validação de coordenadas geográficas
    if (
      typeof point.lat !== "number" ||
      typeof point.lon !== "number" ||
      !Number.isFinite(point.lat) ||
      !Number.isFinite(point.lon) ||
      point.lat < -90 ||
      point.lat > 90 ||
      point.lon < -180 ||
      point.lon > 180
    ) {
      return null;
    }

    const smoothed = this.engine.processPoint(point);

    if (smoothed.filtered) {
      if (this.lastSmoothedPoint) {
        // Cálculo geodésico Haversine via @markmap/geo
        const segmentDist = geodesicDistanceM(
          { latitude: this.lastSmoothedPoint.lat, longitude: this.lastSmoothedPoint.lon },
          { latitude: smoothed.lat, longitude: smoothed.lon }
        );

        if (Number.isFinite(segmentDist) && segmentDist > 0) {
          this.distanceMeters += segmentDist;
        }

        // Elevação e ganhos/perdas
        if (typeof smoothed.alt === "number" && Number.isFinite(smoothed.alt)) {
          if (this.minElevationMeters === null || smoothed.alt < this.minElevationMeters) {
            this.minElevationMeters = smoothed.alt;
          }
          if (this.maxElevationMeters === null || smoothed.alt > this.maxElevationMeters) {
            this.maxElevationMeters = smoothed.alt;
          }

          if (typeof this.lastSmoothedPoint.alt === "number" && Number.isFinite(this.lastSmoothedPoint.alt)) {
            const deltaAlt = smoothed.alt - this.lastSmoothedPoint.alt;
            if (deltaAlt > this.options.minElevationDeltaMeters) {
              this.elevationGainMeters += deltaAlt;
            } else if (deltaAlt < -this.options.minElevationDeltaMeters) {
              this.elevationLossMeters += Math.abs(deltaAlt);
            }
          }
        }
      } else {
        // Primeiro ponto válido
        if (typeof smoothed.alt === "number" && Number.isFinite(smoothed.alt)) {
          this.minElevationMeters = smoothed.alt;
          this.maxElevationMeters = smoothed.alt;
        }
      }

      this.lastSmoothedPoint = smoothed;
      this.elevationProfile.push({
        distanceMeters: this.distanceMeters,
        elevation: smoothed.alt ?? 0,
        timestamp: smoothed.timestamp,
      });
    }

    return smoothed;
  }

  /** Retorna uma cópia dos pontos suavizados da trilha até o momento. */
  getTrack(): SmoothedPoint[] {
    return this.engine.getTrack();
  }

  /** Retorna as métricas e estatísticas consolidadas da trilha em tempo real. */
  getStats(currentTimestamp?: number): TrackStats {
    let activeDurationMs = this.accumulatedActiveDurationMs;

    if (this.status === "recording" && this.currentIntervalStartMs !== null) {
      const now = currentTimestamp ?? Date.now();
      activeDurationMs += Math.max(0, now - this.currentIntervalStartMs);
    }

    const durationSeconds = activeDurationMs / 1000;
    const distanceKm = this.distanceMeters / 1000;

    const avgSpeedMs =
      durationSeconds > 0 && this.distanceMeters > 0 ? this.distanceMeters / durationSeconds : 0;
    const avgSpeedKmh = avgSpeedMs * 3.6;

    const track = this.getTrack();

    return {
      status: this.status,
      pointsCount: track.length,
      distanceMeters: this.distanceMeters,
      distanceKm,
      durationSeconds,
      avgSpeedMs,
      avgSpeedKmh,
      elevationGainMeters: this.elevationGainMeters,
      elevationLossMeters: this.elevationLossMeters,
      minElevationMeters: this.minElevationMeters,
      maxElevationMeters: this.maxElevationMeters,
    };
  }

  /** Retorna o perfil altimétrico da trilha (distância x altitude x timestamp). */
  getElevationProfile(): ElevationPoint[] {
    return this.elevationProfile.map((p) => ({ ...p }));
  }

  /** Exporta a trilha como uma feição LineString compatível com @markmap/geo e RFC 7946. */
  toGeoJSON(): MarkMapFeature & { geometry: GeoJsonLineString } {
    const track = this.getTrack();
    const stats = this.getStats();
    let coordinates: GeoJsonPosition[] = [];

    if (track.length === 1) {
      const p = track[0]!;
      const pos: GeoJsonPosition =
        p.alt !== undefined && Number.isFinite(p.alt)
          ? [p.lon, p.lat, p.alt]
          : [p.lon, p.lat];
      coordinates = [pos, pos];
    } else if (track.length > 1) {
      coordinates = track.map((p): GeoJsonPosition =>
        p.alt !== undefined && Number.isFinite(p.alt)
          ? [p.lon, p.lat, p.alt]
          : [p.lon, p.lat]
      );
    }

    return {
      type: "Feature",
      id: this.metadata.id,
      geometry: {
        type: "LineString",
        coordinates,
      },
      properties: {
        id: this.metadata.id,
        name: this.metadata.name,
        startTime: this.metadata.startTime,
        ...(this.metadata.endTime !== undefined ? { endTime: this.metadata.endTime } : {}),
        status: this.status,
        pointsCount: stats.pointsCount,
        distanceMeters: stats.distanceMeters,
        distanceKm: stats.distanceKm,
        durationSeconds: stats.durationSeconds,
        avgSpeedMs: stats.avgSpeedMs,
        avgSpeedKmh: stats.avgSpeedKmh,
        elevationGainMeters: stats.elevationGainMeters,
        elevationLossMeters: stats.elevationLossMeters,
        minElevationMeters: stats.minElevationMeters,
        maxElevationMeters: stats.maxElevationMeters,
      },
    };
  }

  /** Retorna os metadados da trilha. */
  getMetadata(): TrackMetadata {
    return { ...this.metadata };
  }
}
