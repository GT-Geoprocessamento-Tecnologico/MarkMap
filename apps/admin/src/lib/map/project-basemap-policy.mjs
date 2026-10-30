/**
 * Project basemap policy: downloaded regional packages are data/search inputs,
 * never visual tile sources. The existing MapLibre/OpenFreeMap style remains the
 * online backdrop and the existing neutral style handles loss of connectivity.
 *
 * Keep the old suppression of regional search when a georeferenced raster is
 * opened, until an explicit product decision changes that independent behavior.
 * No persistent user selection or downloaded artifact is deleted here.
 */
export function resolveProjectMapRegion({ selectedOfflineMapId = null, localRasterId = null } = {}) {
  return {
    searchRegionId: localRasterId ? null : selectedOfflineMapId,
    basemapRegionId: null,
  };
}