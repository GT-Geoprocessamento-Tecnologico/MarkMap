import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineStyleLifecycle } from '../apps/admin/src/lib/map/offline-style-lifecycle.mjs';

function harness({ existing = true, ready = false, loaded = false, missingMapMethods = false } = {}) {
  const callbacks = new Map();
  const history = [];
  let hasSource = existing;
  let isReady = ready;
  let mapLoaded = loaded;
  let checks = 0;
  const map = {
    loaded: () => mapLoaded,
    once(event, cb) { if (event !== 'render') throw Error('unexpected event'); callbacks.set(event, cb); },
    off(event, cb) { if (callbacks.get(event) === cb) callbacks.delete(event); },
    paint() { const render = callbacks.get('render'); callbacks.delete('render'); render?.(); },
    pending: () => callbacks.size,
  };
  if (!missingMapMethods) {
    map.getSource = id => id === 'local-dataset' && hasSource ? {type:'geojson'} : undefined;
    map.isSourceLoaded = id => { checks++; assert.equal(id,'local-dataset'); if (!hasSource) throw Error('unexpected query without source'); return isReady; };
  }
  const controller = createOfflineStyleLifecycle({
    map, isActive: () => true,
    onHydrate: () => history.push('hydrate'),
    onStyleReset: () => history.push('reset'),
    onReady: () => history.push('ready'),
    onError: error => history.push('error:'+error.message),
  });
  return { map, controller, history, setReady:v=>{isReady=v;}, setSource:v=>{hasSource=v;}, setLoaded:v=>{mapLoaded=v;}, checks:()=>checks };
}

test('A30 a preloaded local GeoJSON source reaches ready with no new sourcedata', () => {
  const h = harness({existing:true,ready:true});
  assert.equal(h.controller.styleLoad(),true);
  assert.equal(h.map.pending(),1);
  h.map.paint();
  assert.deepEqual(h.history,['reset','hydrate','ready']);
  h.controller.dispose();
});

test('A30 a preloaded and fully painted MapLibre style reports readiness immediately', () => {
  const h=harness({existing:true,ready:true,loaded:true});
  h.controller.styleLoad();
  assert.deepEqual(h.history,['reset','hydrate','ready']);
  assert.equal(h.map.pending(),0);
  h.controller.dispose();
});

test('A30 a local source still loading cannot be validated by stale sourcedata', () => {
  const h=harness({existing:true,ready:false});
  h.controller.styleLoad();
  assert.equal(h.controller.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),false);
  assert.equal(h.map.pending(),0);
  h.setReady(true);
  assert.equal(h.controller.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),true);
  h.map.paint();
  assert.equal(h.history.filter(v=>v==='ready').length,1);
  h.controller.dispose();
});

test('A30 source data invalidated before a queued render is never published', () => {
  const h=harness({existing:true,ready:true});
  h.controller.styleLoad();
  assert.equal(h.map.pending(),1);
  h.setReady(false);
  h.map.paint();
  assert.equal(h.history.filter(v=>v==='ready').length,0);
  h.setReady(true);
  h.controller.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  h.map.paint();
  assert.equal(h.history.filter(v=>v==='ready').length,1);
  h.controller.dispose();
});

test('A30 an unloaded source or missing source never creates fake ready', () => {
  const h=harness({existing:false,ready:true});
  h.controller.styleLoad();
  assert.equal(h.map.pending(),0);
  assert.equal(h.checks(),0);
  h.setSource(true);h.setReady(true);
  assert.equal(h.controller.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),true);
  h.map.paint();
  assert.equal(h.history.filter(v=>v==='ready').length,1);
  h.controller.dispose();
});

test('A30 a source-load query throwing during a style swap is treated as not ready', () => {
  const h=harness({existing:true,ready:true});
  h.map.isSourceLoaded=()=>{throw Error('style no longer available')};
  assert.equal(h.controller.styleLoad(),true);
  assert.equal(h.controller.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),false);
  assert.deepEqual(h.history,['reset','hydrate']);
  h.controller.dispose();
});

test('A30 restored WebGL rehydrates a preserved source without requiring sourcedata', () => {
  const h=harness({existing:true,ready:true});
  h.controller.styleLoad();
  h.controller.contextLost();
  assert.equal(h.map.pending(),0);
  h.controller.contextRestored();
  h.controller.styleLoad();
  assert.equal(h.map.pending(),1);
  h.map.paint();
  assert.deepEqual(h.history,['reset','hydrate','reset','hydrate','ready']);
  h.controller.dispose();
});

test('A30 a previously registered style listener receives no late events after disposal', () => {
  const h=harness({existing:true,ready:true});
  h.controller.styleLoad();
  h.controller.dispose();
  h.map.paint();
  assert.equal(h.history.includes('ready'),false);
});

test('A30 compatibility mode supports older event adapter with no source lookup methods', () => {
  const h=harness({missingMapMethods:true});
  h.controller.styleLoad();
  assert.equal(h.map.pending(),0);
  assert.equal(h.controller.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),true);
  h.map.paint();
  assert.equal(h.history.includes('ready'),true);
  h.controller.dispose();
});
