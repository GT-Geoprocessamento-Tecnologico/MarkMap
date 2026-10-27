import { useEffect, useState, useRef, useCallback } from "react";
import { positionSampleFromBrowser, type PositionSample } from "@markmap/geo";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
}

interface ExtendedDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

export interface DeviceLocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  autoCenter?: boolean;
  keepScreenAwake?: boolean;
}

export interface DeviceLocationState {
  sample: PositionSample | null;
  heading: number | null; // Compass heading in degrees (0-360)
  error: string | null;
  permissionState: PermissionState | "unknown";
  isTracking: boolean;
  isAutoFollow: boolean;
}

/**
 * Hook for Mobile & Tablet device location tracking.
 * Provides high-accuracy GPS fixes, compass heading, WakeLock, and permission management.
 */
export function useDeviceLocation(options: DeviceLocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    maximumAge = 0,
    timeout = 10000,
    keepScreenAwake = true,
  } = options;

  const [state, setState] = useState<DeviceLocationState>({
    sample: null,
    heading: null,
    error: null,
    permissionState: "unknown",
    isTracking: false,
    isAutoFollow: true,
  });

  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Check initial permission status if available in browser
  useEffect(() => {
    if (
      "permissions" in navigator &&
      navigator.permissions &&
      typeof navigator.permissions.query === "function"
    ) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          setState((prev: DeviceLocationState) => ({
            ...prev,
            permissionState: status.state,
          }));
          status.onchange = () => {
            setState((prev: DeviceLocationState) => ({
              ...prev,
              permissionState: status.state,
            }));
          };
        })
        .catch(() => {
          // Permissions API query not supported for geolocation on some browsers
          setState((prev: DeviceLocationState) => ({
            ...prev,
            permissionState: "unknown",
          }));
        });
    }
  }, []);

  // Screen WakeLock handling for mobile/tablet in the field
  const requestWakeLock = useCallback(async () => {
    const nav = navigator as unknown as NavigatorWithWakeLock;
    if (
      keepScreenAwake &&
      nav.wakeLock &&
      typeof nav.wakeLock.request === "function"
    ) {
      try {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      } catch {
        // Wake Lock optional or permission denied
      }
    }
  }, [keepScreenAwake]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // Ignored
      }
      wakeLockRef.current = null;
    }
  }, []);

  // Device orientation / Compass listener for phone & tablet
  useEffect(() => {
    const handleOrientation = (event: Event) => {
      if (!event || typeof event !== "object") return;
      const orientationEvent = event as ExtendedDeviceOrientationEvent;
      let compass: number | null = null;
      if (typeof orientationEvent.webkitCompassHeading === "number") {
        // iOS Safari compass heading
        compass = orientationEvent.webkitCompassHeading;
      } else if (
        typeof orientationEvent.alpha === "number" &&
        orientationEvent.absolute
      ) {
        // Android absolute orientation
        compass = (360 - orientationEvent.alpha) % 360;
      }
      if (compass !== null && Number.isFinite(compass)) {
        setState((prev: DeviceLocationState) => ({
          ...prev,
          heading: Math.round(compass),
        }));
      }
    };

    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      // Eventos de orientação não borbulham no DOM em alguns navegadores móveis; useCapture: true garante recepção
      window.addEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true,
      );
      window.addEventListener("deviceorientation", handleOrientation, true);
    }

    return () => {
      if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
        window.removeEventListener(
          "deviceorientationabsolute",
          handleOrientation,
          true,
        );
        window.removeEventListener(
          "deviceorientation",
          handleOrientation,
          true,
        );
      }
    };
  }, []);

  // Start continuous location tracking
  const startTracking = useCallback(() => {
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      setState((prev: DeviceLocationState) => ({
        ...prev,
        error:
          "Geolocalização não é suportada por este dispositivo ou navegador.",
      }));
      return;
    }

    setState((prev: DeviceLocationState) => ({
      ...prev,
      isTracking: true,
      error: null,
    }));
    requestWakeLock();

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        try {
          const sample = positionSampleFromBrowser(pos);
          setState((prev: DeviceLocationState) => ({
            ...prev,
            sample,
            error: null,
            permissionState: "granted",
          }));
        } catch {
          // Stale or invalid fix rejected
        }
      },
      (err) => {
        let msg = "Erro ao obter localização.";
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            "Permissão de localização negada. Por favor, ative a localização nas configurações do seu celular/tablet.";
          setState((prev: DeviceLocationState) => ({
            ...prev,
            permissionState: "denied",
          }));
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Sinal de GPS indisponível ou fraco no momento.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Tempo limite esgotado ao buscar sinal de GPS.";
        }
        setState((prev: DeviceLocationState) => ({ ...prev, error: msg }));
      },
      { enableHighAccuracy, maximumAge, timeout },
    );
  }, [enableHighAccuracy, maximumAge, timeout, requestWakeLock]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
    setState((prev: DeviceLocationState) => ({ ...prev, isTracking: false }));
  }, [releaseWakeLock]);

  // Toggle Auto-Follow mode
  const toggleAutoFollow = useCallback(() => {
    setState((prev: DeviceLocationState) => ({
      ...prev,
      isAutoFollow: !prev.isAutoFollow,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    ...state,
    startTracking,
    stopTracking,
    toggleAutoFollow,
  };
}
