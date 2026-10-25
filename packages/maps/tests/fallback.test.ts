import { describe, expect, it } from 'vitest';

import { FALLBACK_BACKGROUND_COLOR, createFallbackStyle, shouldFallbackOnError } from '../src/fallback.js';

describe('basemap fallback', () => {
  it('builds a local blank style with default color', () => {
    const style = createFallbackStyle();
    expect(style.version).toBe(8);
    expect(style.layers.length).toBe(1);
    expect(style.layers[0]?.type).toBe('background');
    expect(style.layers[0]?.paint['background-color']).toBe(FALLBACK_BACKGROUND_COLOR);
  });

  it('builds a local blank style with custom color', () => {
    const customColor = '#123456';
    const style = createFallbackStyle(customColor);
    expect(style.version).toBe(8);
    expect(style.layers.length).toBe(1);
    expect(style.layers[0]?.type).toBe('background');
    expect(style.layers[0]?.paint['background-color']).toBe(customColor);
  });

  it('falls back on style/network failures', () => {
    expect(shouldFallbackOnError({ error: { message: 'Failed to fetch style' } })).toBe(true);
    expect(shouldFallbackOnError({ error: { status: 0 } })).toBe(true);
    expect(shouldFallbackOnError({ error: { status: 503 } })).toBe(true);
    expect(shouldFallbackOnError({ error: { message: 'NetworkError when loading tiles' } })).toBe(
      true,
    );
  });

  it('ignores tile 404 noise and unknown shapes', () => {
    expect(shouldFallbackOnError({ sourceId: 'tiles', error: { status: 404 } })).toBe(false);
    expect(shouldFallbackOnError({ error: { status: 404 } })).toBe(false);
    expect(shouldFallbackOnError(null)).toBe(false);
    expect(shouldFallbackOnError({})).toBe(false);
  });
});
