import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type {
  DrawChangeListener,
  DrawEngineLike,
  DrawFinishListener,
} from './draw-adapter.js';
import type { DrawModeId } from './types.js';

/**
 * Terra Draw wiring. Kept behind the DrawEngineLike boundary so pages never
 * import `terra-draw` directly and engine upgrades stay confined here.
 *
 * Official usage pattern (terra-draw examples, MIT-licensed):
 *   new TerraDraw({ adapter, modes: [...] }); draw.start();
 *   draw.setMode('point'); draw.on('change', ...); draw.getSnapshot();
 */

export interface TerraEngineArgs {
  /** Live MapLibre Map instance. */
  map: MapLibreMap;
  modes?: DrawModeId[];
}

/** Create an engine backed by Terra Draw. Browser only. */
export function createTerraDrawEngine(args: TerraEngineArgs): DrawEngineLike {
  const wanted: DrawModeId[] = args.modes ?? ['select', 'point', 'linestring', 'polygon'];
  const modes = [];
  if (wanted.includes('select')) {
    modes.push(new TerraDrawSelectMode());
  }
  if (wanted.includes('point')) {
    modes.push(new TerraDrawPointMode());
  }
  if (wanted.includes('linestring')) {
    modes.push(new TerraDrawLineStringMode());
  }
  if (wanted.includes('polygon')) {
    modes.push(new TerraDrawPolygonMode());
  }
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map: args.map }),
    modes,
  });
  const engine = {
    setMode(mode: string): void {
      draw.setMode(mode);
    },
    getSnapshot(): unknown {
      return draw.getSnapshot();
    },
    on(
      event: 'change' | 'finish',
      handler: DrawChangeListener | DrawFinishListener,
    ): void {
      if (event === 'change') {
        draw.on(event, handler as DrawChangeListener);
      } else {
        draw.on(event, handler as DrawFinishListener);
      }
    },
    off(
      event: 'change' | 'finish',
      handler: DrawChangeListener | DrawFinishListener,
    ): void {
      if (event === 'change') {
        draw.off(event, handler as DrawChangeListener);
      } else {
        draw.off(event, handler as DrawFinishListener);
      }
    },
    start(): void {
      draw.start();
    },
    stop(): void {
      draw.stop();
    },
  };
  return engine as DrawEngineLike;
}
