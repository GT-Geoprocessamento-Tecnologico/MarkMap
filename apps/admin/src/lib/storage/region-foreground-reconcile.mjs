/** Foreground-only lifecycle hooks. No timers, network calls or storage writes. */
export function subscribeRegionForeground(onWake, doc = globalThis.document, win = globalThis.window) {
  if (typeof onWake !== 'function') throw new TypeError('Expected a foreground callback');
  const wake = () => {
    if (!doc || doc.visibilityState !== 'hidden') onWake();
  };
  doc?.addEventListener?.('visibilitychange', wake);
  win?.addEventListener?.('pageshow', wake);
  win?.addEventListener?.('focus', wake);
  return () => {
    doc?.removeEventListener?.('visibilitychange', wake);
    win?.removeEventListener?.('pageshow', wake);
    win?.removeEventListener?.('focus', wake);
  };
}

/**
 * Recheck only the rendered local map generation after resume/cross-tab hints.
 * Missing messages are recovered by a fresh IndexedDB revision read.
 * A failed read never means that an installed package was removed.
 */
export function createRegionRevisionReconciler({ readSelection, readGeneration, onChanged, onError = () => undefined }) {
  if ([readSelection, readGeneration, onChanged, onError].some((fn) => typeof fn !== 'function'))
    throw new TypeError('Region revision reconciler callbacks must be functions');
  let rendered = null;
  let notified = null;
  let running = false;
  let requested = false;
  let disposed = false;

  async function check() {
    if (disposed || !rendered) return;
    if (running) { requested = true; return; }
    running = true;
    try {
      do {
        requested = false;
        const baseline = rendered;
        let id;
        try { id = readSelection(); }
        catch (error) { if (!disposed) onError(error); continue; }
        // The selection observable owns ID changes, including foreground recovery.
        if (id !== baseline.id || !id) continue;
        let generation;
        try { generation = await readGeneration(id); }
        catch (error) {
          if (!disposed && rendered === baseline && readSelection() === id) onError(error);
          continue;
        }
        if (disposed) break;
        if (rendered !== baseline || readSelection() !== id) { requested = true; continue; }
        // Coalesce multiple wakeups: the next read is newer than this result.
        if (requested) continue;
        const nextGeneration = generation ?? null;
        if (nextGeneration !== baseline.generation &&
            (!notified || notified.id !== id || notified.generation !== nextGeneration)) {
          notified = { id, generation: nextGeneration };
          onChanged({ id, from: baseline.generation, to: nextGeneration });
        }
      } while (requested && !disposed);
    } finally { running = false; }
  }

  function noteRendered(id, generation) {
    if (disposed) return;
    rendered = { id: id ?? null, generation: generation ?? null };
    notified = null;
    // Catch a commit that raced with MapLibre initialization, without polling.
    void check();
  }
  function resetPending() { notified = null; }
  function dispose() { disposed = true; rendered = null; notified = null; requested = false; }
  return { noteRendered, check, resetPending, dispose };
}
