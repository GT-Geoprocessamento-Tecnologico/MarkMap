export interface MapDeviceHints {
  cores?: number;
  memoryGb?: number;
  devicePixelRatio?: number;
  reducedMotion?: boolean;
}
export interface MapPerformanceBudget {
  tier: 'constrained' | 'balanced' | 'capable';
  workerCount: number;
  pixelRatio: number;
  maxCanvasSize: [number, number];
  tileCacheZoomLevels: number;
  fadeDuration: number;
}
export function readMapDeviceHints(): MapDeviceHints;
export function adaptiveMapBudget(hints?: MapDeviceHints): MapPerformanceBudget;
