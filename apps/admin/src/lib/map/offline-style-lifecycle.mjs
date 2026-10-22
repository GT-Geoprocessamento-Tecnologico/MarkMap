/**
 * MapLibre style/load coordinator for one mounted map.
 * A late render event from an obsolete style must never mark the new view ready.
 */
export function createOfflineStyleLifecycle({ map, isActive, onHydrate, onReady, onError, onStyleReset = () => {} }) {
  if (!map || typeof map.once !== 'function' || typeof map.off !== 'function' ||
      [isActive, onHydrate, onReady, onError, onStyleReset].some(fn => typeof fn !== 'function')) {
    throw new TypeError('Expected map event methods and style lifecycle callbacks');
  }
  let disposed = false;
  let paused = false;
  let generation = 0;
  let hydrated = false;
  let hydrating = false;
  let loadedDuringHydration = false;
  let readyGeneration = -1;
  let pendingPaint = null;

  const active = () => !disposed && !paused && isActive();
  const cancelPending = () => {
    if (pendingPaint) {
      try { map.off('render', pendingPaint); } catch { /* removed WebGL map */ }
      pendingPaint = null;
    }
  };
  const reportError = error => { if (active()) onError(error); };

  // A style can preserve an already-loaded local GeoJSON source. In that case
  // MapLibre does not owe us a new sourcedata event after hydration. Verify
  // the CURRENT source before reporting readiness: a late sourcedata event
  // from the previous style must not validate its replacement.
  const currentLocalSourceReady = () => {
    if (typeof map.getSource !== 'function' || typeof map.isSourceLoaded !== 'function')
      return null; // Compatibility with old MapLibre/test adapters.
    try {
      if (!map.getSource('local-dataset')) return false;
      return map.isSourceLoaded('local-dataset') === true;
    } catch {
      // MapLibre may throw while a style is being swapped or disposed.
      return false;
    }
  };

  function styleLoad() {
    if (!active()) return false;
    generation++;
    hydrated = false;
    hydrating = true;
    loadedDuringHydration = false;
    cancelPending();
    try {
      onStyleReset();
      onHydrate();
      hydrated = true;
      hydrating = false;
      // Offline GeoJSON can complete synchronously while being added.
      if (loadedDuringHydration || currentLocalSourceReady() === true)
        sourceData({ sourceId: 'local-dataset', isSourceLoaded: true });
      return true;
    } catch (error) {
      hydrating = false;
      reportError(error);
      return false;
    }
  }

  function sourceData(event) {
    if (!active() || event?.sourceId !== 'local-dataset' || event.isSourceLoaded !== true ||
        currentLocalSourceReady() === false) return false;
    if (hydrating) { loadedDuringHydration = true; return false; }
    if (!hydrated || readyGeneration === generation || pendingPaint) return false;
    const paintGeneration = generation;
    const finish = () => {
      pendingPaint = null;
      if (!active() || !hydrated || readyGeneration === paintGeneration ||
          paintGeneration !== generation || currentLocalSourceReady() === false) return;
      try {
        onReady();
        readyGeneration = paintGeneration;
      } catch (error) {
        reportError(error);
      }
    };
    try {
      if (map.loaded()) finish();
      else {
        pendingPaint = finish;
        map.once('render', finish);
      }
    } catch (error) {
      cancelPending();
      reportError(error);
      return false;
    }
    return true;
  }

  return {
    styleLoad,
    sourceData,
    contextLost() { paused = true; hydrated = false; cancelPending(); },
    contextRestored() { paused = false; },
    dispose() { disposed = true; hydrated = false; cancelPending(); },
  };
}
