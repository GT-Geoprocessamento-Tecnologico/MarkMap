export const PIPELINE_VERSION: string;

export const PIPELINE_LIMITS: {
  readonly maxArtifactBytes: number;
  readonly maxPlaces: number;
  readonly maxShardBytes: number;
  readonly shardsPerLetter: number;
};

export class PipelineError extends Error {
  readonly code: string;
  constructor(message: string, code: string);
}

export interface PipelineRecord {
  id: string;
  name: string;
  normalized: string;
  type: string;
  category: string;
  lon: number;
  lat: number;
  description?: string;
}

export interface SearchShard {
  id: string;
  records: PipelineRecord[];
}

export interface PipelineArtifact {
  path: string;
  bytes: number;
  sha256: string;
  mediaType: string;
}

export interface PipelineSources {
  osm: string;
  attributions: Array<{ name: string; url: string }>;
}

export interface PipelineBlobRef {
  id: string;
  bytes: number;
  sha256: string;
  mediaType: string;
}
export interface PipelineManifest {
  id: string;
  version: string;
  label: string;
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  archive: PipelineBlobRef;
  style: { path: string; blob: PipelineBlobRef };
  glyphs: Array<{ path: string; blob: PipelineBlobRef }>;
  sprites: Array<{ path: string; blob: PipelineBlobRef }>;
  searchShards?: Array<{ path: string; blob: PipelineBlobRef }>;
  routingGraph?: { path: string; blob: PipelineBlobRef };
  contourLines?: { path: string; blob: PipelineBlobRef };
  attribution: string;
  createdAt: string;
  packageVersion: string;
  osmDataDate: string;
  capabilities: string[];
  checksums: { archive: string; style: string; glyphs: string[]; sprites: string[] };
  totalBytes: number;
  sources: PipelineSources;
  minimumCompatibleVersion: string;
  optionalComponents: { search: Record<string, never>; routing: { walk: boolean; bicycle: boolean; car: boolean }; elevation: boolean; contours: boolean };
}

export interface PipelineResult {
  dryRun: boolean;
  artifacts: PipelineArtifact[];
  manifest: PipelineManifest | null;
  warnings: string[];
  inputDir: string;
  outputDir: string;
}

export interface RunPipelineOptions {
  input?: string;
  output?: string;
  dryRun?: boolean;
  now?: Date;
}

export function sha256(bytes: Uint8Array | string): string;
export function normalizeName(name: unknown): string;
export function getShardId(normalized: string): string;
export function buildSearchShards(
  records: unknown,
  shardsPerLetter?: number,
): SearchShard[];
export function validateRoutingGraph(graph: unknown): {
  nodeCount: number;
  edgeCount: number;
};
export function validateContours(contours: unknown): {
  interval: number;
  majorInterval: number;
  count: number;
};
export function buildManifest(options: {
  id: string;
  label: string;
  bounds: number[];
  artifacts: Array<{ path: string; bytes: number; sha256: string; mediaType?: string }>;
  sources: PipelineSources;
  osmDataDate: string;
  packageVersion?: string;
  minZoom?: number;
  maxZoom?: number;
  minimumCompatibleVersion?: string;
  graphProfiles?: Array<'walk' | 'bicycle' | 'car'>;
  now?: Date;
}): PipelineManifest;
export function runPipeline(options: RunPipelineOptions): Promise<PipelineResult>;