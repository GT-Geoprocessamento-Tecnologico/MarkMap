import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureOfflineSourceLayers } from '../apps/admin/src/lib/map/offline-style-layers.mjs';

function fakeMap() {
  const sources=new Map(),layers=new Map();
  const operations=[];
  return {
    operations,sources,layers,
    getSource: id=>sources.get(id),
    addSource: (id,spec)=>{if(sources.has(id))throw Error('duplicate source');sources.set(id,spec);operations.push('source:'+id)},
    getLayer:id=>layers.get(id),
    addLayer:spec=>{if(layers.has(spec.id))throw Error('duplicate layer');layers.set(spec.id,spec);operations.push('layer:'+spec.id)},
  };
}
const entries=[{id:'fill',type:'fill',source:'data'},{id:'border',type:'line',source:'data'},{id:'points',type:'circle',source:'data'}];

test('A29 first hydration adds source and every layer once', () => {
  const m=fakeMap(),data={type:'geojson',data:{type:'FeatureCollection',features:[]}};
  assert.deepEqual(ensureOfflineSourceLayers(m,'data',data,entries),{sourceAdded:true,layersAdded:3});
  assert.deepEqual(m.operations,['source:data','layer:fill','layer:border','layer:points']);
});

test('A29 partial initialization repairs missing layers without replacing source or existing features', () => {
  const m=fakeMap(),data={features:['saved-field-point']};
  m.addSource('data',data);m.addLayer(entries[0]);
  assert.deepEqual(ensureOfflineSourceLayers(m,'data',{features:[]},entries),{sourceAdded:false,layersAdded:2});
  assert.equal(m.sources.get('data'),data);
  assert.deepEqual([...m.layers.keys()],['fill','border','points']);
});

test('A29 repeated style.load events never duplicate layers and sources', () => {
  const m=fakeMap();
  ensureOfflineSourceLayers(m,'data',{type:'geojson'},entries);
  const count=m.operations.length;
  for(let i=0;i<15;i++)assert.deepEqual(ensureOfflineSourceLayers(m,'data',{},entries),{sourceAdded:false,layersAdded:0});
  assert.equal(m.operations.length,count);
});

test('A29 style replacement rehydrates from new map state', () => {
  const m=fakeMap(),source={type:'geojson'};
  ensureOfflineSourceLayers(m,'data',source,entries);
  m.sources.clear();m.layers.clear();
  assert.deepEqual(ensureOfflineSourceLayers(m,'data',source,entries),{sourceAdded:true,layersAdded:3});
});

test('A29 a broken layer call does not hide its failure and next load repairs it', () => {
  const m=fakeMap();let fail=true;const original=m.addLayer;
  m.addLayer=(entry)=>{if(fail&&entry.id==='border'){fail=false;throw Error('context temporarily unavailable')} original(entry)};
  assert.throws(()=>ensureOfflineSourceLayers(m,'data',{},entries),/temporarily unavailable/);
  assert.deepEqual(ensureOfflineSourceLayers(m,'data',{},entries),{sourceAdded:false,layersAdded:2});
  assert.deepEqual([...m.layers.keys()],['fill','border','points']);
});

test('A29 invalid source/layer inputs fail before a destructive operation', () => {
  const m=fakeMap();
  assert.throws(()=>ensureOfflineSourceLayers(m,'',{},entries),/Expected/);
  assert.throws(()=>ensureOfflineSourceLayers(m,'data',{},[{type:'fill'}]),/Invalid overlay/);
});
