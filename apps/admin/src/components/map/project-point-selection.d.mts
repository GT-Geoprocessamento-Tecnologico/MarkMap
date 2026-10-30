import type { ProjectMapFeature } from '../../pages/workspace/map-data';
export declare const PROJECT_POINT_RENDER_ID: string;
export declare function tagProjectPointForRender<T extends ProjectMapFeature>(feature: T): T;
export declare function resolveClickedProjectPointId(
  projectFeatures: readonly ProjectMapFeature[],
  clickedProperties: Record<string, unknown> | null | undefined,
): string | null;