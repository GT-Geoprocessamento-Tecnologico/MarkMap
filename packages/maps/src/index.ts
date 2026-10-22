export type {
  BasemapDefinition,
  DrawChangeEvent,
  DrawChangeHandler,
  DrawChangeType,
  DrawModeId,
  FitBoundsOptions,
  LayerEntry,
  MapStatus,
} from './types.js';
export type { BBox, GeoNexoFeature, MarkMapFeature } from './types.js';

export { createBasemapRegistry, getDefaultBasemaps, OPENFREEMAP_ATTRIBUTION } from './providers.js';
export type { BasemapRegistry } from './providers.js';

export { createLayerStore, layerVisibilityLayoutValue } from './layers.js';
export type { LayerStore } from './layers.js';

export {
  mapTerraDrawChange,
  resetFallbackIdCounterForTests,
  snapshotToFeatures,
  toGeoNexoFeature,
} from './draw-mapper.js';
export type { TerraChangeInput } from './draw-mapper.js';

export { createDrawAdapter } from './draw-adapter.js';
export type {
  DrawAdapter,
  DrawChangeListener,
  DrawEngineLike,
  DrawFeatureId,
  DrawFinishListener,
} from './draw-adapter.js';

export { createFallbackStyle, shouldFallbackOnError, FALLBACK_BACKGROUND_COLOR } from './fallback.js';
export type { FallbackStyle, MapErrorLike } from './fallback.js';

export { createGeoNexoMap, createMarkMap, createMarkMapMap } from './controller.js';
export type { GeoNexoMap, GeoNexoMapOptions, MarkMap, MarkMapMap, MarkMapMapOptions, MinimalMap } from './controller.js';

export { createMapLibreMap, toFitBounds } from './maplibre.js';
export type { CreateMapArgs } from './maplibre.js';

export { createTerraDrawEngine } from './terra.js';
export type { TerraEngineArgs } from './terra.js';

export * from './drawing.js';
export * from './track-buffer.js';
