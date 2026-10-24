/**
 * Best-effort per-origin, per-region Web Lock for offline map installation.
 * The transactional generation guard in OfflineMapStore remains authoritative.
 * On browsers without Web Locks, retain the previous safe local behavior.
 */
const VALID_REGION = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export async function withRegionInstallLock(
  regionId, action, lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks,
) {
  if (typeof regionId !== 'string' || !VALID_REGION.test(regionId))
    throw new Error('Invalid regional installation identity');
  if (typeof action !== 'function') throw new TypeError('Installation action must be a function');
  if (!lockManager || typeof lockManager.request !== 'function')
    return { acquired: true, supported: false, result: await action() };

  return lockManager.request(`markmap:region-install:${regionId}`,
    { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) return { acquired: false, supported: true };
      return { acquired: true, supported: true, result: await action() };
    });
}
