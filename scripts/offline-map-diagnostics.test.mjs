import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOfflineMapFailure } from '../apps/admin/src/lib/map/offline-map-diagnostics.mjs';
import { OfflineProtocolIntegrityError } from '../packages/maps/src/offline/offline-protocol-safety.mjs';

test('A23 cancelled maps do not show a false error after selection changes', () => {
  assert.equal(describeOfflineMapFailure(new DOMException('Canceled', 'AbortError')), null);
  assert.equal(describeOfflineMapFailure({error:{name:'AbortError',message:'unknown'}}), null);
  assert.equal(describeOfflineMapFailure({error:{code:'aborted',message:'Offline cancellation'}}), null);
});

test('A23 protocol failures produce stable actionable, localized messages', () => {
  for (const [code,kind] of [
    ['invalid-range','incomplete'],['truncated-range','incomplete'],['incomplete-read','incomplete'],
    ['missing-asset','resource'],['invalid-asset','resource'],['asset-too-large','resource'],
    ['invalid-url','resource'],['stale-active-generation','updated'],
  ]) {
    const issue=describeOfflineMapFailure(new OfflineProtocolIntegrityError(code,'Asset read failed'));
    assert.equal(issue.kind,kind);
    assert.ok(issue.message.length > 35);
  }
});

test('A23 fallback from structured error events works when prototype/code was lost', () => {
  assert.equal(describeOfflineMapFailure({error:{message:'Offline tile range is outside the archive'}}).kind,'incomplete');
  assert.equal(describeOfflineMapFailure({error:{message:'invalid offline package asset URL'}}).kind,'resource');
  assert.equal(describeOfflineMapFailure({error:{message:'WebGL context lost'}}).kind,'rendering');
  assert.equal(describeOfflineMapFailure({error:{message:'NetworkError when fetching tiles'}}).kind,'network');
});

test('A23 never echoes URLs, access tokens, or internal IndexedDB paths', () => {
  const secret='https://secret.example/?token=VERY_PRIVATE';
  for (const issue of [
    describeOfflineMapFailure({message:`Could not load ${secret}`}),
    describeOfflineMapFailure({error:{message:`PMTiles ${secret}`}}),
    describeOfflineMapFailure({name:'QuotaExceededError',message:secret}),
  ]) {
    assert.ok(issue);
    assert.equal(issue.message.includes(secret),false);
    assert.equal(issue.message.includes('VERY_PRIVATE'),false);
  }
});

test('A23 unspecified errors get a safe recovery action, not a false success', () => {
  assert.equal(describeOfflineMapFailure(new Error('unhandled map exception')).kind,'unknown');
  assert.equal(describeOfflineMapFailure(undefined).kind,'unknown');
});
