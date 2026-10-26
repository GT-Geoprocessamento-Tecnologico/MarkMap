import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceLocation } from './useDeviceLocation';

describe('useDeviceLocation', () => {
  let mockWatchPosition: ReturnType<typeof vi.fn>;
  let mockClearWatch: ReturnType<typeof vi.fn>;
  let mockQueryPermissions: ReturnType<typeof vi.fn>;
  let mockWakeLockRequest: ReturnType<typeof vi.fn>;
  let mockWakeLockRelease: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockWatchPosition = vi.fn().mockReturnValue(123);
    mockClearWatch = vi.fn();
    mockQueryPermissions = vi.fn().mockResolvedValue({
      state: 'granted',
      onchange: null,
    });
    mockWakeLockRelease = vi.fn().mockResolvedValue(undefined);
    mockWakeLockRequest = vi.fn().mockResolvedValue({
      release: mockWakeLockRelease,
    });

    vi.stubGlobal('DeviceOrientationEvent', class DeviceOrientationEvent {});

    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: mockWatchPosition,
        clearWatch: mockClearWatch,
      },
      permissions: {
        query: mockQueryPermissions,
      },
      wakeLock: {
        request: mockWakeLockRequest,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initializes with default state and checks permissions', async () => {
    const { result } = renderHook(() => useDeviceLocation());

    expect(result.current.sample).toBeNull();
    expect(result.current.heading).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isTracking).toBe(false);
    expect(result.current.isAutoFollow).toBe(true);

    await waitFor(() => {
      expect(result.current.permissionState).toBe('granted');
    });

    expect(mockQueryPermissions).toHaveBeenCalledWith({ name: 'geolocation' });
  });

  it('toggles auto follow state', () => {
    const { result } = renderHook(() => useDeviceLocation());

    expect(result.current.isAutoFollow).toBe(true);

    act(() => {
      result.current.toggleAutoFollow();
    });

    expect(result.current.isAutoFollow).toBe(false);
  });

  it('starts continuous tracking and requests wake lock', async () => {
    const { result } = renderHook(() => useDeviceLocation({ keepScreenAwake: true }));

    act(() => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(true);
    expect(mockWakeLockRequest).toHaveBeenCalledWith('screen');
    expect(mockWatchPosition).toHaveBeenCalled();

    // Simulate geolocation success callback
    const successCallback = mockWatchPosition.mock.calls[0][0];
    const mockPosition = {
      coords: {
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
        altitude: 800,
        altitudeAccuracy: 5,
        heading: 180,
        speed: 1.5,
      },
      timestamp: Date.now(),
    };

    act(() => {
      successCallback(mockPosition);
    });

    expect(result.current.sample).not.toBeNull();
    expect(result.current.sample?.latitude).toBe(-23.5505);
    expect(result.current.sample?.longitude).toBe(-46.6333);
    expect(result.current.permissionState).toBe('granted');
  });

  it('handles geolocation errors correctly', () => {
    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      result.current.startTracking();
    });

    const errorCallback = mockWatchPosition.mock.calls[0][1];

    act(() => {
      errorCallback({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });

    expect(result.current.permissionState).toBe('denied');
    expect(result.current.error).toContain('Permissão de localização negada');
  });

  it('stops tracking and releases wake lock', async () => {
    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      result.current.startTracking();
    });

    await waitFor(() => {
      expect(mockWakeLockRequest).toHaveBeenCalled();
    });

    act(() => {
      result.current.stopTracking();
    });

    expect(result.current.isTracking).toBe(false);
    expect(mockClearWatch).toHaveBeenCalledWith(123);
    expect(mockWakeLockRelease).toHaveBeenCalled();
  });

  it('handles device orientation events with webkitCompassHeading', () => {
    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      const event = new Event('deviceorientation');
      Object.defineProperty(event, 'webkitCompassHeading', { value: 120 });
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(120);
  });

  it('handles device orientation events with absolute alpha', () => {
    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      const event = new Event('deviceorientationabsolute');
      Object.defineProperty(event, 'alpha', { value: 90 });
      Object.defineProperty(event, 'absolute', { value: true });
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(270);
  });
});
