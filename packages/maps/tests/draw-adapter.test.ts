import { describe, expect, it, vi } from 'vitest';

import { createDrawAdapter } from '../src/draw-adapter.js';
import type {
  DrawChangeListener,
  DrawEngineLike,
  DrawFeatureId,
  DrawFinishListener,
} from '../src/draw-adapter.js';

function createFakeEngine(snapshot: unknown): DrawEngineLike & {
  modes: string[];
  started: boolean;
  emitChange(ids: DrawFeatureId[], type: string): void;
  emitFinish(id: DrawFeatureId, mode: string): void;
} {
  const changeListeners: DrawChangeListener[] = [];
  const finishListeners: DrawFinishListener[] = [];
  const fake = {
    modes: [] as string[],
    started: false,
    setMode(mode: string): void {
      fake.modes.push(mode);
    },
    getSnapshot(): unknown {
      return snapshot;
    },
    on(
      event: 'change' | 'finish',
      handler: DrawChangeListener | DrawFinishListener,
    ): void {
      if (event === 'change') {
        changeListeners.push(handler as DrawChangeListener);
      } else {
        finishListeners.push(handler as DrawFinishListener);
      }
    },
    off(
      event: 'change' | 'finish',
      handler: DrawChangeListener | DrawFinishListener,
    ): void {
      if (event === 'change') {
        const index = changeListeners.indexOf(handler as DrawChangeListener);
        if (index >= 0) {
          changeListeners.splice(index, 1);
        }
      } else {
        const index = finishListeners.indexOf(handler as DrawFinishListener);
        if (index >= 0) {
          finishListeners.splice(index, 1);
        }
      }
    },
    start(): void {
      fake.started = true;
    },
    stop(): void {
      fake.started = false;
    },
    emitChange(ids: DrawFeatureId[], type: string): void {
      for (const handler of [...changeListeners]) {
        handler(ids, type);
      }
    },
    emitFinish(id: DrawFeatureId, mode: string): void {
      for (const handler of [...finishListeners]) {
        handler(id, { mode });
      }
    },
  };
  return fake as DrawEngineLike & {
    modes: string[];
    started: boolean;
    emitChange(ids: DrawFeatureId[], type: string): void;
    emitFinish(id: DrawFeatureId, mode: string): void;
  };
}

const snapshot = [
  {
    id: 'p1',
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[-48, -16], [-47, -16], [-47, -15], [-48, -16]]] },
    properties: {},
  },
];

describe('draw adapter', () => {
  it('exposes draw modes without leaking engine internals', () => {
    const fake = createFakeEngine(snapshot);
    const emit = vi.fn();
    const adapter = createDrawAdapter(fake, emit);
    adapter.setMode('polygon');
    expect(adapter.getMode()).toBe('polygon');
    expect(fake.modes).toContain('polygon');
    adapter.setMode('point');
    expect(fake.modes).toContain('point');
    adapter.destroy();
  });

  it('forwards engine change events as stable GeoJSON', () => {
    const fake = createFakeEngine(snapshot);
    const emit = vi.fn();
    const adapter = createDrawAdapter(fake, emit);
    fake.emitChange(['p1'], 'create');
    expect(emit).toHaveBeenCalledTimes(1);
    const first = emit.mock.calls[0]?.[0];
    expect(first?.type).toBe('create');
    expect(first?.ids).toEqual(['p1']);
    adapter.destroy();
  });

  it('emits create when a drawing finishes', () => {
    const fake = createFakeEngine(snapshot);
    const emit = vi.fn();
    const adapter = createDrawAdapter(fake, emit);
    fake.emitFinish('p1', 'polygon');
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]?.[0].type).toBe('create');
    adapter.destroy();
  });

  it('ignores unknown change contexts', () => {
    const fake = createFakeEngine(snapshot);
    const emit = vi.fn();
    const adapter = createDrawAdapter(fake, emit);
    fake.emitChange(['p1'], 'styling');
    expect(emit).not.toHaveBeenCalled();
    adapter.destroy();
  });
});
