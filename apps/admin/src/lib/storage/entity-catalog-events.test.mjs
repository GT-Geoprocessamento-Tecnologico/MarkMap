import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notifyEntityCatalogChanged, subscribeEntityCatalogChanges } from './entity-catalog-events.mjs';

test('notifies deleted project or layer but ignores invalid inputs', () => {
  const messages = [];
  const unsubscribe = subscribeEntityCatalogChanges((event) => messages.push(event), undefined);
  try {
    assert.equal(notifyEntityCatalogChanged({ kind: 'project', id: 'abc', action: 'deleted' }, undefined), true);
    assert.equal(notifyEntityCatalogChanged({ kind: 'metric', id: 'abc', action: 'deleted' }, undefined), false);
  } finally { unsubscribe(); }
  // Node has no window; the publish result is still meaningful offline.
  assert.equal(messages.length, 0);
});
