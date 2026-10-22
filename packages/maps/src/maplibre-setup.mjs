/**
 * Clean a MapLibre instance if synchronous map/control setup fails.
 * Keeps the original error even if WebGL teardown also throws.
 */
export function configureMapWithRollback(map, configure) {
  if (!map || typeof map.remove !== 'function' || typeof configure !== 'function')
    throw new TypeError('Expected map instance and setup callback');
  try {
    return configure();
  } catch (error) {
    try { map.remove(); } catch { /* preserve the initialization error */ }
    throw error;
  }
}
