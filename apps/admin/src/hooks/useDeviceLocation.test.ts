import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceLocation } from './useDeviceLocation';

describe('useDeviceLocation', () => {
  let mockWatchPosition: ReturnType<typeof vi.fn>;
  let mockClearWatch: ReturnType<typeof vi.fn>;
  let mockWakeLockRequest: ReturnType<typeof vi.fn>;
  let mockWakeLockRelease: ReturnType<typeof vi.fn>;
  let mockPermissionsQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWatchPosition = vi.fn().mockImplementation(() => 123);
    mockClearWatch = vi.fn();
    mockWakeLockRelease = vi.fn().mockResolvedValue(undefined);
    mockWakeLockRequest = vi.fn().mockResolvedValue({
      release: mockWakeLockRelease,
    });
    mockPermissionsQuery = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        state: 'granted',
        onchange: null,
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition: mockWatchPosition,
        clearWatch: mockClearWatch,
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'permissions', {
      value: {
        query: mockPermissionsQuery,
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: mockWakeLockRequest,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default state', async () => {
    const { result } = renderHook(() => useDeviceLocation());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isTracking).toBe(false);
    expect(result.current.isAutoFollow).toBe(true);
    expect(result.current.sample).toBeNull();
    expect(result.current.heading).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('queries navigator permission on mount', async () => {
    const { result } = renderHook(() => useDeviceLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPermissionsQuery).toHaveBeenCalledWith({ name: 'geolocation' });
    expect(result.current.permissionState).toBe('granted');
  });

  it('starts continuous tracking and requests wake lock', async () => {
    const { result } = renderHook(() => useDeviceLocation());

    await act(async () => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(true);
    expect(mockWakeLockRequest).toHaveBeenCalledWith('screen');
    expect(mockWatchPosition).toHaveBeenCalled();
  });

  it('stops tracking and releases wake lock', async () => {
    const { result } = renderHook(() => useDeviceLocation());

    await act(async () => {
      result.current.startTracking();
    });

    await act(async () => {
      result.current.stopTracking();
    });

    expect(result.current.isTracking).toBe(false);
    expect(mockClearWatch).toHaveBeenCalledWith(123);
    expect(mockWakeLockRelease).toHaveBeenCalled();
  });

  it('toggles auto-follow mode', async () => {
    const { result } = renderHook(() => useDeviceLocation());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isAutoFollow).toBe(true);

    act(() => {
      result.current.toggleAutoFollow();
    });

    expect(result.current.isAutoFollow).toBe(false);
  });
});
