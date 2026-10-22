import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireOfflineProtocolLease } from '../apps/admin/src/lib/map/offline-protocol-leases.mjs';
import { configureMapWithRollback } from '../packages/maps/src/maplibre-setup.mjs';

function registry(failOn) {
  const actions = new Map();
  const additions = [];
  const removals = [];
  return {
    actions, additions, removals,
    addProtocol(name, fn) {
      additions.push(name);
      if (name === failOn) throw new Error('registration unavailable');
      if (actions.has(name)) throw new Error('duplicate global protocol: ' + name);
      actions.set(name, fn);
    },
    removeProtocol(name) { removals.push(name); actions.delete(name); },
  };
}

function session(reg, tag) {
  return acquireOfflineProtocolLease({
    addProtocol: reg.addProtocol,
    removeProtocol: reg.removeProtocol,
    createHandlers: id => ({
      tile: async ({ url }) => ({ data: tag + ':tile:' + id + ':' + url }),
      asset: async ({ url }) => ({ data: tag + ':asset:' + id + ':' + url }),
    }),
  });
}
const ctl = () => new AbortController();

test('A24 global pmtiles/resource schemes register once for overlapping mounts', async () => {
  const reg = registry();
  const old = session(reg,'old');
  const newer = session(reg,'new');
  assert.match(old.id,/^mk[a-z0-9]+$/);
  assert.match(newer.id,/^mk[a-z0-9]+$/);
  assert.notEqual(old.id,newer.id);
  assert.deepEqual(reg.additions,['pmtiles','geonexo-package']);
  const tile = reg.actions.get('pmtiles');
  const asset = reg.actions.get('geonexo-package');
  const oldResp = await tile({ url: `pmtiles://geonexo-offline:${old.id}/3/2/1` },ctl());
  const newResp = await tile({ url: `pmtiles://geonexo-offline:${newer.id}`,type:'json' },ctl());
  const oldGlyph = await asset({url:`geonexo-package://${old.id}/glyphs/0-255.pbf`},ctl());
  const newGlyph = await asset({url:`geonexo-package://${newer.id}/glyphs/0-255.pbf`},ctl());
  assert.match(oldResp.data,/^old:tile:/);
  assert.match(newResp.data,/^new:tile:/);
  assert.match(oldGlyph.data,/^old:asset:/);
  assert.match(newGlyph.data,/^new:asset:/);
  old.release();
  assert.equal(reg.actions.get('pmtiles'),tile);
  assert.equal(reg.actions.get('geonexo-package'),asset);
  assert.deepEqual(reg.removals,[]);
  await assert.rejects(tile({url:`pmtiles://geonexo-offline:${old.id}`},ctl()),e=>e.name==='AbortError');
  assert.match((await tile({url:`pmtiles://geonexo-offline:${newer.id}`},ctl())).data,/^new:/);
  newer.release();
  newer.release();
  assert.deepEqual(reg.removals,['pmtiles','geonexo-package']);
  assert.equal(reg.actions.size,0);
});

test('A24 old pending tile cannot resolve successfully after its map unmounts', async () => {
  const reg = registry();
  let done;
  const pending = new Promise(resolve=>{done=resolve});
  const old = acquireOfflineProtocolLease({
    addProtocol:reg.addProtocol,removeProtocol:reg.removeProtocol,
    createHandlers:()=>({tile:()=>pending,asset:async()=>({data:1})}),
  });
  const active = reg.actions.get('pmtiles');
  const request = active({url:`pmtiles://geonexo-offline:${old.id}/3/2/1`},ctl());
  const current = session(reg,'current');
  old.release();
  done({data:'obsolete'});
  await assert.rejects(request,e=>e.name==='AbortError');
  assert.match((await active({url:`pmtiles://geonexo-offline:${current.id}/3/2/1`},ctl())).data,/^current:/);
  current.release();
});

test('A24 unknown alias or aborted controller never touches another generation', async () => {
  const reg = registry();
  const lease = session(reg,'current');
  const tile = reg.actions.get('pmtiles'), asset = reg.actions.get('geonexo-package');
  await assert.rejects(tile({url:'pmtiles://https://remote.example/demo.pmtiles'},ctl()),e=>e.name==='AbortError');
  await assert.rejects(asset({url:'geonexo-package://mknotregistered/foo'},ctl()),e=>e.name==='AbortError');
  const aborted = ctl();aborted.abort();
  await assert.rejects(tile({url:`pmtiles://geonexo-offline:${lease.id}`},aborted),e=>e.name==='AbortError');
  lease.release();
});

test('A24 malformed handler factory does not register global protocols', () => {
  const reg = registry();
  assert.throws(() => acquireOfflineProtocolLease({
    addProtocol:reg.addProtocol,removeProtocol:reg.removeProtocol,
    createHandlers:()=>({tile: null, asset:null}),
  }),/Missing offline/);
  assert.deepEqual(reg.additions,[]);
  assert.equal(reg.actions.size,0);
});

test('A24 a failure on registering asset protocol rolls back PMTiles registration', () => {
  const failing = registry('geonexo-package');
  assert.throws(()=>session(failing,'bad'),/registration unavailable/);
  assert.equal(failing.actions.size,0);
  assert.deepEqual(failing.removals,['pmtiles']);
  const recovered = registry();
  const newLease = session(recovered,'valid');
  assert.ok(recovered.actions.has('pmtiles'));
  newLease.release();
});

test('A24 global protocols reinstall cleanly after final view unmounts', () => {
  const reg=registry();
  const first=session(reg,'first');
  first.release();
  const second=session(reg,'second');
  second.release();
  assert.equal(reg.additions.length,4);
  assert.equal(reg.removals.length,4);
});

