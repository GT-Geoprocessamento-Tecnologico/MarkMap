import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineStyleLifecycle } from '../apps/admin/src/lib/map/offline-style-lifecycle.mjs';

function mockMap() {
  const events = new Map();
  let loaded = false;
  let removals = 0;
  return {
    setLoaded(next) { loaded = next; },
    loaded: () => loaded,
    once(name, fn) { const list = events.get(name) || new Set(); list.add(fn); events.set(name, list); },
    off(name, fn) { if (events.get(name)?.delete(fn)) removals++; },
    emit(name) { const listeners = [...(events.get(name) ?? [])]; events.delete(name); for (const listener of listeners) listener(); },
    pending: name => events.get(name)?.size || 0,
    removals: () => removals,
  };
}
function setup() {
  const map = mockMap();
  const events = [];
  let active = true;
  const policy = createOfflineStyleLifecycle({
    map, isActive: () => active,
    onHydrate: () => events.push('hydrate'),
    onStyleReset: () => events.push('reset'),
    onReady: () => events.push('ready'),
    onError: error => events.push('error:' + error.message),
  });
  return {map,events,policy,setActive: value => {active=value;}};
}

test('A28 a local source becomes ready only after its next render frame', () => {
  const s=setup();
  assert.equal(s.policy.styleLoad(),true);
  assert.equal(s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),true);
  assert.deepEqual(s.events,['reset','hydrate']);
  assert.equal(s.map.pending('render'),1);
  s.map.emit('render');
  assert.deepEqual(s.events,['reset','hydrate','ready']);
  s.policy.dispose();
});

test('A28 repeated sourcedata cannot queue duplicate paints or ready updates', () => {
  const s=setup();s.policy.styleLoad();
  for(let i=0;i<30;i++)s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  assert.equal(s.map.pending('render'),1);
  s.map.emit('render');
  s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  assert.equal(s.events.filter(v=>v==='ready').length,1);
  s.policy.dispose();
});

test('A28 replacing a style drops its old pending render completion', () => {
  const s=setup();s.policy.styleLoad();s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  s.policy.styleLoad();
  assert.equal(s.map.pending('render'),0);
  assert.deepEqual(s.events,['reset','hydrate','reset','hydrate']);
  s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  s.map.emit('render');
  assert.equal(s.events.filter(v=>v==='ready').length,1);
  assert.equal(s.map.removals(),1);
  s.policy.dispose();
});

test('A28 while context is lost, style load and late frames cannot publish readiness', () => {
  const s=setup();s.policy.styleLoad();s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  s.policy.contextLost();
  assert.equal(s.map.pending('render'),0);
  assert.equal(s.policy.styleLoad(),false);
  assert.equal(s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),false);
  s.policy.contextRestored();s.policy.styleLoad();s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  s.map.emit('render');
  assert.equal(s.events.filter(v=>v==='ready').length,1);
  s.policy.dispose();
});

test('A28 a fast fully loaded style can publish once without waiting for another frame', () => {
  const s=setup();s.map.setLoaded(true);s.policy.styleLoad();
  s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  assert.equal(s.map.pending('render'),0);
  assert.equal(s.events.filter(v=>v==='ready').length,1);
  s.policy.dispose();
});

test('A28 disposal always removes scheduled render and ignores late source events', () => {
  const s=setup();s.policy.styleLoad();s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  s.policy.dispose();s.map.emit('render');
  assert.equal(s.map.pending('render'),0);
  assert.equal(s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),false);
  assert.equal(s.events.filter(v=>v==='ready').length,0);
});

test('A28 erroneous hydration is reported and does not publish a false ready status', () => {
  const map=mockMap();const errors=[];
  const l=createOfflineStyleLifecycle({map,isActive:()=>true,
    onHydrate:()=>{throw Error('partial layer error')}, onReady:()=>assert.fail('not ready'),
    onError:error=>errors.push(error.message),onStyleReset:()=>{},
  });
  assert.equal(l.styleLoad(),false);
  assert.equal(l.sourceData({sourceId:'local-dataset',isSourceLoaded:true}),false);
  assert.deepEqual(errors,['partial layer error']);
  l.dispose();
});

test('A28 inactive map never publishes a previous generation', () => {
  const s=setup();s.policy.styleLoad();s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  s.setActive(false);s.map.emit('render');
  assert.equal(s.events.filter(v=>v==='ready').length,0);
  s.policy.dispose();
});

test('A28 unrelated or unfinished source data is ignored', () => {
  const s=setup();s.policy.styleLoad();
  assert.equal(s.policy.sourceData({sourceId:'remote',isSourceLoaded:true}),false);
  assert.equal(s.policy.sourceData({sourceId:'local-dataset',isSourceLoaded:false}),false);
  assert.equal(s.map.pending('render'),0);s.policy.dispose();
});

test('A28 a synchronous local source event during style hydration is not lost', () => {
  const map=mockMap();const events=[];let policy;
  policy=createOfflineStyleLifecycle({
    map,isActive:()=>true,
    onHydrate:()=>{events.push('hydrate');policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});},
    onReady:()=>events.push('ready'),onError:()=>assert.fail('no error'),
  });
  assert.equal(policy.styleLoad(),true);
  assert.equal(map.pending('render'),1);
  map.emit('render');
  assert.deepEqual(events,['hydrate','ready']);
  policy.dispose();
});

test('A28 a destroyed WebGL map with failing event detach still disposes safely', () => {
  const map=mockMap();const errors=[];
  map.off=()=>{throw new Error('renderer already destroyed')};
  const policy=createOfflineStyleLifecycle({map,isActive:()=>true,
    onHydrate:()=>{},onReady:()=>{},onError:error=>errors.push(error),
  });
  policy.styleLoad();
  policy.sourceData({sourceId:'local-dataset',isSourceLoaded:true});
  assert.doesNotThrow(()=>policy.dispose());
  assert.deepEqual(errors,[]);
});
