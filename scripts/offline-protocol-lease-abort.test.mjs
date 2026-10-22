import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireOfflineProtocolLease } from '../apps/admin/src/lib/map/offline-protocol-leases.mjs';
import { abortableOfflineRead } from '../packages/maps/src/offline/offline-protocol-safety.mjs';

function protocolRegistry() {
  const handlers = new Map();
  return {
    handlers,
    addProtocol: (name, handler) => handlers.set(name, handler),
    removeProtocol: name => handlers.delete(name),
  };
}

test('A26 lease teardown aborts a pending offline asset resolver', async () => {
  const registry = protocolRegistry();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let releaseStorage;
  const lease = acquireOfflineProtocolLease({
    ...registry,
    createHandlers: id => ({
      tile: async () => ({ data: new ArrayBuffer(0) }),
      asset: async (_params, controller) => {
        const pendingStorage = new Promise(resolve => { releaseStorage = resolve; });
        started();
        return { data: await abortableOfflineRead(pendingStorage, controller.signal) };
      },
    }),
  });
  const upstream = new AbortController();
  const reading = registry.handlers.get('geonexo-package')(
    { url: `geonexo-package://${lease.id}/style.json` }, upstream,
  );
  await ready;
  lease.release();
  await assert.rejects(reading, error => error.name === 'AbortError');
  assert.equal(upstream.signal.aborted, false);
  assert.equal(registry.handlers.size, 0);
  releaseStorage(new ArrayBuffer(4));
});

test('A26 closing one map does not abort a second offline asset read', async () => {
  const registry = protocolRegistry();
  const createHandlers = label => () => ({
    tile: async () => ({ data: label }),
    asset: async (_params, controller) => ({
      data: await abortableOfflineRead(Promise.resolve(label), controller.signal),
    }),
  });
  const old = acquireOfflineProtocolLease({ ...registry, createHandlers: createHandlers('old') });
  const next = acquireOfflineProtocolLease({ ...registry, createHandlers: createHandlers('new') });
  old.release();
  const value = await registry.handlers.get('geonexo-package')(
    {url:`geonexo-package://${next.id}/glyphs/0-255.pbf`}, new AbortController(),
  );
  assert.equal(value.data, 'new');
  next.release();
});
