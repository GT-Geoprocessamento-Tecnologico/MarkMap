import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyImportCatalogChanged, subscribeImportCatalogChanges } from './import-catalog-events.mjs';

test('evento invalido nao e transmitido e unsubscribe encerra o canal', () => {
  const received = [];
  class Channel {
    static channels = [];
    constructor() { this.onmessage = null; Channel.channels.push(this); }
    postMessage(data) { for (const channel of Channel.channels) if (channel !== this) channel.onmessage?.({ data }); }
    close() { Channel.channels = Channel.channels.filter((c) => c !== this); }
  }
  const stop = subscribeImportCatalogChanges((event) => received.push(event), Channel);
  assert.equal(notifyImportCatalogChanged({ kind: 'original', id: 'pdf-1', action: 'deleted' }, Channel), true);
  // A local tab does not process its own broadcast a second time.
  assert.deepEqual(received, []);
  assert.equal(notifyImportCatalogChanged({ kind: 'original', id: '\u0000', action: 'deleted' }, Channel), false);
  assert.deepEqual(received, []);
  const listener = Channel.channels[0];
  listener.onmessage({ data: { kind: 'original', id: 'pdf-1', action: 'deleted', origin: 'foreign-tab' } });
  assert.equal(received.length, 1);
  stop();
  assert.equal(Channel.channels.length, 0);
});
