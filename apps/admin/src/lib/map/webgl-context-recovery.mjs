/**
 * WebGL context loss/recovery for one MapLibre view. The retry budget is owned
 * by the selected region/revision, so React remounts cannot reset it and loop.
 */
export function createWebglContextRecovery({ onLost, onRestore, budget }) {
  if (typeof onLost !== 'function' || typeof onRestore !== 'function' ||
      !budget || typeof budget !== 'object' || typeof budget.autoRecoveryUsed !== 'boolean') {
    throw new TypeError('Expected WebGL recovery callbacks and shared retry budget');
  }
  let disposed = false;
  let lost = false;
  return {
    lost(event) {
      if (disposed) return false;
      // Prevent default on the native WebGLContextEvent so the browser may
      // restore the context. MapLibre also listens for these canvas events.
      event?.originalEvent?.preventDefault?.();
      if (lost) return false;
      lost = true;
      onLost();
      return true;
    },
    restored() {
      if (disposed || !lost) return false;
      lost = false;
      if (budget.autoRecoveryUsed) return false;
      budget.autoRecoveryUsed = true;
      onRestore();
      return true;
    },
    dispose() {
      disposed = true;
      lost = false;
    },
  };
}

/** A known transient error is cleared only after the recovered map paints. */
export const WEBGL_CONTEXT_LOST_MESSAGE =
  'O contexto gráfico foi perdido. Aguarde a restauração ou tente reabrir o mapa.';

export function clearRecoveredWebglError(currentMessage) {
  return currentMessage === WEBGL_CONTEXT_LOST_MESSAGE ? null : currentMessage;
}

/** Resource errors after WebGL restoration may replace the old context warning. */
export function canReportMapError(currentMessage) {
  return !currentMessage || currentMessage === WEBGL_CONTEXT_LOST_MESSAGE;
}