test('A25 successful map control setup does not remove the map',()=>{
  let removed=0;
  const map={remove:()=>removed++};
  const result=configureMapWithRollback(map,()=>({map,controls:3}));
  assert.equal(result.map,map);
  assert.equal(result.controls,3);
  assert.equal(removed,0);
});

test('A25 failed synchronous map setup removes partial WebGL instance once',()=>{
  let removed=0;
  const map={remove:()=>removed++};
  const failure=new Error('map control failed');
  assert.throws(()=>configureMapWithRollback(map,()=>{throw failure}),e=>e===failure);
  assert.equal(removed,1);
});

test('A25 teardown failure never hides original initialization error',()=>{
  const map={remove(){throw Error('WebGL already detached')}};
  const failure=new Error('bad style');
  assert.throws(()=>configureMapWithRollback(map,()=>{throw failure}),e=>e===failure);
});

test('A25 invalid setup callback cannot mutate a map',()=>{
  assert.throws(()=>configureMapWithRollback({},()=>1),/Expected map/);
});

test('A26 releasing a map aborts an in-flight PMTiles handler without waiting for I/O', async () => {
  const reg = registry();
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  let inner;
  const lease = acquireOfflineProtocolLease({
    addProtocol: reg.addProtocol,
    removeProtocol: reg.removeProtocol,
    createHandlers: () => ({
      tile: async (_params, controller) => {
        inner = controller;
        started();
        return new Promise(() => {}); // underlying I/O is stalled
      },
      asset: async () => ({ data: 1 }),
    }),
  });
  const read = reg.actions.get('pmtiles')({ url: `pmtiles://geonexo-offline:${lease.id}/1/2/3` }, ctl());
  await startedPromise;
  lease.release();
  await assert.rejects(read, e => e.name === 'AbortError');
  assert.equal(inner.signal.aborted, true);
  assert.equal(reg.actions.size, 0);
});

test('A26 a released map cannot abort the still-active map or its asset requests', async () => {
  const reg = registry();
  const old = session(reg, 'old');
  let finish;
  let currentSignal;
  const next = acquireOfflineProtocolLease({
    addProtocol: reg.addProtocol,
    removeProtocol: reg.removeProtocol,
    createHandlers: () => ({
      tile: async () => ({ data: 'current' }),
      asset: async (_params, inner) => {
        currentSignal = inner;
        return new Promise(resolve => { finish = resolve; });
      },
    }),
  });
  const asset = reg.actions.get('geonexo-package');
  const pending = asset({ url: `geonexo-package://${next.id}/sprites/light.json` }, ctl());
  // Wait for the handler to receive its controller.
  while (!finish) await Promise.resolve();
  old.release();
  assert.equal(currentSignal.signal.aborted, false);
  finish({ data: 'still-valid' });
  assert.deepEqual(await pending, { data: 'still-valid' });
  next.release();
  assert.equal(reg.actions.size, 0);
});

test('A26 caller abort cancels only that request and keeps the lease usable', async () => {
  const reg = registry();
  let first = true;
  const lease = acquireOfflineProtocolLease({
    addProtocol: reg.addProtocol,
    removeProtocol: reg.removeProtocol,
    createHandlers: () => ({
      tile: async () => ({ data: 0 }),
      asset: async (_params, inner) => first ? (
        first = false,
        new Promise((_, reject) => inner.signal.addEventListener('abort', () => reject(new Error('aborted underlying read')), { once: true }))
      ) : ({ data: 2 }),
    }),
  });
  const action = reg.actions.get('geonexo-package');
  const controller = ctl();
  const pending = action({ url: `geonexo-package://${lease.id}/style.json` }, controller);
  while (first) await Promise.resolve();
  controller.abort();
  await assert.rejects(pending, e => e.name === 'AbortError');
  assert.deepEqual(await action({ url: `geonexo-package://${lease.id}/style.json` }, ctl()), { data: 2 });
  lease.release();
});

test('A26 MapLibre upstream abort listener is removed on resolve and reject', async () => {
  const reg = registry();
  const lease = acquireOfflineProtocolLease({
    addProtocol: reg.addProtocol,
    removeProtocol: reg.removeProtocol,
    createHandlers: () => ({
      tile: async () => ({ data: 1 }),
      asset: async () => { throw new Error('resource missing'); },
    }),
  });
  const observed = ctl();
  let active = 0;
  const add = observed.signal.addEventListener.bind(observed.signal);
  const remove = observed.signal.removeEventListener.bind(observed.signal);
  observed.signal.addEventListener = (...args) => { active++; return add(...args); };
  observed.signal.removeEventListener = (...args) => { active--; return remove(...args); };
  await reg.actions.get('pmtiles')({url:`pmtiles://geonexo-offline:${lease.id}`},observed);
  assert.equal(active, 0);
  await assert.rejects(reg.actions.get('geonexo-package')({url:`geonexo-package://${lease.id}/style.json`}, observed),/resource missing/);
  assert.equal(active, 0);
  lease.release();
});

test('A26 releasing one view while another is loading never leaks data across URLs', async () => {
  const reg = registry();
  const one = session(reg, 'region-1');
  const two = session(reg, 'region-2');
  const tile = reg.actions.get('pmtiles');
  one.release();
  await assert.rejects(tile({url:`pmtiles://geonexo-offline:${one.id}`}, ctl()), e => e.name === 'AbortError');
  const result = await tile({url:`pmtiles://geonexo-offline:${two.id}`}, ctl());
  assert.match(result.data, /^region-2:tile:/);
  two.release();
});
