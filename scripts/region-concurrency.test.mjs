import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesActiveRegionGeneration } from '../apps/admin/src/lib/storage/region-generation-guard.mjs';
import { notifyRegionCatalogChanged, subscribeRegionCatalogChanges } from '../apps/admin/src/lib/storage/region-catalog-events.mjs';
import { fingerprintRegionManifest, matchesRegionUpdatePreview } from '../apps/admin/src/lib/storage/region-update-identity.mjs';
import { describeRegionInstallError } from '../apps/admin/src/lib/storage/region-install-feedback.mjs';

const a = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const b = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const rows = (gen) => [{ packageId: 'r1', state: 'active', generation: gen }];

test('A14: initial snapshot permits update, second tab activation makes first stale', () => {
  assert.equal(matchesActiveRegionGeneration(rows(a), 'r1', a), true);
  assert.equal(matchesActiveRegionGeneration(rows(b), 'r1', a), false);
  assert.equal(matchesActiveRegionGeneration(rows(b), 'r1', b), true);
});

test('A14: deleted/replaced and duplicate active generations fail closed', () => {
  assert.equal(matchesActiveRegionGeneration([], 'r1', a), false);
  assert.equal(matchesActiveRegionGeneration([...rows(a), ...rows(a)], 'r1', a), false);
  assert.equal(matchesActiveRegionGeneration([{ packageId:'different',state:'active',generation:a }], 'r1', a), false);
  assert.equal(matchesActiveRegionGeneration(rows(a), 'r1', 'invalid'), false);
  assert.equal(matchesActiveRegionGeneration(rows(a), 'r1'), true); // user-initiated fresh import
});

test('A14: update preview also rejects concurrent activation with identical version and manifest', () => {
  const manifest = {id:'r1',packageVersion:'1.2.0',archive:{sha256:'abc',bytes:5}};
  const expected = {sourceUrl:'https://maps.example/r1/manifest.json',installedVersion:'1.1.0',
    installedGeneration:a,manifestFingerprint:fingerprintRegionManifest(manifest)};
  assert.equal(matchesRegionUpdatePreview(manifest,expected.sourceUrl,'1.1.0',expected,a),true);
  assert.equal(matchesRegionUpdatePreview(manifest,expected.sourceUrl,'1.1.0',expected,b),false);
  assert.equal(matchesRegionUpdatePreview(manifest,expected.sourceUrl,'1.1.0',{...expected,installedGeneration:undefined},a),false);
});

function fakeChannel() {
  const open = new Set();
  return class FakeBroadcastChannel {
    constructor(name) { this.name = name; this.onmessage = null; open.add(this); }
    postMessage(data) { for(const receiver of [...open]) if(receiver!==this&&receiver.name===this.name) receiver.onmessage?.({data}); }
    close() { open.delete(this); }
    static active() { return open.size; }
    static spoof(data) { for(const receiver of open) receiver.onmessage?.({data}); }
  };
}

test('A15: other tab receives change hint and unsubscribed listeners stop', () => {
  const Channel = fakeChannel();
  const ids = [];
  const stop = subscribeRegionCatalogChanges(id => ids.push(id),Channel);
  assert.equal(notifyRegionCatalogChanged('r1',Channel),true);
  assert.deepEqual(ids,['r1']);
  Channel.spoof({type:'delete-all',regionId:'r1'});
  Channel.spoof({type:'region-changed',regionId:'../../projects'});
  assert.deepEqual(ids,['r1']);
  stop();
  assert.equal(notifyRegionCatalogChanged('r2',Channel),true);
  assert.deepEqual(ids,['r1']);
  assert.equal(Channel.active(),0);
});

test('A15: BroadcastChannel unavailable never blocks package commits', () => {
  assert.equal(notifyRegionCatalogChanged('r1',null),false);
  const stop = subscribeRegionCatalogChanges(() => assert.fail('should not fire'),null);
  assert.doesNotThrow(stop);
  assert.equal(notifyRegionCatalogChanged('../unsafe',fakeChannel()),false);
});

test('A14: stale generation exposes actionable error without allowing retry on old approval', () => {
  const error=describeRegionInstallError('stale-active-generation');
  assert.equal(error.kind,'version');
  assert.equal(error.retryable,false);
  assert.match(error.message,/Outra aba/);
});
