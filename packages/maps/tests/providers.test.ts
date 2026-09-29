import { describe, expect, it } from 'vitest';

import { createBasemapRegistry, getDefaultBasemaps } from '../src/providers.js';

describe('basemap registry', () => {
  it('ships OpenFreeMap as configurable default, not hardcoded', () => {
    const defaults = getDefaultBasemaps();
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults[0]?.styleUrl).toContain('tiles.openfreemap.org');
    expect(defaults[0]?.attribution).toContain('OpenStreetMap');
  });

  it('registers and switches providers by config', () => {
    const registry = createBasemapRegistry();
    const first = registry.getActive();
    expect(first).not.toBeNull();

    registry.register({
      id: 'institutional',
      label: 'Fonte institucional',
      styleUrl: 'https://tiles.exemplo.gov.br/styles/base',
      attribution: 'Fonte institucional',
    });
    expect(registry.setActiveId('institutional')).toBe(true);
    expect(registry.getActive()?.id).toBe('institutional');
  });

  it('rejects unknown provider ids', () => {
    const registry = createBasemapRegistry();
    expect(registry.setActiveId('missing')).toBe(false);
    expect(registry.get('missing')).toBeNull();
  });
});
