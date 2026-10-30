import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDatasetName } from './dataset-name.mjs';
test('preserves and appends GIS file extension when renamed',()=>{
 assert.equal(normalizeDatasetName('  Área Norte ', 'KML'),'Área Norte.kml');
 assert.equal(normalizeDatasetName('Pontos.GPX', 'GPX'),'Pontos.gpx');
 assert.equal(normalizeDatasetName('Talhões', 'GeoJSON'),'Talhões.geojson');
});
test('keeps distinct names and does not alter the source value',()=>{
 const raw='Dados2026';assert.equal(normalizeDatasetName(raw,'KMZ'),'Dados2026.kmz');assert.equal(raw,'Dados2026');
});
test('rejects traversal, path separators, control characters and empty input',()=>{
 for(const name of [' ','../abc','my\\file','a/b','x:\\tmp','bad\nline','.', '..'])assert.throws(()=>normalizeDatasetName(name,'KML'));
});
test('rejects invalid formats and excessive length',()=>{
 assert.throws(()=>normalizeDatasetName('x','TIFF'));
 assert.throws(()=>normalizeDatasetName('x'.repeat(121),'GPX'));
});