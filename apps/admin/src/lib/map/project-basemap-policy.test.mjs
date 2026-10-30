import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectMapRegion } from './project-basemap-policy.mjs';

test('a downloaded map remains available for structured offline search', () => {
  assert.deepEqual(resolveProjectMapRegion({ selectedOfflineMapId: 'region-to' }), {
    searchRegionId: 'region-to', basemapRegionId: null,
  });
});

test('a downloaded region can never override the OpenFreeMap basemap', () => {
  for (const id of ['region-to', 'region-sp', '', '../unsafe']) {
    assert.equal(resolveProjectMapRegion({ selectedOfflineMapId: id }).basemapRegionId, null);
  }
});

test('georeferenced local rasters still take priority over regional data search', () => {
  assert.deepEqual(resolveProjectMapRegion({ selectedOfflineMapId: 'region-to', localRasterId: 'local-pdf' }), {
    searchRegionId: null, basemapRegionId: null,
  });
});

test('no package selected leaves the map online and the local project data usable', () => {
  assert.deepEqual(resolveProjectMapRegion(), { searchRegionId: null, basemapRegionId: null });
});

test('does not mutate or clear the downloaded-package selection', () => {
  const selection = { selectedOfflineMapId: 'region-mg', localRasterId: null };
  const snapshot = JSON.stringify(selection);
  resolveProjectMapRegion(selection);
  assert.equal(JSON.stringify(selection), snapshot);
});