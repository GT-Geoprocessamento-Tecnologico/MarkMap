/**
 * Compare a region's active storage generation, not just its version string.
 * This predicate is invoked INSIDE IndexedDB read/write transactions.
 */
export function matchesActiveRegionGeneration(rows, packageId, expectedGeneration) {
  if (expectedGeneration === undefined) return true; // manual first-time installs remain supported
  if (typeof expectedGeneration !== 'string' || !/^[a-z0-9-]{8,80}$/i.test(expectedGeneration)) return false;
  const active = rows.filter((row) => row.packageId === packageId && row.state === 'active');
  return active.length === 1 && active[0].generation === expectedGeneration;
}
