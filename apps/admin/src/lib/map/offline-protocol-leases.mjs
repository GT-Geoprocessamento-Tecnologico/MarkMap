/**
 * Shared MapLibre protocol leases. Protocol names are global per document, but
 * requests and abort controllers belong to one mounted map instance.
 */
const SCHEMES = ["pmtiles", "geonexo-package"];
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
  if (typeof url !== "string") return null;
  const expression =
    scheme === "pmtiles"
      ? /^pmtiles:\/\/(?:geonexo|markmap)-offline:(mk[a-z0-9]+)(?:\/|$)/
      : /^(?:geonexo|markmap)-package:\/\/(mk[a-z0-9]+)\//;
  return expression.exec(url)?.[1] ?? null;
}

const abortRequest = () =>
  new DOMException("Offline map view was replaced", "AbortError");

async function dispatch(scheme, params, controller) {
  const id = leaseFromUrl(scheme, params?.url);
  const lease = id && leases.get(id);
  const handler = lease?.[scheme === "pmtiles" ? "tile" : "asset"];
  if (!lease || !handler || controller?.signal?.aborted) throw abortRequest();

  // MapLibre may still have outstanding requests after a React view unmount.
  // Link every read to both the upstream controller and its owning map lease.
  const request = new AbortController();
  lease.pending.add(request);
  const external = controller?.signal;
  const onExternalAbort = () => request.abort();
  if (external?.aborted) request.abort();
  else external?.addEventListener("abort", onExternalAbort, { once: true });
  try {
    return await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        request.signal.removeEventListener("abort", onAbort);
        callback(value);
      };
      const onAbort = () => finish(reject, abortRequest());
      request.signal.addEventListener("abort", onAbort, { once: true });
      // Do not enter the underlying PMTiles/IndexedDB handler if already stale.
      Promise.resolve()
        .then(() => {
          if (request.signal.aborted) throw abortRequest();
          return handler(params, request);
        })
        .then(
          (value) => {
            if (request.signal.aborted || leases.get(id) !== lease)
              finish(reject, abortRequest());
            else finish(resolve, value);
          },
          (error) => finish(reject, error),
        );
      if (request.signal.aborted) onAbort();
    });
  } finally {
    external?.removeEventListener("abort", onExternalAbort);
    lease.pending.delete(request);
  }
}

const tileDispatch = (params, controller) =>
  dispatch("pmtiles", params, controller);
const assetDispatch = (params, controller) =>
  dispatch("geonexo-package", params, controller);

export function acquireOfflineProtocolLease({
  addProtocol,
  removeProtocol,
  createHandlers,
}) {
  if (
    [addProtocol, removeProtocol, createHandlers].some(
      (value) => typeof value !== "function",
    )
  )
    throw new TypeError("Expected protocol registration and handler callbacks");
  if (!Number.isSafeInteger(sequence + 1))
    throw new Error("Offline map protocol identity exhausted");
  const id = `mk${prefix}${(++sequence).toString(36)}`;
  const handlers = createHandlers(id);
  if (
    !handlers ||
    typeof handlers.tile !== "function" ||
    typeof handlers.asset !== "function"
  )
    throw new TypeError("Missing offline map protocol handlers");

  if (!registered) {
    addProtocol(SCHEMES[0], tileDispatch);
    try {
      addProtocol(SCHEMES[1], assetDispatch);
    } catch (error) {
      try {
        removeProtocol(SCHEMES[0]);
      } catch {
        /* preserve original error */
      }
      throw error;
    }
    registered = true;
  }
  const lease = { ...handlers, pending: new Set() };
  leases.set(id, lease);
  let released = false;
  return {
    id,
    release() {
      if (released) return;
      released = true;
      leases.delete(id);
      // Abort immediately instead of merely discarding a late response. A
      // cooperative PMTiles/Blob read can now stop its own I/O as well.
      for (const request of lease.pending) request.abort();
      lease.pending.clear();
      if (leases.size === 0 && registered) {
        registered = false;
        for (const scheme of SCHEMES) {
          try {
            removeProtocol(scheme);
          } catch {
            /* best-effort unmount */
          }
        }
      }
    },
  };
}
