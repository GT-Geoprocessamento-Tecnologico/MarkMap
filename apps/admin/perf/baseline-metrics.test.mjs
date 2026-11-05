import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentile, summarizeFrames, coarseDeviceHints, createLocalBaseline } from './baseline-metrics.mjs';

test('p50/p95 nearest-rank on unsorted frame samples', () => {
  assert.equal(percentile([40, 17, 16, 22], 0.5), 17);
  assert.equal(percentile([40, 17, 16, 22], 0.95), 40);
});
test('empty percentile is explicitly absent', () => assert.equal(percentile([], 0.95), null));
test('percentile rejects a nonsensical fraction', () => assert.throws(() => percentile([5], 2), RangeError));
test('percentile rejects NaN samples', () => assert.throws(() => percentile([NaN], 0.5), TypeError));
test('empty frame samples are absent rather than zero FPS', () => {
  assert.deepEqual(summarizeFrames([]), { frames: 0, elapsedMs: null, fps: null, frameP50Ms: null, frameP95Ms: null });
});
test('frame timings compute observed FPS, p50, p95 without a target', () => {
  assert.deepEqual(summarizeFrames([100, 116, 132, 164]), {
    frames: 3, elapsedMs: 64, fps: 46.88, frameP50Ms: 16, frameP95Ms: 32,
  });
});
test('non-monotonic frame sample fails loudly', () => {
  assert.throws(() => summarizeFrames([100, 100]), RangeError);
  assert.throws(() => summarizeFrames([100, 99]), RangeError);
});
test('partial capability signals are grouped without device IDs', () => {
  assert.deepEqual(coarseDeviceHints({ cores: 2, memoryGb: 2, devicePixelRatio: 3, reducedMotion: true }), {
    cores: '1-2', memoryGb: '<=2', pixelRatio: '>2.5', reducedMotion: true,
  });
});
test('unknown memory and hardware hints are not invented', () => {
  assert.deepEqual(coarseDeviceHints(), {
    cores: 'unknown', memoryGb: 'unknown', pixelRatio: 'unknown', reducedMotion: null,
  });
});
test('invalid capability hints never claim a high-end device', () => {
  assert.equal(coarseDeviceHints({ cores: Infinity, memoryGb: -1, devicePixelRatio: NaN }).cores, 'unknown');
  assert.equal(coarseDeviceHints({ cores: 6, memoryGb: 6 }).cores, '5-8');
});
test('baseline reports measured data with explicitly absent memory', () => {
  const report = createLocalBaseline({ shellReadyMs: 140.987, mapReadyMs: 850, frames: [100, 116, 132], hints: { cores: 4 }, runtime: 'browser-emulation' });
  assert.equal(report.kind, 'markmap-local-perf-baseline-v1');
  assert.equal(report.environment, 'browser-emulation');
  assert.equal(report.shellReadyMs, 140.99);
  assert.equal(report.heapMiB, null);
  assert.equal(report.capabilities.cores, '3-4');
  assert.equal(report.fps, 62.5);
  assert.equal(JSON.stringify(report).includes('userAgent'), false);
});
test('baseline refuses to claim success without map timing', () => {
  assert.throws(() => createLocalBaseline({ shellReadyMs: 100, mapReadyMs: NaN, frames: [1, 2] }), RangeError);
});
test('baseline refuses to claim success without actual frame samples', () => {
  assert.throws(() => createLocalBaseline({ shellReadyMs: 100, mapReadyMs: 200, frames: [] }), RangeError);
});
test('unknown environment is not mislabeled as physical device', () => {
  const report = createLocalBaseline({ shellReadyMs: 100, mapReadyMs: 200, frames: [1, 17], runtime: 'android' });
  assert.equal(report.environment, 'unverified');
});
test('frame sample does not persist data or call remote services', () => {
  const before = Object.keys(globalThis);
  createLocalBaseline({ shellReadyMs: 100, mapReadyMs: 200, frames: [1, 17] });
  assert.deepEqual(Object.keys(globalThis), before);
});
