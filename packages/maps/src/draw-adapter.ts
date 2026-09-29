import { mapTerraDrawChange } from './draw-mapper.js';
import type { DrawChangeEvent, DrawChangeHandler, DrawChangeType, DrawModeId } from './types.js';

/**
 * Draw adapter. Pages call `setMode('point' | 'linestring' | 'polygon')` and
 * subscribe to create/update/delete; Terra Draw internals never cross this
 * boundary.
 *
 * Listener shapes mirror terra-draw v1 (`ChangeListener`,
 * `FinishListener`) without importing it, so unit tests inject a fake and
 * the package tolerates engine upgrades with changes confined to terra.ts.
 */

export type DrawFeatureId = string | number;

export type DrawChangeListener = (ids: DrawFeatureId[], type: string) => void;

export type DrawFinishListener = (id: DrawFeatureId, context: { mode: string }) => void;

/** Minimal draw engine surface (implemented by terra.ts for production). */
export interface DrawEngineLike {
  setMode(mode: string): void;
  getSnapshot(): unknown;
  on(event: 'change', handler: DrawChangeListener): void;
  on(event: 'finish', handler: DrawFinishListener): void;
  off(event: 'change', handler: DrawChangeListener): void;
  off(event: 'finish', handler: DrawFinishListener): void;
  start(): void;
  stop(): void;
}

const ENGINE_MODE_BY_ID: Record<DrawModeId, string> = {
  select: 'select',
  point: 'point',
  linestring: 'linestring',
  polygon: 'polygon',
};

export interface DrawAdapter {
  setMode(mode: DrawModeId): void;
  getMode(): DrawModeId;
  getFeatures(): DrawChangeEvent['features'];
  destroy(): void;
}

/**
 * Attach engine notifications to a stable GeoJSON event stream.
 * Subscribes to `change` (create/update/delete with ids) and `finish`
 * (single completed feature with its mode), normalizing both through the
 * pure mapper.
 */
export function createDrawAdapter(
  engine: DrawEngineLike,
  emit: DrawChangeHandler,
): DrawAdapter {
  let mode: DrawModeId = 'select';
  let destroyed = false;

  function snapshot(): unknown {
    try {
      return engine.getSnapshot();
    } catch {
      return [];
    }
  }

  function handleChange(ids: DrawFeatureId[], type: string): void {
    if (destroyed) {
      return;
    }
    const change = normalizeChangeType(type);
    if (change === null) {
      return;
    }
    emit(mapTerraDrawChange({ type: change, ids: ids.map(String), snapshot: snapshot() }));
  }

  function handleFinish(id: DrawFeatureId, context: { mode: string }): void {
    if (destroyed) {
      return;
    }
    const finishedMode = normalizeModeId(context.mode);
    if (finishedMode === null || finishedMode === 'select') {
      return;
    }
    emit(mapTerraDrawChange({ type: 'create', ids: [String(id)], snapshot: snapshot() }));
  }

  engine.on('change', handleChange);
  engine.on('finish', handleFinish);
  engine.start();

  return {
    setMode(next: DrawModeId): void {
      if (destroyed) {
        return;
      }
      mode = next;
      engine.setMode(ENGINE_MODE_BY_ID[next]);
    },
    getMode(): DrawModeId {
      return mode;
    },
    getFeatures(): DrawChangeEvent['features'] {
      const input = snapshot();
      if (!Array.isArray(input)) {
        return [];
      }
      return mapTerraDrawChange({ type: 'update', ids: [], snapshot: input }).features;
    },
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      engine.off('change', handleChange);
      engine.off('finish', handleFinish);
      engine.stop();
    },
  };
}

function normalizeChangeType(context: string): DrawChangeType | null {
  switch (context) {
    case 'create':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
      return 'delete';
    default:
      return null;
  }
}

function normalizeModeId(context: string): DrawModeId | null {
  switch (context) {
    case 'select':
      return 'select';
    case 'point':
      return 'point';
    case 'linestring':
      return 'linestring';
    case 'polygon':
      return 'polygon';
    default:
      return null;
  }
}
