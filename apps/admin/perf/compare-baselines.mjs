import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MARKER = 'MARKMAP_LOCAL_PERF_BASELINE ';
const PROFILES = new Set(['chromium-emulated', 'webkit-emulated']);
const METRICS = [
  ['shellReadyMs', 'shellReadyMs'],
  ['mapReadyMs', 'mapReadyMs'],
  ['rafCadenceFps', 'fps'],
  ['frameP50Ms', 'frameP50Ms'],
  ['frameP95Ms', 'frameP95Ms'],
  ['heapMiB', 'heapMiB'],
];
const REQUIRED_HINTS = ['cores', 'memoryGb', 'pixelRatio', 'reducedMotion'];

function validNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizedSample(candidate) {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate) ||
      candidate.kind !== 'markmap-local-perf-baseline-v1' ||
      candidate.environment !== 'browser-emulation' ||
      !PROFILES.has(candidate.browserProfile) ||
      !Number.isSafeInteger(candidate.frames) || candidate.frames < 1 ||
      !validNumber(candidate.elapsedMs) || candidate.elapsedMs <= 0 ||
      !candidate.capabilities || typeof candidate.capabilities !== 'object' ||
      !REQUIRED_HINTS.every((key) => Object.hasOwn(candidate.capabilities, key)) ||
      !['unknown', '1-2', '3-4', '5-8', '9+'].includes(candidate.capabilities.cores) ||
      !['unknown', '<=2', '3-4', '5-8', '>8'].includes(candidate.capabilities.memoryGb) ||
      !['unknown', '<=1.5', '1.5-2.5', '>2.5'].includes(candidate.capabilities.pixelRatio) ||
      ![true, false, null].includes(candidate.capabilities.reducedMotion) ||
      !METRICS.every(([, name]) => (name === 'heapMiB' && candidate[name] === null) || validNumber(candidate[name]))) {
    throw new Error('Invalid local performance sample.');
  }
  return {
    browserProfile: candidate.browserProfile,
    capabilities: Object.fromEntries(REQUIRED_HINTS.map((key) => [key, candidate.capabilities[key]])),
    metrics: Object.fromEntries(METRICS.map(([, name]) => [name, candidate[name]])),
  };
}

/** Extract only the known performance record. Ignore arbitrary Playwright console lines. */
export function parseBaselineLog(log) {
  if (typeof log !== 'string') throw new TypeError('Expected local performance log text.');
  const lines = log.split(/\r?\n/).filter((line) => line.includes(MARKER));
  if (!lines.length) throw new Error('No local performance samples found.');
  return lines.map((line) => {
    const body = line.slice(line.indexOf(MARKER) + MARKER.length).trim();
    let candidate;
    try {
      candidate = JSON.parse(body);
    } catch {
      throw new Error('Invalid local performance JSON.');
    }
    return normalizedSample(candidate);
  });
}

function byProfile(samples) {
  const grouped = new Map();
  for (const sample of samples) {
    const group = grouped.get(sample.browserProfile) ?? [];
    if (group.length && JSON.stringify(group[0].capabilities) !== JSON.stringify(sample.capabilities)) {
      throw new Error('Device capabilities differ between samples.');
    }
    group.push(sample);
    grouped.set(sample.browserProfile, group);
  }
  return grouped;
}

function median(values) {
  if (values.some((value) => value === null)) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const value = ordered.length % 2 === 1
    ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  return Math.round(value * 100) / 100;
}

function difference(before, after) {
  if (before === null || after === null || before === 0) return null;
  return Math.round(((after - before) / before) * 10000) / 100;
}

/**
 * Compare like-for-like local benchmark logs. Never infer real-device equivalence
 * from coarse capability buckets or claim a statistically proven speedup.
 */
export function compareBaselineLogs(beforeLog, afterLog) {
  const before = byProfile(parseBaselineLog(beforeLog));
  const after = byProfile(parseBaselineLog(afterLog));
  if (before.size !== after.size || [...before.keys()].some((profile) => !after.has(profile))) {
    throw new Error('Browser profiles do not match.');
  }
  const profiles = [...before.keys()].sort().map((profile) => {
    const left = before.get(profile);
    const right = after.get(profile);
    if (JSON.stringify(left[0].capabilities) !== JSON.stringify(right[0].capabilities)) {
      throw new Error('Device capabilities differ between versions.');
    }
    const metrics = Object.fromEntries(METRICS.map(([label, key]) => {
      const a = median(left.map((sample) => sample.metrics[key]));
      const b = median(right.map((sample) => sample.metrics[key]));
      return [label, { before: a, after: b, deltaPercent: difference(a, b) }];
    }));
    return {
      browserProfile: profile,
      beforeSamples: left.length,
      afterSamples: right.length,
      capabilities: left[0].capabilities,
      metrics,
    };
  });
  return {
    kind: 'markmap-local-perf-comparison-v1',
    environment: 'browser-emulation',
    interpretation: 'Observed median changes only; rAF cadence is not GPU-rendered FPS. Matching capability buckets do not prove matching physical hardware.',
    profiles,
  };
}

/** CLI acceptance gate. Unit-level comparisons with fewer samples remain inspectable. */
function assertRepeatCount(comparison) {
  for (const profile of comparison.profiles) {
    if (profile.beforeSamples < 3 || profile.afterSamples < 3 ||
        profile.beforeSamples !== profile.afterSamples) {
      throw new Error('Local performance comparison needs three matched repeats per browser profile.');
    }
  }
}

async function main(args) {
  if (args.length !== 2) {
    console.error('Usage: node apps/admin/perf/compare-baselines.mjs before.log after.log');
    process.exitCode = 2;
    return;
  }
  try {
    const [before, after] = await Promise.all(args.map((file) => readFile(file, 'utf8')));
    const comparison = compareBaselineLogs(before, after);
    // Prevent a partially failed --repeat-each=3 benchmark from looking comparable.
    assertRepeatCount(comparison);
    console.log(JSON.stringify(comparison, null, 2));
  } catch {
    // Do not echo paths or input logs: they may contain private local details.
    console.error('Unable to compare local performance logs: missing, invalid or incompatible samples.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main(process.argv.slice(2));
}
