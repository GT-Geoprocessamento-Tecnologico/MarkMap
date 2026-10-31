/** Conservative capability hints, never a device model or user-agent guess. */
export function readMapDeviceHints() {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const win = typeof window === 'undefined' ? null : window;
  let reducedMotion = false;
  try { reducedMotion = Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch {}
  return {
    cores: nav?.hardwareConcurrency,
    memoryGb: nav?.deviceMemory,
    devicePixelRatio: win?.devicePixelRatio,
    reducedMotion,
  };
}

function positiveFinite(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }

/** One conservative profile for unknown devices; never assume high-end. */
export function adaptiveMapBudget(hints = {}) {
  const cores = positiveFinite(hints.cores) ? hints.cores : 2;
  const memory = positiveFinite(hints.memoryGb) ? hints.memoryGb : null;
  const pixelRatio = positiveFinite(hints.devicePixelRatio) ? hints.devicePixelRatio : 1;
  const constrained = cores <= 2 || (memory !== null && memory <= 2);
  const capable = !constrained && cores >= 8 && memory !== null && memory >= 8;
  const tier = constrained ? 'constrained' : capable ? 'capable' : 'balanced';
  const maximumPixelRatio = tier === 'constrained' ? 1.25 : tier === 'balanced' ? 1.5 : 2;
  return {
    tier,
    workerCount: constrained ? 1 : capable ? 3 : 2,
    pixelRatio: Math.max(1, Math.min(pixelRatio, maximumPixelRatio)),
    maxCanvasSize: tier === 'constrained' ? [2048, 2048] : tier === 'capable' ? [4096, 4096] : [3072, 3072],
    tileCacheZoomLevels: constrained ? 2 : capable ? 5 : 3,
    fadeDuration: Boolean(hints.reducedMotion) || constrained ? 0 : 200,
  };
}
