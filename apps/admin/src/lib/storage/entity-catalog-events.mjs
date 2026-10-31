/** A hint for invalidating React Query across PWA tabs; IndexedDB is authoritative. */
const CHANNEL_NAME = "markmap:entity-catalog:v1";
const EVENT_NAME = "markmap:entity-catalog:changed";
const ORIGIN = globalThis.crypto?.randomUUID?.() ?? "same-tab";

function valid(value) {
  return value && typeof value === "object" &&
    (value.kind === "project" || value.kind === "layer") &&
    value.action === "deleted" && typeof value.id === "string" &&
    value.id.length > 0 && value.id.length <= 128 &&
    !/[\u0000-\u001F\u007F]/u.test(value.id);
}

export function notifyEntityCatalogChanged(message, Channel = globalThis.BroadcastChannel) {
  if (!valid(message)) return false;
  const data = { kind: message.kind, id: message.id, action: "deleted", origin: ORIGIN };
  if (typeof window !== "undefined") {
    try { window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: data })); }
    catch { /* IndexedDB already committed; a listener must not undo it. */ }
  }
  if (typeof Channel === "function") {
    try { const channel = new Channel(CHANNEL_NAME); try { channel.postMessage(data); } finally { channel.close(); } }
    catch { /* Optional cross-tab transport. */ }
  }
  return true;
}

export function subscribeEntityCatalogChanges(callback, Channel = globalThis.BroadcastChannel) {
  if (typeof callback !== "function") throw new TypeError("Expected a catalog listener");
  const onLocal = (event) => { if (valid(event?.detail)) callback(event.detail); };
  if (typeof window !== "undefined") window.addEventListener(EVENT_NAME, onLocal);
  let channel;
  if (typeof Channel === "function") {
    try {
      channel = new Channel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (valid(event?.data) && event.data.origin !== ORIGIN) callback(event.data);
      };
    } catch { /* Local events still work. */ }
  }
  return () => {
    if (typeof window !== "undefined") window.removeEventListener(EVENT_NAME, onLocal);
    if (channel) { channel.onmessage = null; channel.close(); }
  };
}
