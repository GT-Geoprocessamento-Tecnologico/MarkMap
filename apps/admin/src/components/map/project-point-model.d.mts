export interface ProjectPointLike {
  id?: string | number;
  layerId: string;
  geometry: { type: string; coordinates?: unknown } | null;
  properties: Record<string, unknown> | null;
}
export function projectPointTitle(point: Pick<ProjectPointLike, 'properties'>): string;
export function filterProjectPoints<T extends ProjectPointLike>(features: readonly T[], query?: string): T[];
export function updatedPointProperties(
  previous: Record<string, unknown>,
  rawName: string,
  rawDescription: string,
): Record<string, unknown>;