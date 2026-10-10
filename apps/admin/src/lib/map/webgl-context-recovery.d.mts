export interface WebglRecoveryBudget { autoRecoveryUsed: boolean }
export declare function createWebglContextRecovery(options: {
  onLost: () => void;
  onRestore: () => void;
  budget: WebglRecoveryBudget;
}): {
  lost(event?: { originalEvent?: { preventDefault?: () => void } }): boolean;
  restored(): boolean;
  dispose(): void;
};
