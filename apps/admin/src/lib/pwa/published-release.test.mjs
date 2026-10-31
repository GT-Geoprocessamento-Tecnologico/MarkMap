import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newerPublishedVersion } from './published-release.mjs';

test('reports only a genuinely newer release', () => {
  assert.equal(newerPublishedVersion({ appVersion: '0.5.20' }, 'v0.5.19'), '0.5.20');
  assert.equal(newerPublishedVersion({ appVersion: '1.0.0' }, 'v0.5.19'), '1.0.0');
  assert.equal(newerPublishedVersion({ appVersion: '0.6.0' }, 'v0.5.20'), '0.6.0');
});
test('same/older release cannot trigger an update prompt', () => {
  assert.equal(newerPublishedVersion({ appVersion: '0.5.20' }, 'v0.5.20'), null);
  assert.equal(newerPublishedVersion({ appVersion: '0.5.19' }, 'v0.5.20'), null);
  assert.equal(newerPublishedVersion({ appVersion: '0.4.99' }, 'v0.5.20'), null);
});
test('malformed and untrusted version metadata cannot trigger an update', () => {
  assert.equal(newerPublishedVersion({ appVersion: '<script />' }, 'v0.5.20'), null);
  assert.equal(newerPublishedVersion({ appVersion: '9999999999999.1.0' }, 'v0.5.20'), null);
  assert.equal(newerPublishedVersion({ appVersion: '0.5.21' }, 'bad'), null);
  assert.equal(newerPublishedVersion(null, 'v0.5.20'), null);
});
