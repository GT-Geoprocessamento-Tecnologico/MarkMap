import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useDeviceLocation } from './useDeviceLocation';

interface CustomDeviceOrientationEvent extends Event {
  webkitCompassHeading?: number;
  alpha?: number;
  absolute?: boolean;
}

describe('useDeviceLocation', () => {
  let originalNavigatorPermissions: unknown;
  let originalNavigatorGeolocation: unknown;
  let originalNavigatorWakeLock: unknown;

  beforeEach(() => {
    const nav = navigator as unknown as Record<string, unknown>;
    originalNavigatorPermissions = nav.permissions;
    originalNavigatorGeolocation = nav.geolocation;
    originalNavigatorWakeLock = nav.wakeLock;

    // Ensure DeviceOrientationEvent exists on window object in happy-dom environment
    if (!('DeviceOrientationEvent' in window)) {
      (window as unknown as Record<string, unknown>).DeviceOrientationEvent = class DeviceOrientationEvent extends Event {};
    }
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'permissions', {
      value: originalNavigatorPermissions,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'geolocation', {
      value: originalNavigatorGeolocation,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'wakeLock', {
      value: originalNavigatorWakeLock,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useDeviceLocation());
    expect(result.current.sample).toBeNull();
    expect(result.current.heading).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isTracking).toBe(false);
    expect(result.current.isAutoFollow).toBe(true);
  });

  it('toggles auto follow mode', () => {
    const { result } = renderHook(() => useDeviceLocation());
    expect(result.current.isAutoFollow).toBe(true);

    act(() => {
      result.current.toggleAutoFollow();
    });

    expect(result.current.isAutoFollow).toBe(false);
  });

  it('sets error if geolocation is not supported when starting tracking', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(false);
    expect(result.current.error).toBe('Geolocalização não é suportada por este dispositivo ou navegador.');
  });

  it('tracks location updates and handles wake lock when starting tracking', async () => {
    let positionCallback: ((pos: GeolocationPosition) => void) | null = null;
    const watchPositionMock = vi.fn((successCallback: (pos: GeolocationPosition) => void) => {
      positionCallback = successCallback;
      return 123;
    });

    const clearWatchMock = vi.fn();

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
      configurable: true,
      writable: true,
    });

    const mockWakeLockSentinel = { release: vi.fn().mockResolvedValue(undefined) };
    const requestWakeLockMock = vi.fn().mockResolvedValue(mockWakeLockSentinel);

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: requestWakeLockMock },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useDeviceLocation({ keepScreenAwake: true }));

    await act(async () => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(true);

    act(() => {
      if (positionCallback) {
        positionCallback({
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            accuracy: 10,
            altitude: 750,
            altitudeAccuracy: 5,
            heading: 180,
            speed: 2,
          },
          timestamp: Date.now(),
        } as unknown as GeolocationPosition);
      }
    });

    expect(requestWakeLockMock).toHaveBeenCalledWith('screen');
    expect(result.current.sample).not.toBeNull();
    expect(result.current.sample?.latitude).toBe(-23.5505);

    await act(async () => {
      result.current.stopTracking();
    });

    expect(clearWatchMock).toHaveBeenCalledWith(123);
    expect(mockWakeLockSentinel.release).toHaveBeenCalled();
    expect(result.current.isTracking).toBe(false);
  });

  it('handles webkitCompassHeading device orientation events (iOS)', () => {
    const { result } = renderHook(() => useDeviceLocation());

    const event = new Event('deviceorientation') as CustomDeviceOrientationEvent;
    event.webkitCompassHeading = 45.4;

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(45);
  });

  it('handles alpha device orientation events (Android)', () => {
    const { result } = renderHook(() => useDeviceLocation());

    const event = new Event('deviceorientation') as CustomDeviceOrientationEvent;
    event.alpha = 90;
    event.absolute = true;

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(270);
  });
});
