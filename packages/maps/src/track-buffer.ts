export interface TrackPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

export type FlushCallback = (batches: TrackPoint[]) => Promise<void> | void;
export type ErrorCallback = (error: Error) => void;

/**
 * Gerenciador de buffer de rastreamento de GPS (Offline-first).
 * Acumula os pontos em lotes e tenta fazer o envio (flush) periodicamente.
 */
export class TrackSampleBuffer {
  private buffer: TrackPoint[] = [];
  private flushCallback: FlushCallback;
  private errorCallback: ErrorCallback;
  private flushIntervalId: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  /**
   * Construtor do gerenciador.
   * @param flushCallback Função chamada para enviar os lotes. Deve retornar uma Promise para indicar sucesso ou erro.
   * @param errorCallback Função chamada quando o envio falha (ex: falta de internet).
   */
  constructor(flushCallback: FlushCallback, errorCallback: ErrorCallback) {
    this.flushCallback = flushCallback;
    this.errorCallback = errorCallback;
  }

  /**
   * Adiciona um ponto ao buffer.
  */
  public addPoint(latitude: number, longitude: number, timestamp: number, accuracy?: number): void {
    const point: TrackPoint = { latitude, longitude, timestamp };
    if (accuracy !== undefined) {
      point.accuracy = accuracy;
    }
    this.buffer.push(point);
  }

  /**
   * Inicia o processo de flush periódico.
   * @param intervalMs Intervalo em milissegundos (padrão: 5000ms).
   */
  public startPeriodicFlush(intervalMs: number = 5000): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
    }
    this.flushIntervalId = setInterval(() => {
      this.flush();
    }, intervalMs);
  }

  /**
   * Para o processo de flush periódico.
   */
  public stopPeriodicFlush(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Tenta enviar os dados acumulados.
   * Se o flush falhar (ex: sem internet), os pontos continuarão no buffer para uma nova tentativa.
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Copia o lote atual para envio
    const batch = [...this.buffer];

    try {
      // Tenta enviar o lote
      await this.flushCallback(batch);
      
      // Se sucesso, remove apenas os pontos que estavam no lote.
      // (Novos pontos podem ter sido adicionados ao buffer original durante a espera).
      this.buffer = this.buffer.slice(batch.length);
    } catch (error) {
      // Em caso de erro, notifica pelo callback de erro.
      // Os pontos não são removidos do buffer e serão tentados novamente no próximo flush.
      this.errorCallback(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Retorna a quantidade de pontos que ainda estão no buffer aguardando envio.
   */
  public getPendingPointsCount(): number {
    return this.buffer.length;
  }

  /**
   * Limpa o buffer completamente.
   */
  public clear(): void {
    this.buffer = [];
  }
}
