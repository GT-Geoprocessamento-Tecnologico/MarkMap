import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROJECT_POINT_RENDER_ID as KEY, tagProjectPointForRender, resolveClickedProjectPointId } from './project-point-selection.mjs';
const point = { type:'Feature', id:'p1', layerId:'field', geometry:{ type:'Point', coordinates:[-48.1,-7.2] }, properties: { name:'Marco', kind:'field' } };
test('tagging a project point does not mutate its durable attributes or geometry', () => {
  const tagged = tagProjectPointForRender(point);
  assert.notEqual(tagged, point);
  assert.equal(tagged.properties[KEY], 'p1');
  assert.equal(point.properties[KEY], undefined);
  assert.equal(tagged.geometry, point.geometry);
  assert.equal(tagged.properties.name, 'Marco');
});
test('ignores lines, invalid coordinates and non string identifiers', () => {
  const line = {...point, geometry:{type:'LineString',coordinates:[]}};
  const invalid = {...point, geometry:{type:'Point',coordinates:[Infinity,-7.2]}};
  assert.equal(tagProjectPointForRender(line), line);
  assert.equal(tagProjectPointForRender(invalid), invalid);
  assert.equal(tagProjectPointForRender({...point,id:42}).properties[KEY], undefined);
});
test('tap selects only an owned project point, not a dataset point', () => {
  const tagged = tagProjectPointForRender(point);
  assert.equal(resolveClickedProjectPointId([point], tagged.properties), 'p1');
  assert.equal(resolveClickedProjectPointId([point], { name:'Imported Point' }), null);
  assert.equal(resolveClickedProjectPointId([], tagged.properties), null);
  assert.equal(resolveClickedProjectPointId([{...point,id:'other'}], tagged.properties), null);
});
test('rejects forged non-point project IDs', () => {
  assert.equal(resolveClickedProjectPointId([{...point,geometry:{type:'Polygon',coordinates:[]}}], { [KEY]:'p1' }), null);
  assert.equal(resolveClickedProjectPointId([{...point,layerId:null}], { [KEY]:'p1' }), null);
});
test('null input is safe and does not change project features', () => {
  const before=JSON.stringify(point);
  assert.equal(resolveClickedProjectPointId([point], null), null);
  assert.equal(resolveClickedProjectPointId([point], {}), null);
  assert.equal(JSON.stringify(point), before);
});