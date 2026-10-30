import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterProjectPoints, projectPointTitle, updatedPointProperties } from './project-point-model.mjs';

const point = (id, name, layerId = 'project-layer') => ({
  id, layerId, geometry: {type:'Point',coordinates:[-48.1,-7.2]},
  properties: {name, description:'Cerca norte', source:'survey'},
});

test('restricts management to persisted project Point features', () => {
  const data = [point('p1','Marco A'), point(2,'Imported'),
    {...point('l1','Linha'), geometry:{type:'LineString',coordinates:[]}},
    {...point('bad','Bad'), geometry:{type:'Point',coordinates:[Infinity,5]}},
    {...point('missing','Missing'), layerId:undefined}];
  assert.deepEqual(filterProjectPoints(data).map(p=>p.id),['p1']);
});
test('search is case insensitive over name and description', () => {
  const data=[point('a','Árvore'),point('b','Ponte')];
  assert.deepEqual(filterProjectPoints(data,'árv').map(p=>p.id),['a']);
  assert.deepEqual(filterProjectPoints(data,'CERCA').map(p=>p.id),['a','b']);
});
test('gives safe default name to legacy points', () => {
  assert.equal(projectPointTitle({properties:{name:'  '}}),'Ponto sem nome');
  assert.equal(projectPointTitle({properties:{label:' Marco 17 '}}),'Marco 17');
});
test('edit preserves custom attributes and removes intentionally empty description', () => {
  const current={name:'Antigo',description:'Nota', customCode:'x', alt:121};
  const updated=updatedPointProperties(current,'  Novo  ',' ');
  assert.deepEqual(updated,{name:'Novo',customCode:'x',alt:121});
  assert.equal(current.description,'Nota');
});
test('rejects empty names and oversized text without changing inputs', () => {
  assert.throws(()=>updatedPointProperties({},' ','a'),/nome/);
  assert.throws(()=>updatedPointProperties({},'x'.repeat(121),''),/120/);
  assert.throws(()=>updatedPointProperties({},'válido','a'.repeat(1201)),/1.200/);
});