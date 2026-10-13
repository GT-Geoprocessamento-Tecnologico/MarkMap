import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OfflineProtocolIntegrityError, assertOfflineByteRange, abortableOfflineRead,
  assertOfflineAssetBlob, assertOfflineReadLength,
} from '../packages/maps/src/offline/offline-protocol-safety.mjs';

const MB = 1024 * 1024;

test('A22 valid first, last and zero-length PMTiles ranges', () => {
  assert.doesNotThrow(() => assertOfflineByteRange(0, MB, MB, MB));
  assert.doesNotThrow(() => assertOfflineByteRange(MB, 0, MB, MB));
  assert.doesNotThrow(() => assertOfflineByteRange(MB - 1, 1, MB, MB));
});

test('A22 truncated PMTiles reads fail before File.slice', () => {
  for (const [offset, length, total, maximum] of [
    [MB - 1, 2, MB, MB], [MB + 1, 0, MB, MB], [0, MB + 1, MB, MB],
    [-1, 1, MB, MB], [0, -1, MB, MB], [Number.MAX_SAFE_INTEGER, 1, MB, MB],
    [NaN, 1, MB, MB], [0, 10, MB, 0], [0.5, 1, MB, MB],
  ]) {
    assert.throws(() => assertOfflineByteRange(offset, length, total, maximum),
      error => error instanceof OfflineProtocolIntegrityError);
  }
});

test('A22 asset reads verify Blob, limit and exact byte count', async () => {
  const blob = new Blob(['abc']);
  assert.equal(assertOfflineAssetBlob(blob, MB), blob);
  assert.equal(assertOfflineReadLength(await blob.arrayBuffer(), 3).byteLength, 3);
  assert.throws(() => assertOfflineAssetBlob('abc', MB), /Invalid offline/);
  assert.throws(() => assertOfflineAssetBlob(blob, 2), /too large/);
  assert.throws(() => assertOfflineReadLength(new ArrayBuffer(2), 3), /Incomplete/);
  assert.throws(() => assertOfflineReadLength(new Uint8Array(3), 3), /Incomplete/);
});

function trackingSignal() {
  const base = new AbortController();
  let active = 0;
  const signal = {
    get aborted() { return base.signal.aborted; },
    addEventListener(type, handler, options) {
      if (type === 'abort') active++;
      return base.signal.addEventListener(type, handler, options);
    },
    removeEventListener(type, handler) {
      if (type === 'abort') active--;
      return base.signal.removeEventListener(type, handler);
    },
  };
  return { signal, abort: () => base.abort(), count: () => active };
}

test('A22 aborted reads reject promptly and remove abort listeners', async () => {
  const ctl = trackingSignal();
  let resolve;
  const work = new Promise(r => { resolve = r; });
  const pending = abortableOfflineRead(work, ctl.signal);
  assert.equal(ctl.count(), 1);
  ctl.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(ctl.count(), 0);
  resolve(new ArrayBuffer(2));
});

test('A22 successful/failed reads also clean up abort listeners', async () => {
  const good = trackingSignal();
  const data = await abortableOfflineRead(Promise.resolve(42), good.signal);
  assert.equal(data, 42);
  assert.equal(good.count(), 0);
  const bad = trackingSignal();
  await assert.rejects(abortableOfflineRead(Promise.reject(new Error('idb')), bad.signal), /idb/);
  assert.equal(bad.count(), 0);
});

test('A22 already aborted request never completes successfully', async () => {
  const ctl = trackingSignal(); ctl.abort();
  await assert.rejects(abortableOfflineRead(Promise.resolve(42), ctl.signal), e => e.name === 'AbortError');
  assert.equal(ctl.count(), 0);
});
