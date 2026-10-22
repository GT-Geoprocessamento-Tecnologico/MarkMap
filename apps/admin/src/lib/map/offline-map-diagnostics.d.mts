export type OfflineMapFailureKind = 'updated' | 'incomplete' | 'resource' | 'resources' | 'rendering' | 'network' | 'unknown';
export declare function describeOfflineMapFailure(input: unknown): {
  kind: OfflineMapFailureKind;
  message: string;
} | null;
