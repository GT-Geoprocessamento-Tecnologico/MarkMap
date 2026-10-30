export interface ProjectMapRegionSelection {
  searchRegionId: string | null;
  basemapRegionId: null;
}
export function resolveProjectMapRegion(input?: {
  selectedOfflineMapId?: string | null;
  localRasterId?: string | null;
}): ProjectMapRegionSelection;