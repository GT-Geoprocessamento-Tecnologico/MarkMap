import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDeviceLocation } from '../hooks/useDeviceLocation';

describe('useDeviceLocation', () => {
  const requestWakeLockMock = vi.fn();
  const releaseWakeLockMock = vi.fn();
  const watchPositionMock = vi.fn();
  const clearWatchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    requestWakeLockMock.mockResolvedValue({
      release: releaseWakeLockMock,
    });

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: requestWakeLockMock },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
      },
      configurable: true,
      writable: true,
    });

    if (!('DeviceOrientationEvent' in window)) {
      Object.defineProperty(window, 'DeviceOrientationEvent', {
        value: Event,
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useDeviceLocation());
    expect(result.current.isTracking).toBe(false);
    expect(result.current.isAutoFollow).toBe(true);
    expect(result.current.heading).toBeNull();
    expect(result.current.sample).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('starts tracking and requests wakeLock if enabled', async () => {
    watchPositionMock.mockReturnValue(123);
    const { result } = renderHook(() => useDeviceLocation({ keepScreenAwake: true }));

    act(() => {
      result.current.startTracking();
    });

    expect(result.current.isTracking).toBe(true);
    expect(requestWakeLockMock).toHaveBeenCalledWith('screen');
    expect(watchPositionMock).toHaveBeenCalled();
  });

  it('stops tracking and releases wakeLock', async () => {
    watchPositionMock.mockReturnValue(123);
    const { result } = renderHook(() => useDeviceLocation({ keepScreenAwake: true }));

    await act(async () => {
      result.current.startTracking();
    });

    act(() => {
      result.current.stopTracking();
    });

    expect(result.current.isTracking).toBe(false);
    expect(clearWatchMock).toHaveBeenCalledWith(123);
    expect(releaseWakeLockMock).toHaveBeenCalled();
  });

  it('toggles auto-follow state', () => {
    const { result } = renderHook(() => useDeviceLocation());
    expect(result.current.isAutoFollow).toBe(true);

    act(() => {
      result.current.toggleAutoFollow();
    });
    expect(result.current.isAutoFollow).toBe(false);
  });

  it('updates heading on deviceorientation event', () => {
    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      const event = new Event('deviceorientation') as Event & {
        alpha?: number;
        absolute?: boolean;
      };
      Object.assign(event, { alpha: 90, absolute: true });
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(270);
  });

  it('handles iOS webkitCompassHeading orientation event', () => {
    const { result } = renderHook(() => useDeviceLocation());

    act(() => {
      const event = new Event('deviceorientation') as Event & {
        webkitCompassHeading?: number;
      };
      Object.assign(event, { webkitCompassHeading: 45.4 });
      window.dispatchEvent(event);
    });

    expect(result.current.heading).toBe(45);
  });
});
