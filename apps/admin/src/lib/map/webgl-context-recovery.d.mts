export interface WebglRecoveryBudget {
  autoRecoveryUsed: boolean;
}
export declare function createWebglContextRecovery(options: {
  onLost: () => void;
  onRestore: () => void;
  budget: WebglRecoveryBudget;
}): {
  lost(event?: { originalEvent?: { preventDefault?: () => void } }): boolean;
  restored(): boolean;
  dispose(): void;
};

export declare const WEBGL_CONTEXT_LOST_MESSAGE: string;
export declare function clearRecoveredWebglError(
  currentMessage: string | null,
): string | null;
export declare function canReportMapError(
  currentMessage: string | null,
): boolean;
