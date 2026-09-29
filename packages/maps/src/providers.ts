import type { BasemapDefinition } from './types.js';

/**
 * Basemap registry. OpenFreeMap enters through configuration here, never
 * hardcoded in a page, so a future switch (self-host, PMTiles, Martin,
 * institutional source) is a config change, not a refactor.
 *
 * Source: https://openfreemap.org (no key, MapLibre-compatible).
 * Do NOT use tile.openstreetmap.org as a production dependency.
 */

export const OPENFREEMAP_ATTRIBUTION =
  '© OpenMapTiles © OpenStreetMap contributors';

const OPENFREEMAP_BASE = 'https://tiles.openfreemap.org/styles';

/** Default styles shipped for development. First entry is the default. */
export function getDefaultBasemaps(): BasemapDefinition[] {
  return [
    {
      id: 'openfreemap-liberty',
      label: 'OpenFreeMap Liberty',
      styleUrl: `${OPENFREEMAP_BASE}/liberty`,
      attribution: OPENFREEMAP_ATTRIBUTION,
    },
    {
      id: 'openfreemap-bright',
      label: 'OpenFreeMap Bright',
      styleUrl: `${OPENFREEMAP_BASE}/bright`,
      attribution: OPENFREEMAP_ATTRIBUTION,
    },
    {
      id: 'openfreemap-positron',
      label: 'OpenFreeMap Positron',
      styleUrl: `${OPENFREEMAP_BASE}/positron`,
      attribution: OPENFREEMAP_ATTRIBUTION,
    },
  ];
}

export interface BasemapRegistry {
  register(definition: BasemapDefinition): void;
  get(id: string): BasemapDefinition | null;
  list(): BasemapDefinition[];
  setActiveId(id: string): boolean;
  getActive(): BasemapDefinition | null;
  has(id: string): boolean;
}

/** Create an isolated registry preloaded with `initial` basemaps. */
export function createBasemapRegistry(
  initial: BasemapDefinition[] = getDefaultBasemaps(),
): BasemapRegistry {
  const byId = new Map<string, BasemapDefinition>();
  for (const definition of initial) {
    byId.set(definition.id, definition);
  }
  let activeId: string | null = initial.length > 0 && initial[0] !== undefined ? initial[0].id : null;

  return {
    register(definition: BasemapDefinition): void {
      byId.set(definition.id, definition);
      if (activeId === null) {
        activeId = definition.id;
      }
    },
    get(id: string): BasemapDefinition | null {
      return byId.get(id) ?? null;
    },
    list(): BasemapDefinition[] {
      return [...byId.values()];
    },
    setActiveId(id: string): boolean {
      if (!byId.has(id)) {
        return false;
      }
      activeId = id;
      return true;
    },
    getActive(): BasemapDefinition | null {
      if (activeId === null) {
        return null;
      }
      return byId.get(activeId) ?? null;
    },
    has(id: string): boolean {
      return byId.has(id);
    },
  };
}
