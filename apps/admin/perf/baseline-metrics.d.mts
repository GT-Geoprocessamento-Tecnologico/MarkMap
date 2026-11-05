export type CoarseDeviceHints = {
  cores: 'unknown' | '1-2' | '3-4' | '5-8' | '9+';
  memoryGb: 'unknown' | '<=2' | '3-4' | '5-8' | '>8';
  pixelRatio: 'unknown' | '<=1.5' | '1.5-2.5' | '>2.5';
  reducedMotion: boolean | null;
};
export type PerformanceHints = {
  cores?: number | null;
  memoryGb?: number | null;
  devicePixelRatio?: number | null;
  reducedMotion?: boolean | null;
};
export type FrameSummary = {
  frames: number;
  elapsedMs: number | null;
  fps: number | null;
  frameP50Ms: number | null;
  frameP95Ms: number | null;
};
export type LocalBaseline = FrameSummary & {
  kind: 'markmap-local-perf-baseline-v1';
  environment: 'browser-emulation' | 'unverified';
  shellReadyMs: number;
  mapReadyMs: number;
  heapMiB: number | null;
  capabilities: CoarseDeviceHints;
};
export declare function percentile(values: number[], fraction: number): number | null;
export declare function summarizeFrames(timestamps: number[]): FrameSummary;
export declare function coarseDeviceHints(hints?: PerformanceHints): CoarseDeviceHints;
export declare function createLocalBaseline(input: {
  shellReadyMs: number;
  mapReadyMs: number;
  frames: number[];
  usedHeapBytes?: number | null;
  hints?: PerformanceHints;
  runtime?: string;
}): LocalBaseline;
