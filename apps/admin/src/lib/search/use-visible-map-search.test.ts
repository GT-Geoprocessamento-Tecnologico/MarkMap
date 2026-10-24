import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { useVisibleMapSearch } from './use-visible-map-search';

function fixture() {
  const listeners = new Map<string, Set<() => void>>();
  const map = {
    getStyle: () => ({ sources: { basemap: { type: 'vector', url: 'pmtiles://geonexo-offline:mkabc' } } }),
    getBounds: () => ({ contains: () => true }),
    querySourceFeatures: vi.fn((_source: string, options: { sourceLayer: string }) => options.sourceLayer === 'roads'
      ? [{ properties: { name: 'Avenida Filadélfia' }, geometry: { type: 'Point', coordinates: [-48.2, -7.2] } }] : []),
    on: (event: string, callback: () => void) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)!.add(callback); },
    off: (event: string, callback: () => void) => listeners.get(event)?.delete(callback),
  };
  return { map, listeners, ref: { current: map as unknown as MapLibreMap } };
}

afterEach(() => { vi.useRealTimers(); });
describe('visible local map search lifecycle', () => {
  it('indexes on opening, refreshes after movement, and clears when no local map is displayed', () => {
    vi.useFakeTimers();
    const f = fixture();
    const { result, rerender, unmount } = renderHook(({ region, revision }) =>
      useVisibleMapSearch(f.ref, region, revision, 1, true, true, 'Araguaína'),
    { initialProps: { region: 'br-araguaina' as string | null, revision: 1 } });
    expect(result.current).toEqual([]);
    act(() => { vi.advanceTimersByTime(180); });
    expect(result.current[0]?.name).toBe('Avenida Filadélfia · Araguaína');
    rerender({ region: 'br-araguaina', revision: 2 });
    expect(result.current).toEqual([]);
    act(() => { vi.advanceTimersByTime(180); });
    expect(result.current).toHaveLength(1);
    const before = f.map.querySourceFeatures.mock.calls.length;
    act(() => { for (const callback of f.listeners.get('moveend') ?? []) callback(); vi.advanceTimersByTime(180); });
    expect(f.map.querySourceFeatures.mock.calls.length).toBeGreaterThan(before);
    rerender({ region: null, revision: 2 });
    expect(result.current).toEqual([]);
    expect([...f.listeners.values()].every(callbacks => callbacks.size === 0)).toBe(true);
    unmount();
  });
  it('cancels pending work and listeners when the panel closes', () => {
    vi.useFakeTimers();
    const f = fixture();
    const { result, rerender, unmount } = renderHook(({ open }) =>
      useVisibleMapSearch(f.ref, 'br-araguaina', 1, 1, true, open, 'Araguaína'), { initialProps: { open: true } });
    rerender({ open: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toEqual([]);
    expect(f.map.querySourceFeatures).not.toHaveBeenCalled();
    expect([...f.listeners.values()].every(callbacks => callbacks.size === 0)).toBe(true);
    unmount();
  });
});
