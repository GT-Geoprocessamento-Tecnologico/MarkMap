import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineMapRecovery, resolveOfflineBasemap } from '../apps/admin/src/lib/map/offline-map-recovery.mjs';

test('A20 foreground retries a failed local map only once', () => {
  let count = 0;
  const policy = createOfflineMapRecovery(() => { count++; });
  const error = { hasError: true, hasLocalContext: true };
  assert.equal(policy.onForeground(error), true);
  assert.equal(policy.onForeground(error), false);
  assert.equal(count, 1);
  policy.dispose();
  assert.equal(policy.onForeground(error), false);
  assert.equal(count, 1);
});

test('A20 ignores healthy, nonlocal and hidden foreground events', () => {
  let count = 0;
  const policy = createOfflineMapRecovery(() => { count++; });
  assert.equal(policy.onForeground({ hasError: false, hasLocalContext: true }), false);
  assert.equal(policy.onForeground({ hasError: true, hasLocalContext: false }), false);
  assert.equal(policy.onForeground({ hasError: true, hasLocalContext: true, visible: false }), false);
  assert.equal(policy.onForeground({ hasError: true, hasLocalContext: true }), true);
  assert.equal(count, 1);
});

test('A20 manual retry remains available after automatic budget is exhausted', () => {
  let count = 0;
  const policy = createOfflineMapRecovery(() => { count++; });
  assert.equal(policy.onForeground({hasError:true,hasLocalContext:true}), true);
  assert.equal(policy.retryManually(), true);
  assert.equal(policy.retryManually(), true);
  assert.equal(count, 3);
  policy.dispose();
  assert.equal(policy.retryManually(), false);
  assert.equal(count, 3);
});

test('A20 invalid callbacks are rejected', () => {
  assert.throws(() => createOfflineMapRecovery(null), /retry callback/);
});

test('A21 neutral fallback is local and scoped to selected region revision', () => {
  assert.deepEqual(resolveOfflineBasemap({regionId:'region-a',revision:3,neutralFor:'region-a:3'}), {
    regionId:null,neutralActive:true,
  });
  assert.deepEqual(resolveOfflineBasemap({regionId:'region-a',revision:4,neutralFor:'region-a:3'}), {
    regionId:'region-a',neutralActive:false,
  });
  assert.deepEqual(resolveOfflineBasemap({regionId:'region-b',revision:3,neutralFor:'region-a:3'}), {
    regionId:'region-b',neutralActive:false,
  });
});

test('A21 GeoPDF remains authoritative regardless of neutral fallback', () => {
  assert.deepEqual(resolveOfflineBasemap({regionId:'region-a',revision:3,neutralFor:'region-a:3',geoPdfId:'pdf-1'}), {
    regionId:null,neutralActive:false,
  });
  assert.deepEqual(resolveOfflineBasemap({regionId:null,revision:0,neutralFor:null}), {
    regionId:null,neutralActive:false,
  });
});
