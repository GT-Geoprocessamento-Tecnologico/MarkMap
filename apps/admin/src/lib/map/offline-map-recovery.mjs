/**
 * Offline map recovery policy. One automatic attempt per mounted map context;
 * manual attempts are explicit and never erase region selection or field data.
 */
export function createOfflineMapRecovery(requestRetry) {
  if (typeof requestRetry !== 'function') throw new TypeError('Expected retry callback');
  let attemptedAutomatically = false;
  let disposed = false;
  return {
    onForeground({ hasError, hasLocalContext, visible = true }) {
      if (disposed || attemptedAutomatically || !hasError || !hasLocalContext || !visible) return false;
      attemptedAutomatically = true;
      requestRetry();
      return true;
    },
    retryManually() {
      if (disposed) return false;
      // A manual retry must not arm another automatic loop on the next focus.
      attemptedAutomatically = true;
      requestRetry();
      return true;
    },
    dispose() { disposed = true; },
  };
}

/** Neutral style is scoped to the exact region and revision; GeoPDF wins. */
export function resolveOfflineBasemap({ regionId, revision, neutralFor, geoPdfId }) {
  const localRegionId = geoPdfId ? null : (regionId ?? null);
  const neutralActive = Boolean(localRegionId && neutralFor === `${localRegionId}:${revision}`);
  return { regionId: neutralActive ? null : localRegionId, neutralActive };
}
