import type { LayerEntry } from './types.js';

/**
 * Framework-free bookkeeping for sources/layers attached to the map.
 * Visibility maps to MapLibre `visibility: visible | none` layout property;
 * the controller applies it, this store only tracks intent (unit-testable).
 */

/** MapLibre layout value for a visibility flag. */
export function layerVisibilityLayoutValue(visible: boolean): 'visible' | 'none' {
  return visible ? 'visible' : 'none';
}

export interface LayerStore {
  add(entry: LayerEntry): void;
  remove(id: string): boolean;
  get(id: string): LayerEntry | null;
  list(): LayerEntry[];
  setVisibility(id: string, visible: boolean): boolean;
  isVisible(id: string): boolean;
  clear(): void;
}

export function createLayerStore(): LayerStore {
  const byId = new Map<string, LayerEntry>();

  return {
    add(entry: LayerEntry): void {
      byId.set(entry.id, { ...entry });
    },
    remove(id: string): boolean {
      return byId.delete(id);
    },
    get(id: string): LayerEntry | null {
      const entry = byId.get(id);
      return entry === undefined ? null : { ...entry };
    },
    list(): LayerEntry[] {
      return [...byId.values()].map((entry) => ({ ...entry }));
    },
    setVisibility(id: string, visible: boolean): boolean {
      const entry = byId.get(id);
      if (entry === undefined) {
        return false;
      }
      entry.visible = visible;
      return true;
    },
    isVisible(id: string): boolean {
      const entry = byId.get(id);
      return entry !== undefined && entry.visible;
    },
    clear(): void {
      byId.clear();
    },
  };
}
