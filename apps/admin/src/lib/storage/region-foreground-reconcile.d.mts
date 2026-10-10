export interface RegionRevisionChange {
  id: string;
  from: string | null;
  to: string | null;
}
export declare function subscribeRegionForeground(
  onWake: () => void, doc?: Document, win?: Window,
): () => void;
export declare function createRegionRevisionReconciler(options: {
  readSelection: () => string | null;
  readGeneration: (id: string) => Promise<string | null>;
  onChanged: (change: RegionRevisionChange) => void;
  onError?: (error: unknown) => void;
}): {
  noteRendered(id: string | null, generation: string | null): void;
  check(): Promise<void>;
  resetPending(): void;
  dispose(): void;
};
