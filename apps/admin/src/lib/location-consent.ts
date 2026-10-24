// Desenvolvido por MtsFerreira. IndexedDB stores the choice, never OS authority.
import { isLocationPermissionGranted } from "./device-location-permission";
import { offlineDB } from "./storage/offline-db";

export type DeviceFix = Readonly<{ lon: number; lat: number; accuracyM: number }>;

// No coordinates, location history or secret permission tokens are persisted.
export const rememberLocationApproval = () =>
  offlineDB.save("permissions", "gps", { status: "granted", autoCenter: true });

export async function shouldAutoLocateOnOpen(): Promise<boolean> {
  try {
    const saved = await offlineDB.get("permissions", "gps");
    if (saved && typeof saved === "object" && "autoCenter" in saved && saved.autoCenter === false) return false;
  } catch { /* Local storage failure must not override OS consent. */ }
  return isLocationPermissionGranted();
}

export function isInsideOfflineRegion(
  fix: DeviceFix, bounds: readonly [number, number, number, number] | null,
): boolean {
  return !bounds || (fix.lon >= bounds[0] && fix.lon <= bounds[2] &&
    fix.lat >= bounds[1] && fix.lat <= bounds[3]);
}

export function getFreshDevicePosition(): Promise<DeviceFix | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lon, accuracy: accuracyM } = coords;
        resolve(
          Number.isFinite(lat) && Math.abs(lat) <= 90 &&
          Number.isFinite(lon) && Math.abs(lon) <= 180 &&
          Number.isFinite(accuracyM) && accuracyM >= 0
            ? { lat, lon, accuracyM } : null,
        );
      },
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  });
}
