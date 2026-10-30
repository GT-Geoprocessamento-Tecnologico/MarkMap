/** Transient rendering metadata: never persisted in a GIS feature or its outbox. */
export const PROJECT_POINT_RENDER_ID = '__markmap_project_point_render_id';

export function tagProjectPointForRender(feature) {
  if (typeof feature?.id !== 'string' || !feature.id ||
      feature.geometry?.type !== 'Point') return feature;
  const coords = feature.geometry.coordinates;
  if (!Array.isArray(coords) || coords.length < 2 ||
      !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return feature;
  return {
    ...feature,
    properties: { ...(feature.properties ?? {}), [PROJECT_POINT_RENDER_ID]: feature.id },
  };
}

/** A map click cannot open project editing for imported/unowned map points. */
export function resolveClickedProjectPointId(projectFeatures, clickedProperties) {
  if (!clickedProperties || typeof clickedProperties !== 'object') return null;
  const id = clickedProperties[PROJECT_POINT_RENDER_ID];
  if (typeof id !== 'string' || !id) return null;
  const found = projectFeatures.find(feature => feature?.id === id &&
    feature.geometry?.type === 'Point' && typeof feature.layerId === 'string');
  return found ? id : null;
}