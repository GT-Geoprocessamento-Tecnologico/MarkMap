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
