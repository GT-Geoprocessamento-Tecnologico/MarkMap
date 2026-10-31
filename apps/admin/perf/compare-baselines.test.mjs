import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareBaselineLogs, parseBaselineLog } from './compare-baselines.mjs';

function sample(profile = 'chromium-emulated', changes = {}) {
  return {
    browserProfile: profile,
    kind: 'markmap-local-perf-baseline-v1',
    environment: 'browser-emulation',
    shellReadyMs: 100, mapReadyMs: 400, frames: 90, elapsedMs: 2000,
    fps: 45, frameP50Ms: 16, frameP95Ms: 30, heapMiB: null,
    capabilities: { cores: '3-4', memoryGb: '3-4', pixelRatio: '<=1.5', reducedMotion: false },
    ...changes,
  };
}
function log(...reports) {
  return `Unrelated console line\n${reports.map((report) => `  MARKMAP_LOCAL_PERF_BASELINE ${JSON.stringify(report)}`).join('\n')}\n`;
}

test('extracts known baseline records while ignoring unrelated application logs', () => {
  const parsed = parseBaselineLog(log(sample()));
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].metrics, {
    shellReadyMs: 100, mapReadyMs: 400, fps: 45,
    frameP50Ms: 16, frameP95Ms: 30, heapMiB: null,
  });
});
test('fails closed when no measured data are present', () => {
  assert.throws(() => parseBaselineLog('ordinary Playwright output only'), /No local performance samples/);
});
test('rejects malformed JSON without echoing private input', () => {
  const secret = 'https://private.example/?token=SECRET';
  assert.throws(() => parseBaselineLog(`MARKMAP_LOCAL_PERF_BASELINE {${secret}`), (err) => {
    assert.doesNotMatch(err.message, /SECRET|private/);
    return true;
  });
});
test('rejects missing metrics instead of reporting a fabricated improvement', () => {
  const { fps, ...invalid } = sample();
  assert.throws(() => parseBaselineLog(log(invalid)), /Invalid local performance sample/);
});
test('rejects nonfinite or negative performance measurements', () => {
  assert.throws(() => parseBaselineLog(log(sample('chromium-emulated', { fps: -1 }))), /Invalid local/);
  assert.throws(() => parseBaselineLog(log(sample('chromium-emulated', { mapReadyMs: null }))), /Invalid local/);
});
test('rejects unverified physical-device claims and unknown browser names', () => {
  assert.throws(() => parseBaselineLog(log(sample('chromium-emulated', { environment: 'android' }))), /Invalid local/);
  assert.throws(() => parseBaselineLog(log(sample('My Phone Pixel 77'))), /Invalid local/);
});
test('compares median of repeated samples and preserves before-after direction', () => {
  const before = log(sample('chromium-emulated', { mapReadyMs: 500, fps: 40 }), sample('chromium-emulated', { mapReadyMs: 400, fps: 50 }), sample('chromium-emulated', { mapReadyMs: 600, fps: 30 }));
  const after = log(sample('chromium-emulated', { mapReadyMs: 300, fps: 50 }), sample('chromium-emulated', { mapReadyMs: 200, fps: 55 }), sample('chromium-emulated', { mapReadyMs: 400, fps: 60 }));
  const group = compareBaselineLogs(before, after).profiles[0];
  assert.equal(group.beforeSamples, 3);
  assert.equal(group.afterSamples, 3);
  assert.deepEqual(group.metrics.mapReadyMs, { before: 500, after: 300, deltaPercent: -40 });
  assert.deepEqual(group.metrics.rafCadenceFps, { before: 40, after: 55, deltaPercent: 37.5 });
});
test('uses arithmetic median for an even number of repeated runs', () => {
  const before = log(sample('chromium-emulated', { mapReadyMs: 300 }), sample('chromium-emulated', { mapReadyMs: 700 }));
  const after = log(sample('chromium-emulated', { mapReadyMs: 200 }), sample('chromium-emulated', { mapReadyMs: 400 }));
  assert.deepEqual(compareBaselineLogs(before, after).profiles[0].metrics.mapReadyMs, {
    before: 500, after: 300, deltaPercent: -40,
  });
});
test('missing heap is reported as null, never as zero', () => {
  const comparison = compareBaselineLogs(log(sample()), log(sample()));
  assert.deepEqual(comparison.profiles[0].metrics.heapMiB, { before: null, after: null, deltaPercent: null });
});
test('a zero baseline never divides by zero or invents a percent change', () => {
  const before = log(sample('chromium-emulated', { shellReadyMs: 0 }));
  const after = log(sample('chromium-emulated', { shellReadyMs: 100 }));
  assert.deepEqual(compareBaselineLogs(before, after).profiles[0].metrics.shellReadyMs, {
    before: 0, after: 100, deltaPercent: null,
  });
});
test('does not compare mismatched browser profiles', () => {
  assert.throws(() => compareBaselineLogs(log(sample()), log(sample('webkit-emulated'))), /Browser profiles do not match/);
});
test('does not compare mismatched capabilities even if browser matches', () => {
  const after = sample('chromium-emulated', { capabilities: { ...sample().capabilities, cores: '9+' } });
  assert.throws(() => compareBaselineLogs(log(sample()), log(after)), /Device capabilities differ/);
});
test('does not combine different capability buckets within a single session', () => {
  const changed = sample('chromium-emulated', { capabilities: { ...sample().capabilities, reducedMotion: true } });
  assert.throws(() => compareBaselineLogs(log(sample(), changed), log(sample())), /Device capabilities differ/);
});
test('supports separate chromium and webkit comparisons without mixing samples', () => {
  const result = compareBaselineLogs(log(sample('webkit-emulated'), sample('chromium-emulated')), log(sample('chromium-emulated'), sample('webkit-emulated')));
  assert.deepEqual(result.profiles.map((x) => x.browserProfile), ['chromium-emulated', 'webkit-emulated']);
});
test('sanitizes unknown fields instead of copying private data into output', () => {
  const secret = 'secret-private-gps-coordinates';
  const report = compareBaselineLogs(log(sample('chromium-emulated', { userAgent: secret, latitude: secret })), log(sample('chromium-emulated', { projectId: secret })));
  assert.doesNotMatch(JSON.stringify(report), /secret-private|latitude|userAgent|projectId/);
});
test('CLI compares two local logs and never writes files or uploads reports', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'markmap-perf-'));
  try {
    const a = join(dir, 'before.log');
    const b = join(dir, 'after.log');
    await Promise.all([writeFile(a, log(sample())), writeFile(b, log(sample()))]);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./compare-baselines.mjs', import.meta.url)), a, b], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.kind, 'markmap-local-perf-comparison-v1');
    assert.equal(output.profiles.length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
