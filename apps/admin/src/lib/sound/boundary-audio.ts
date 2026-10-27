// Desenvolvido por MtsFerreira. Síntese nativa Web Audio API para alertas de divisa (M5).

export type BoundaryAudioWarningType = "approaching" | "breach";

export interface BoundaryAudioOptions {
  force?: boolean;
}

const STORAGE_KEY_MUTE = "markmap:boundary_audio_muted";
const DEFAULT_THROTTLE_MS = 15_000; // 15 segundos entre alertas contínuos

// Frequências normativas em Hz
const APPROACHING_FREQ_HZ = 587.33; // D5 (Ré 5 - tom preventivo amigável)
const BREACH_START_FREQ_HZ = 440.0; // A4 (Lá 4)
const BREACH_END_FREQ_HZ = 330.0; // E4 (Mi 4 - tom descendente de violação)

let globalAudioContext: AudioContext | null = null;
let lastSoundTimestamp: Record<BoundaryAudioWarningType, number> = {
  approaching: 0,
  breach: 0,
};

const muteListeners = new Set<(muted: boolean) => void>();

/**
 * Obtém ou cria a instância única do AudioContext com lazy-load
 */
export function getBoundaryAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!globalAudioContext || globalAudioContext.state === "closed") {
    try {
      globalAudioContext = new AudioCtxClass();
    } catch {
      return null;
    }
  }
  return globalAudioContext;
}

/**
 * Desbloqueia o contexto de áudio preventivamente na primeira interação do usuário
 */
export function initAudioOnUserGesture(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const unlock = () => {
    const ctx = getBoundaryAudioContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
    removeListeners();
  };

  const removeListeners = () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { passive: true, once: true });
  window.addEventListener("touchstart", unlock, { passive: true, once: true });
  window.addEventListener("keydown", unlock, { passive: true, once: true });

  return removeListeners;
}

/**
 * Verifica se o áudio de limites está em mudo
 */
export function isBoundaryAudioMuted(): boolean {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(STORAGE_KEY_MUTE) === "true";
    }
  } catch {
    /* ignore storage error */
  }
  return false;
}

/**
 * Define e persiste o estado de mudo
 */
export function setBoundaryAudioMuted(muted: boolean): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_MUTE, muted ? "true" : "false");
    }
  } catch {
    /* ignore storage error */
  }
  muteListeners.forEach((listener) => {
    try {
      listener(muted);
    } catch {
      /* ignore listener error */
    }
  });
}

/**
 * Alterna o estado de mudo e retorna o novo valor
 */
export function toggleBoundaryAudioMute(): boolean {
  const next = !isBoundaryAudioMuted();
  setBoundaryAudioMuted(next);
  return next;
}

/**
 * Registra ouvinte para sincronização reativa de mudo
 */
export function subscribeBoundaryAudioMute(callback: (muted: boolean) => void): () => void {
  muteListeners.add(callback);
  return () => {
    muteListeners.delete(callback);
  };
}

/**
 * Limpa o histórico de throttle (utilizado em testes unitários)
 */
export function resetBoundaryAudioThrottleForTests(): void {
  lastSoundTimestamp = { approaching: 0, breach: 0 };
}

/**
 * Reseta a instância global de AudioContext (utilizado em testes unitários)
 */
export function resetBoundaryAudioContextForTests(): void {
  globalAudioContext = null;
}

/**
 * Sintetiza o som de aproximação (bipe duplo 587Hz)
 */
function playApproachingTone(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const pulseDuration = 0.09;
  const pauseDuration = 0.07;
  const peakGain = 0.18;

  // Pulso 1
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(APPROACHING_FREQ_HZ, now);

  gain1.gain.setValueAtTime(0.0001, now);
  gain1.gain.exponentialRampToValueAtTime(peakGain, now + 0.012);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + pulseDuration);

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + pulseDuration + 0.01);

  osc1.onended = () => {
    try {
      osc1.disconnect();
      gain1.disconnect();
    } catch {
      /* ignore */
    }
  };

  // Pulso 2
  const startPulse2 = now + pulseDuration + pauseDuration;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(APPROACHING_FREQ_HZ, startPulse2);

  gain2.gain.setValueAtTime(0.0001, startPulse2);
  gain2.gain.exponentialRampToValueAtTime(peakGain, startPulse2 + 0.012);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startPulse2 + pulseDuration);

  osc2.connect(gain2);
  gain2.connect(ctx.destination);

  osc2.start(startPulse2);
  osc2.stop(startPulse2 + pulseDuration + 0.01);

  osc2.onended = () => {
    try {
      osc2.disconnect();
      gain2.disconnect();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Sintetiza o som de violação/cruzamento (tom descendente 440Hz -> 330Hz)
 */
function playBreachTone(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const duration = 0.38;
  const peakGain = 0.22;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(BREACH_START_FREQ_HZ, now);
  osc.frequency.exponentialRampToValueAtTime(BREACH_END_FREQ_HZ, now + duration * 0.85);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.015);
  gain.gain.setValueAtTime(peakGain * 0.9, now + 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.01);

  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Dispara o alerta sonoro apropriado respeitando mute e throttle de 15 segundos
 */
export async function playBoundaryWarningSound(
  type: BoundaryAudioWarningType,
  options: BoundaryAudioOptions = {},
): Promise<void> {
  if (isBoundaryAudioMuted()) return;

  const nowMs = Date.now();
  if (!options.force) {
    const elapsed = nowMs - lastSoundTimestamp[type];
    if (elapsed < DEFAULT_THROTTLE_MS) {
      return; // Bloqueado pelo throttle
    }
  }

  const ctx = getBoundaryAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return; // Sem interação do usuário ainda
    }
  }

  if (type === "approaching") {
    playApproachingTone(ctx);
  } else if (type === "breach") {
    playBreachTone(ctx);
  }

  lastSoundTimestamp[type] = nowMs;
}
