import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDeviceLocation } from './useDeviceLocation';

describe('useDeviceLocation', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('provides default state and toggles auto-follow', () => {
    const { result } = renderHook(() => useDeviceLocation());

    expect(result.current.sample).toBeNull();
    expect(result.current.heading).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isTracking).toBe(false);
    expect(result.current.isAutoFollow).toBe(true);

    act(() => {
      result.current.toggleAutoFollow();
    });

    expect(result.current.isAutoFollow).toBe(false);
  });

  it('sets error if geolocation is not supported', () => {
    vi.stubGlobal('navigator', {
      ...originalNavigator,
      geolocation: undefined,
    });

    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      result.current.startTracking();
    });

    expect(result.current.error).toBe(
      'Geolocalização não é suportada por este dispositivo ou navegador.'
    );
    expect(result.current.isTracking).toBe(false);
  });

  it('starts and stops location tracking, handling position updates and wake lock', async () => {
    const releaseMock = vi.fn().mockResolvedValue(undefined);
    const requestMock = vi.fn().mockResolvedValue({ release: releaseMock });

    let watchSuccessCallback: ((pos: GeolocationPosition) => void) | null = null;
    const watchPositionMock = vi.fn().mockImplementation((successCallback) => {
      watchSuccessCallback = successCallback;
      return 42;
    });
    const clearWatchMock = vi.fn();

    vi.stubGlobal('navigator', {
      ...originalNavigator,
      geolocation: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
      wakeLock: {
        request: requestMock,
      },
    });

    const { result, unmount } = renderHook(() => useDeviceLocation({ keepScreenAwake: true }));

    await act(async () => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(true);
    expect(requestMock).toHaveBeenCalledWith('screen');

    const now = Date.now();
    act(() => {
      watchSuccessCallback?.({
        coords: {
          latitude: -23.55052,
          longitude: -46.633308,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: now,
      } as GeolocationPosition);
    });

    expect(result.current.permissionState).toBe('granted');
    expect(result.current.sample).toEqual({
      latitude: -23.55052,
      longitude: -46.633308,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      observedAt: new Date(now).toISOString(),
      source: 'browser-foreground',
    });

    await act(async () => {
      result.current.stopTracking();
    });

    expect(result.current.isTracking).toBe(false);
    expect(clearWatchMock).toHaveBeenCalledWith(42);
    expect(releaseMock).toHaveBeenCalled();

    unmount();
  });

  it('handles geolocation permission denied error', () => {
    let watchErrorCallback: ((err: GeolocationPositionError) => void) | null = null;
    const watchPositionMock = vi.fn().mockImplementation((_, errorCallback) => {
      watchErrorCallback = errorCallback;
      return 99;
    });

    vi.stubGlobal('navigator', {
      ...originalNavigator,
      geolocation: {
        watchPosition: watchPositionMock,
        clearWatch: vi.fn(),
      },
    });

    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      result.current.startTracking();
    });

    act(() => {
      watchErrorCallback?.({
        code: 1, // PERMISSION_DENIED
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'User denied geolocation',
      } as GeolocationPositionError);
    });

    expect(result.current.permissionState).toBe('denied');
    expect(result.current.error).toContain('Permissão de localização negada');
  });

  it('updates compass heading on device orientation events for iOS and Android', () => {
    if (!('DeviceOrientationEvent' in window)) {
      vi.stubGlobal('DeviceOrientationEvent', Event);
    }

    const { result, unmount } = renderHook(() => useDeviceLocation());

    // Test iOS webkitCompassHeading
    act(() => {
      const iosEvent = new Event('deviceorientation');
      Object.defineProperty(iosEvent, 'webkitCompassHeading', { value: 120.4, configurable: true });
      window.dispatchEvent(iosEvent);
    });

    expect(result.current.heading).toBe(120);

    // Test Android absolute orientation (360 - alpha) % 360
    act(() => {
      const androidEvent = new Event('deviceorientationabsolute');
      Object.defineProperty(androidEvent, 'alpha', { value: 90, configurable: true });
      Object.defineProperty(androidEvent, 'absolute', { value: true, configurable: true });
      window.dispatchEvent(androidEvent);
    });

    expect(result.current.heading).toBe(270);

    unmount();
  });
});
