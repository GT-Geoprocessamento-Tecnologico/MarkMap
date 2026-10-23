export interface ActiveGenerationRecord {
  packageId: string;
  state: string;
  generation: string;
}
export declare function matchesActiveRegionGeneration(
  rows: ActiveGenerationRecord[],
  packageId: string,
  expectedGeneration?: string,
): boolean;
