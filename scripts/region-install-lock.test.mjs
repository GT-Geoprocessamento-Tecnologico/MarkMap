import test from 'node:test';
import assert from 'node:assert/strict';
import { withRegionInstallLock } from '../apps/admin/src/lib/storage/region-install-lock.mjs';

test('A7: same-region concurrent Web Lock rejects second action without modifying storage', async () => {
  const active = new Set();
  const manager = {
    async request(name, options, callback) {
      assert.equal(options.mode, 'exclusive');
      assert.equal(options.ifAvailable, true);
      if (active.has(name)) return callback(null);
      active.add(name);
      try { return await callback({ name }); }
      finally { active.delete(name); }
    },
  };
  let release;
  let started = 0;
  const hold = new Promise((resolve) => { release = resolve; });
  const first = withRegionInstallLock('regional-demo', async () => {
    started++;
    await hold;
    return 'installed';
  }, manager);
  const second = await withRegionInstallLock('regional-demo', async () => {
    started++;
    return 'incorrect second activation';
  }, manager);
  assert.equal(second.acquired, false);
  assert.equal(started, 1);
  release();
  assert.deepEqual(await first, { acquired: true, supported: true, result: 'installed' });
  assert.equal(active.size, 0);
});

test('A7: different regions may install independently and release locks on error', async () => {
  const held = new Set();
  const manager = { async request(name, _options, callback) {
    if (held.has(name)) return callback(null);
    held.add(name);
    try { return await callback({ name }); }
    finally { held.delete(name); }
  }};
  const one = await withRegionInstallLock('one', async () => 'ok', manager);
  const two = await withRegionInstallLock('two', async () => 'ok2', manager);
  assert.equal(one.result, 'ok');
  assert.equal(two.result, 'ok2');
  await assert.rejects(withRegionInstallLock('one', async () => { throw Error('quota'); }, manager), /quota/);
  assert.equal(held.size, 0);
});

test('A7: missing Web Locks falls back safely without claiming cross-tab exclusion', async () => {
  const result = await withRegionInstallLock('demo', async () => 12, null);
  assert.deepEqual(result, { acquired: true, supported: false, result: 12 });
  await assert.rejects(withRegionInstallLock('../traversal', async () => 1, null), /identity/);
});
