import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeviceLocation } from './useDeviceLocation';

describe('useDeviceLocation', () => {
  let originalNavigatorPermissions: any;
  let originalNavigatorGeolocation: any;
  let originalNavigatorWakeLock: any;

  beforeEach(() => {
    originalNavigatorPermissions = (navigator as any).permissions;
    originalNavigatorGeolocation = (navigator as any).geolocation;
    originalNavigatorWakeLock = (navigator as any).wakeLock;

    // Ensure DeviceOrientationEvent exists on window object in happy-dom environment
    if (!('DeviceOrientationEvent' in window)) {
      (window as any).DeviceOrientationEvent = class DeviceOrientationEvent extends Event {};
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
    let positionCallback: ((pos: any) => void) | null = null;
    const watchPositionMock = vi.fn((successCallback) => {
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
      positionCallback?.({
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
      });
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

    const event = new Event('deviceorientation') as any;
    event.webkitCompassHeading = 45.4;

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(45);
  });

  it('handles alpha device orientation events (Android)', () => {
    const { result } = renderHook(() => useDeviceLocation());

    const event = new Event('deviceorientation') as any;
    event.alpha = 90;
    event.absolute = true;

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(270);
  });
});
