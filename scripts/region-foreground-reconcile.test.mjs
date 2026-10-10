import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTick } from 'node:timers/promises';
import { subscribeRegionForeground, createRegionRevisionReconciler } from '../apps/admin/src/lib/storage/region-foreground-reconcile.mjs';

const tick = () => nextTick();

test('A18 foreground watcher fires on focus/pageshow/visibility only while visible', () => {
  const doc = new EventTarget();
  const win = new EventTarget();
  doc.visibilityState = 'hidden';
  let count = 0;
  const stop = subscribeRegionForeground(() => count++, doc, win);
  win.dispatchEvent(new Event('focus'));
  win.dispatchEvent(new Event('pageshow'));
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(count, 0);
  doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange'));
  win.dispatchEvent(new Event('focus'));
  win.dispatchEvent(new Event('pageshow'));
  assert.equal(count, 3);
  stop();
  win.dispatchEvent(new Event('focus'));
  assert.equal(count, 3);
});

test('A18 unchanged IndexedDB generation does not reinitialize MapLibre', async () => {
  let reads = 0;
  const changes = [];
  const monitor = createRegionRevisionReconciler({
    readSelection: () => 'region-a',
    readGeneration: async () => { reads++; return 'generation-a'; },
    onChanged: change => changes.push(change),
  });
  monitor.noteRendered('region-a', 'generation-a');
  await tick();
  await monitor.check();
  assert.equal(reads, 2);
  assert.deepEqual(changes, []);
  monitor.dispose();
});

test('A18 missed broadcast is recovered once after generation changes', async () => {
  let generation = 'generation-a';
  const changes = [];
  const monitor = createRegionRevisionReconciler({
    readSelection: () => 'region-a',
    readGeneration: async () => generation,
    onChanged: change => changes.push(change),
  });
  monitor.noteRendered('region-a', 'generation-a');
  await tick();
  generation = 'generation-b';
  await monitor.check();
  await monitor.check();
  assert.deepEqual(changes, [{ id: 'region-a', from: 'generation-a', to: 'generation-b' }]);
  monitor.noteRendered('region-a', 'generation-b');
  await tick();
  await monitor.check();
  assert.equal(changes.length, 1);
  monitor.dispose();
});

test('A18 missing selected region is distinguished from unavailable IndexedDB', async () => {
  const changes = [];
  const monitor = createRegionRevisionReconciler({
    readSelection: () => 'region-a',
    readGeneration: async () => null,
    onChanged: change => changes.push(change),
  });
  monitor.noteRendered('region-a', 'generation-a');
  await tick();
  assert.deepEqual(changes, [{ id: 'region-a', from: 'generation-a', to: null }]);
  monitor.dispose();

  let fails = 0;
  const errors = [];
  const monitor2 = createRegionRevisionReconciler({
    readSelection: () => 'region-a',
    readGeneration: async () => { if (!fails++) throw new Error('IDB locked'); return 'generation-b'; },
    onChanged: change => changes.push(change),
    onError: error => errors.push(error.message),
  });
  monitor2.noteRendered('region-a', 'generation-a');
  await tick();
  assert.deepEqual(errors, ['IDB locked']);
  assert.equal(changes.length, 1); // failure did not misclassify as deleted
  await monitor2.check();
  assert.equal(changes.length, 2);
  monitor2.dispose();
});

test('A18 selection changed during background read discards obsolete generation', async () => {
  let selected = 'region-a';
  let release;
  const firstRead = new Promise(resolve => { release = resolve; });
  let reads = 0;
  const changes = [];
  const monitor = createRegionRevisionReconciler({
    readSelection: () => selected,
    readGeneration: async () => { reads++; return reads === 1 ? firstRead : 'generation-b'; },
    onChanged: change => changes.push(change),
  });
  monitor.noteRendered('region-a', 'generation-a');
  selected = 'region-b';
  release('generation-obsolete');
  await tick();
  assert.deepEqual(changes, []);
  monitor.noteRendered('region-b', 'generation-b');
  await tick();
  assert.deepEqual(changes, []);
  monitor.dispose();
});

test('A18 dispose prevents late completion from notifying stale React views', async () => {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  const changes = [];
  const monitor = createRegionRevisionReconciler({
    readSelection: () => 'region-a',
    readGeneration: async () => promise,
    onChanged: change => changes.push(change),
  });
  monitor.noteRendered('region-a', 'generation-a');
  monitor.dispose();
  release('generation-b');
  await tick();
  assert.deepEqual(changes, []);
});

test('A18 foreground callback is a no-op without DOM and validates callbacks', () => {
  const stop = subscribeRegionForeground(() => {}, null, null);
  assert.doesNotThrow(stop);
  assert.throws(() => subscribeRegionForeground(null, null, null), /callback/);
  assert.throws(() => createRegionRevisionReconciler({ readSelection:null,readGeneration:null,onChanged:null }), /callbacks/);
});

test('A18 concurrent wakeups collapse to newest revision without duplicate resets', async () => {
  const changes = [];
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  let reads = 0;
  const monitor = createRegionRevisionReconciler({
    readSelection: () => 'region-a',
    readGeneration: async () => { reads++; return reads === 1 ? deferred : 'generation-c'; },
    onChanged: change => changes.push(change),
  });
  monitor.noteRendered('region-a', 'generation-a');
  await monitor.check(); // queued while first read is pending
  release('generation-b');
  await tick();
  assert.deepEqual(changes, [{ id: 'region-a', from: 'generation-a', to: 'generation-c' }]);
  monitor.dispose();
});
