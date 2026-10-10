import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebglContextRecovery } from '../apps/admin/src/lib/map/webgl-context-recovery.mjs';

function setup(budget = { autoRecoveryUsed: false }) {
  const calls = [];
  let prevented = 0;
  const make = () => createWebglContextRecovery({
    onLost: () => calls.push('lost'),
    onRestore: () => calls.push('restored'),
    budget,
  });
  const event = { originalEvent: { preventDefault: () => { prevented++; } } };
  return { make, calls, event, prevented: () => prevented, budget };
}

test('A27 a lost context reports an actionable failure and prevents default', () => {
  const s = setup();
  const recovery = s.make();
  assert.equal(recovery.lost(s.event), true);
  assert.deepEqual(s.calls, ['lost']);
  assert.equal(s.prevented(), 1);
  assert.equal(recovery.lost(s.event), false); // coalesced duplicate
  assert.deepEqual(s.calls, ['lost']);
  recovery.dispose();
});

test('A27 one restored context triggers at most one automatic remount per scene', () => {
  const s = setup();
  const a = s.make();
  assert.equal(a.restored(), false);
  a.lost(s.event);
  assert.equal(a.restored(), true);
  assert.equal(s.budget.autoRecoveryUsed, true);
  a.dispose();
  // Remount with the SAME budget must not create a retry loop.
  const b = s.make();
  b.lost(s.event);
  assert.equal(b.restored(), false);
  assert.deepEqual(s.calls, ['lost', 'restored', 'lost']);
  b.dispose();
});

test('A27 a new selected map revision is eligible for its own one-time recovery', () => {
  const one = setup();
  const a = one.make();
  a.lost(one.event);
  a.restored();
  const next = setup();
  const b = next.make();
  b.lost(next.event);
  assert.equal(b.restored(), true);
  assert.deepEqual(next.calls, ['lost', 'restored']);
  a.dispose(); b.dispose();
});

test('A27 dispose silences stale WebGL events from a removed map instance', () => {
  const s = setup();
  const recovery = s.make();
  recovery.lost(s.event);
  recovery.dispose();
  assert.equal(recovery.restored(), false);
  assert.equal(recovery.lost(s.event), false);
  assert.deepEqual(s.calls, ['lost']);
  assert.equal(s.budget.autoRecoveryUsed, false);
});

test('A27 context restored without a previous loss never restarts healthy MapLibre', () => {
  const s = setup();
  const recovery = s.make();
  assert.equal(recovery.restored(), false);
  assert.deepEqual(s.calls, []);
  recovery.dispose();
});

test('A27 invalid callbacks/budgets are rejected before touching the renderer', () => {
  assert.throws(() => createWebglContextRecovery({onLost:null,onRestore:()=>{},budget:{autoRecoveryUsed:false}}),/Expected WebGL/);
  assert.throws(() => createWebglContextRecovery({onLost:()=>{},onRestore:()=>{},budget:{}}),/Expected WebGL/);
});
