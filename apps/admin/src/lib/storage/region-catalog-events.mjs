/** Non-authoritative, metadata-only cross-tab hint. IndexedDB remains the source of truth. */
const CHANNEL = 'markmap:offline-region-catalog:v1';
const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function notifyRegionCatalogChanged(regionId, Channel = globalThis.BroadcastChannel) {
  if (typeof regionId !== 'string' || !ID.test(regionId) || typeof Channel !== 'function') return false;
  try {
    const channel = new Channel(CHANNEL);
    try { channel.postMessage({ type: 'region-changed', regionId }); }
    finally { channel.close(); }
    return true;
  } catch { return false; } // Unsupported/private browsing never blocks offline storage.
}

export function subscribeRegionCatalogChanges(callback, Channel = globalThis.BroadcastChannel) {
  if (typeof callback !== 'function') throw new TypeError('Expected a region change callback');
  if (typeof Channel !== 'function') return () => undefined;
  let channel;
  try { channel = new Channel(CHANNEL); }
  catch { return () => undefined; }
  channel.onmessage = (event) => {
    const data = event?.data;
    if (data?.type === 'region-changed' && typeof data.regionId === 'string' && ID.test(data.regionId)) {
      callback(data.regionId);
    }
  };
  return () => { channel.onmessage = null; channel.close(); };
}
