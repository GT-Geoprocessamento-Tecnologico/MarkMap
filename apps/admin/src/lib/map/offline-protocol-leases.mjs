/**
 * Shared MapLibre protocol leases. MapLibre protocol names are global to a page,
 * so each mounted map gets an isolated alias and releases only its own handlers.
 * The actual protocol registration lives until the last map releases its lease.
 */
const SCHEMES = ['pmtiles', 'geonexo-package'];
const leases = new Map();
let registered = false;
let sequence = 0;
const prefix = (() => {
  try {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0].toString(36);
  } catch {
    return Math.floor(Math.random() * 0x100000000).toString(36);
  }
})();

function leaseFromUrl(scheme, url) {
  if (typeof url !== 'string') return null;
  const expression = scheme === 'pmtiles'
    ? /^pmtiles:\/\/geonexo-offline:(mk[a-z0-9]+)(?:\/|$)/
    : /^geonexo-package:\/\/(mk[a-z0-9]+)\//;
  return expression.exec(url)?.[1] ?? null;
}

function abortRequest() {
  return new DOMException('Offline map view was replaced', 'AbortError');
}

async function dispatch(scheme, params, controller) {
  const id = leaseFromUrl(scheme, params?.url);
  const handler = id && leases.get(id)?.[scheme === 'pmtiles' ? 'tile' : 'asset'];
  if (!handler || controller?.signal?.aborted) throw abortRequest();
  const result = await handler(params, controller);
  // An old MapLibre worker may resolve after its view has already been removed.
  if (!leases.has(id) || controller?.signal?.aborted) throw abortRequest();
  return result;
}

const tileDispatch = (params, controller) => dispatch('pmtiles', params, controller);
const assetDispatch = (params, controller) => dispatch('geonexo-package', params, controller);

export function acquireOfflineProtocolLease({ addProtocol, removeProtocol, createHandlers }) {
  if ([addProtocol, removeProtocol, createHandlers].some((value) => typeof value !== 'function'))
    throw new TypeError('Expected protocol registration and handler callbacks');
  if (!Number.isSafeInteger(sequence + 1)) throw new Error('Offline map protocol identity exhausted');
  const id = `mk${prefix}${(++sequence).toString(36)}`;
  const handlers = createHandlers(id);
  if (!handlers || typeof handlers.tile !== 'function' || typeof handlers.asset !== 'function')
    throw new TypeError('Missing offline map protocol handlers');

  if (!registered) {
    addProtocol(SCHEMES[0], tileDispatch);
    try {
      addProtocol(SCHEMES[1], assetDispatch);
    } catch (error) {
      try { removeProtocol(SCHEMES[0]); } catch { /* preserve original error */ }
      throw error;
    }
    registered = true;
  }
  leases.set(id, handlers);
  let released = false;
  return {
    id,
    release() {
      if (released) return;
      released = true;
      leases.delete(id);
      if (leases.size === 0 && registered) {
        // A released page must not remove the protocol of another active map.
        registered = false;
        for (const scheme of SCHEMES) {
          try { removeProtocol(scheme); } catch { /* best-effort unmount */ }
        }
      }
    },
  };
}
