/** Cross-tab invalidation hint only. IndexedDB remains authoritative. */
const CHANNEL_NAME = 'markmap:import-catalog:v1';
const LOCAL_EVENT = 'markmap:import-catalog:changed';
const ORIGIN = globalThis.crypto?.randomUUID?.() ?? String(Math.random());
const KINDS = new Set(['original', 'dataset']);
const ACTIONS = new Set(['saved', 'renamed', 'deleted', 'updated']);

function valid(message) {
  return message && typeof message === 'object' &&
    KINDS.has(message.kind) && ACTIONS.has(message.action) &&
    typeof message.id === 'string' && message.id.length > 0 &&
    message.id.length <= 128 && !/[\u0000-\u001F\u007F]/u.test(message.id);
}

/** Notify listeners after the IndexedDB transaction commits. */
export function notifyImportCatalogChanged(message, Channel = globalThis.BroadcastChannel) {
  if (!valid(message)) return false;
  const data = { kind: message.kind, id: message.id, action: message.action, origin: ORIGIN };
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try { window.dispatchEvent(new CustomEvent(LOCAL_EVENT, { detail: data })); }
    catch { /* A listener must never turn a committed deletion into a UI error. */ }
  }
  if (typeof Channel === 'function') {
    try {
      const channel = new Channel(CHANNEL_NAME);
      try { channel.postMessage(data); } finally { channel.close(); }
    } catch { /* BroadcastChannel is optional; local notification still works. */ }
  }
  return true;
}

export function subscribeImportCatalogChanges(callback, Channel = globalThis.BroadcastChannel) {
  if (typeof callback !== 'function') throw new TypeError('Expected a catalog listener');
  const onLocal = (event) => { if (valid(event?.detail)) callback(event.detail); };
  if (typeof window !== 'undefined') window.addEventListener(LOCAL_EVENT, onLocal);
  let channel;
  if (typeof Channel === 'function') {
    try {
      channel = new Channel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (valid(event?.data) && event.data.origin !== ORIGIN) callback(event.data);
      };
    } catch { /* A failed channel must not stop same-tab updates. */ }
  }
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener(LOCAL_EVENT, onLocal);
    if (channel) { channel.onmessage = null; channel.close(); }
  };
}
