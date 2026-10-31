/**
 * Local-only, privacy-minimal performance summaries for test tooling.
 * No network calls, storage writes or identification of an actual device.
 */
function finiteNonnegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new RangeError('Invalid performance percentile.');
  }
  if (!values.every(finiteNonnegative)) throw new TypeError('Invalid performance samples.');
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(fraction * ordered.length) - 1)];
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

/** Frame timestamps provided by requestAnimationFrame, in increasing order. */
export function summarizeFrames(timestamps) {
  if (!Array.isArray(timestamps) || !timestamps.every(finiteNonnegative)) {
    throw new TypeError('Invalid animation-frame timestamps.');
  }
  if (timestamps.length < 2) {
    return { frames: 0, elapsedMs: null, fps: null, frameP50Ms: null, frameP95Ms: null };
  }
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    const delta = timestamps[i] - timestamps[i - 1];
    if (!Number.isFinite(delta) || delta <= 0) throw new RangeError('Non-monotonic animation-frame timestamps.');
    intervals.push(delta);
  }
  const elapsedMs = timestamps[timestamps.length - 1] - timestamps[0];
  return {
    frames: intervals.length,
    elapsedMs: rounded(elapsedMs),
    fps: rounded((intervals.length * 1000) / elapsedMs),
    frameP50Ms: rounded(percentile(intervals, 0.5)),
    frameP95Ms: rounded(percentile(intervals, 0.95)),
  };
}

function groupCores(value) {
  if (!finiteNonnegative(value) || value === 0) return 'unknown';
  if (value <= 2) return '1-2';
  if (value <= 4) return '3-4';
  if (value <= 8) return '5-8';
  return '9+';
}

function groupMemory(value) {
  if (!finiteNonnegative(value) || value === 0) return 'unknown';
  if (value <= 2) return '<=2';
  if (value <= 4) return '3-4';
  if (value <= 8) return '5-8';
  return '>8';
}

/** Coarse buckets, deliberately omitting user agent, device ID and geolocation. */
export function coarseDeviceHints({ cores, memoryGb, devicePixelRatio, reducedMotion } = {}) {
  return {
    cores: groupCores(cores),
    memoryGb: groupMemory(memoryGb),
    pixelRatio: !finiteNonnegative(devicePixelRatio) || devicePixelRatio === 0
      ? 'unknown' : devicePixelRatio <= 1.5 ? '<=1.5' : devicePixelRatio <= 2.5 ? '1.5-2.5' : '>2.5',
    reducedMotion: typeof reducedMotion === 'boolean' ? reducedMotion : null,
  };
}

/** Verify the report is measurements, not zero-filled missing capabilities. */
export function createLocalBaseline({ shellReadyMs, mapReadyMs, frames, usedHeapBytes, hints, runtime }) {
  if (!finiteNonnegative(shellReadyMs) || !finiteNonnegative(mapReadyMs)) {
    throw new RangeError('Missing shell/map readiness timings.');
  }
  if (!Array.isArray(frames)) throw new TypeError('Missing animation frame sample.');
  const frameSample = summarizeFrames(frames);
  if (frameSample.frames === 0) throw new RangeError('Animation-frame sample was not collected.');
  return {
    kind: 'markmap-local-perf-baseline-v1',
    environment: runtime === 'browser-emulation' ? 'browser-emulation' : 'unverified',
    shellReadyMs: rounded(shellReadyMs),
    mapReadyMs: rounded(mapReadyMs),
    ...frameSample,
    heapMiB: finiteNonnegative(usedHeapBytes) ? rounded(usedHeapBytes / (1024 * 1024)) : null,
    capabilities: coarseDeviceHints(hints),
    // No local project IDs, latitude/longitude, network addresses or device fingerprints.
  };
}
