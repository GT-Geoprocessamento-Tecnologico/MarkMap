import { subscribeRegionForeground } from "./region-foreground-reconcile.mjs";

/** Shared local-only selection. The historical storage key is intentionally stable. */
const SELECTED_PACKAGE_KEY = "geonexo:selected-offline-map-package";
const SELECTION_EVENT = "markmap:offline-map-selection-changed";
const PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function getSelectedOfflineMapId() {
  try {
    const value = globalThis.localStorage.getItem(SELECTED_PACKAGE_KEY);
    return value && PACKAGE_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function setSelectedOfflineMapId(packageId) {
  if (
    packageId !== null &&
    (typeof packageId !== "string" || !PACKAGE_ID_PATTERN.test(packageId))
  ) {
    throw new Error("Identificador do pacote offline inválido.");
  }
  const storage = globalThis.localStorage;
  const previous = storage.getItem(SELECTED_PACKAGE_KEY);
  if (previous === packageId) return;
  if (packageId === null) storage.removeItem(SELECTED_PACKAGE_KEY);
  else storage.setItem(SELECTED_PACKAGE_KEY, packageId);
  // Storage events do not fire in the tab that made the change.
  if (typeof window !== "undefined" && typeof Event === "function") {
    window.dispatchEvent(new Event(SELECTION_EVENT));
  }
}

export function subscribeSelectedOfflineMapId(onChange) {
  if (typeof onChange !== "function")
    throw new TypeError("Selection subscriber must be a function");
  if (typeof window === "undefined") return () => undefined;
  let lastSeen = getSelectedOfflineMapId();
  const notify = () => {
    lastSeen = getSelectedOfflineMapId();
    onChange();
  };
  const onStorage = (event) => {
    if (event?.key === SELECTED_PACKAGE_KEY || event?.key === null) notify();
  };
  // The OS may suspend WebView and drop a cross-tab storage event.
  // On focus only notify when the durable selection actually changed.
  const stopForeground = subscribeRegionForeground(() => {
    const now = getSelectedOfflineMapId();
    if (now !== lastSeen) notify();
  });
  window.addEventListener("storage", onStorage);
  window.addEventListener(SELECTION_EVENT, notify);
  return () => {
    stopForeground();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SELECTION_EVENT, notify);
  };
}
