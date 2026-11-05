import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeDeviceBackupCoverage } from './device-preflight.mjs';

const present = () => ({ status: 'fulfilled', value: { coverage: {
  status: 'pending', recordCount: null, reason: 'Dados ainda nao exportados',
} } });
const empty = () => ({ status: 'fulfilled', value: { coverage: {
  status: 'absent', recordCount: 0,
} } });
const rejected = (message = 'private-location-gps-token') => ({ status: 'rejected', reason: new Error(message) });
const report = (...values) => summarizeDeviceBackupCoverage(values);

test('reports unsupported databases with records as not included, never backed up', () => {
  const result = report(present(), empty(), present(), empty());
  assert.equal(result.fullBackup, false);
  assert.equal(result.missingSections, 2);
  assert.equal(result.uncertainSections, 0);
  assert.deepEqual(result.sections.map((s) => s.status), ['not-included', 'empty', 'not-included', 'empty']);
});

test('all-empty databases are still NOT a full-device backup', () => {
  const result = report(empty(), empty(), empty(), empty());
  assert.equal(result.fullBackup, false);
  assert.equal(result.missingSections, 0);
  assert.equal(result.uncertainSections, 0);
});

test('an IndexedDB opening error becomes unknown without exposing raw details', () => {
  const result = report(rejected(), empty(), empty(), empty());
  assert.equal(result.sections[0].status, 'unknown');
  assert.equal(result.uncertainSections, 1);
  assert.doesNotMatch(JSON.stringify(result), /private-location|gps-token/);
});

test('unexpected included status does NOT imply data was included by T3a', () => {
  const unexpected = { status: 'fulfilled', value: { coverage: { status: 'included', recordCount: 2 } } };
  const result = report(unexpected, empty(), empty(), empty());
  assert.equal(result.sections[0].status, 'unknown');
  assert.equal(result.fullBackup, false);
});

test('malformed pending coverage fails closed instead of claiming data safety', () => {
  for (const invalid of [
    { status: 'pending', recordCount: 0, reason: 'x' },
    { status: 'pending', recordCount: null, reason: '' },
    { status: 'absent', recordCount: 2 },
    { status: 'excluded', recordCount: null, reason: 'x' },
    null,
  ]) {
    const result = report({ status: 'fulfilled', value: { coverage: invalid } }, empty(), empty(), empty());
    assert.equal(result.sections[0].status, 'unknown');
  }
});

test('rejects incomplete result arrays', () => {
  for (const bad of [[], [empty()], [empty(), empty(), empty()], null, {}]) {
    assert.throws(() => summarizeDeviceBackupCoverage(bad), /quatro bancos/);
  }
});

test('stable order and no binary or project data is included in the result', () => {
  const secret = 'private-project-shape-data';
  const withRecords = { status: 'fulfilled', value: {
    coverage: { status: 'pending', recordCount: null, reason: 'has data' },
    records: [{ id: secret, bytes: new Uint8Array([1, 2, 3]) }],
  } };
  const output = report(withRecords, empty(), empty(), empty());
  assert.deepEqual(output.sections.map((s) => s.id), ['local-engine', 'meshes', 'large-blobs', 'offline-maps']);
  assert.doesNotMatch(JSON.stringify(output), /private-project|bytes|has data/);
});

test('per-category I/O failures are individually unknown rather than silently empty', () => {
  const output = report(rejected('secret 1'), present(), rejected('secret 2'), present());
  assert.equal(output.uncertainSections, 2);
  assert.equal(output.missingSections, 2);
  assert.deepEqual(output.sections.map((s) => s.status), ['unknown', 'not-included', 'unknown', 'not-included']);
});
