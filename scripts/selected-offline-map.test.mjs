import test from 'node:test';
import assert from 'node:assert/strict';
import { getSelectedOfflineMapId, setSelectedOfflineMapId, subscribeSelectedOfflineMapId } from '../apps/admin/src/lib/storage/selected-offline-map.mjs';

function setup(t) {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const values = new Map();
  const store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const win = new EventTarget();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: store });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  t.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
  return { store, win, values };
}

test('A16: current tab receives one notification per actual selection change', (t) => {
  setup(t);
  const observed = [];
  const unsubscribe = subscribeSelectedOfflineMapId(() => observed.push(getSelectedOfflineMapId()));
  setSelectedOfflineMapId('region-1');
  setSelectedOfflineMapId('region-1'); // idempotent, no notification
  setSelectedOfflineMapId('region-2');
  setSelectedOfflineMapId(null);
  assert.deepEqual(observed, ['region-1', 'region-2', null]);
  unsubscribe();
  setSelectedOfflineMapId('region-3');
  assert.equal(observed.length, 3);
});

test('A16: other tab storage event invalidates selection without writing it', (t) => {
  const { store, win } = setup(t);
  let calls = 0;
  const unsubscribe = subscribeSelectedOfflineMapId(() => calls++);
  store.setItem('geonexo:selected-offline-map-package', 'region-b');
  const event = new Event('storage');
  Object.defineProperty(event, 'key', { value: 'geonexo:selected-offline-map-package' });
  win.dispatchEvent(event);
  assert.equal(getSelectedOfflineMapId(), 'region-b');
  assert.equal(calls, 1);
  const ignored = new Event('storage');
  Object.defineProperty(ignored, 'key', { value: 'unrelated' });
  win.dispatchEvent(ignored);
  assert.equal(calls, 1);
  const cleared = new Event('storage');
  Object.defineProperty(cleared, 'key', { value: null });
  win.dispatchEvent(cleared);
  assert.equal(calls, 2);
  unsubscribe();
});

test('A16: invalid IDs are rejected without deleting the old selection', (t) => {
  setup(t);
  setSelectedOfflineMapId('saved');
  assert.throws(() => setSelectedOfflineMapId('../unsafe'), /inválido/);
  assert.throws(() => setSelectedOfflineMapId(''), /inválido/);
  assert.equal(getSelectedOfflineMapId(), 'saved');
});

test('A16: unavailable localStorage is safe for reads and does not lie about writes', (t) => {
  setup(t);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied'); } });
  assert.equal(getSelectedOfflineMapId(), null);
  assert.throws(() => setSelectedOfflineMapId('saved'), /denied/);
});

// Reuse the A15 catalog event transport: selection events and catalog refreshes
// have distinct responsibilities; neither clears or rewrites region data.
const { notifyRegionCatalogChanged, subscribeRegionCatalogChanges } = await import('../apps/admin/src/lib/storage/region-catalog-events.mjs');
function fakeBroadcastChannel() {
  const open = new Set();
  return class FakeBroadcastChannel {
    constructor(name) { this.name = name; this.onmessage = null; open.add(this); }
    postMessage(data) { for (const receiver of [...open]) if (receiver !== this && receiver.name === this.name) receiver.onmessage?.({ data }); }
    close() { open.delete(this); }
  };
}

test('A17: same-region catalog changes refresh listeners without changing user selection', (t) => {
  setup(t);
  setSelectedOfflineMapId('current');
  let selectionEvents = 0;
  let catalogEvents = 0;
  const Channel = fakeBroadcastChannel();
  const leaveSelection = subscribeSelectedOfflineMapId(() => selectionEvents++);
  const leaveCatalog = subscribeRegionCatalogChanges((id) => {
    assert.equal(id, 'current');
    catalogEvents++;
  }, Channel);
  assert.equal(notifyRegionCatalogChanged('current', Channel), true);
  assert.equal(catalogEvents, 1);
  assert.equal(selectionEvents, 0);
  assert.equal(getSelectedOfflineMapId(), 'current');
  leaveCatalog(); leaveSelection();
});

test('A18: missed storage event is reconciled on focus once, without overwriting selection', (t) => {
  const { store, win } = setup(t);
  const values = [];
  const unsubscribe = subscribeSelectedOfflineMapId(() => values.push(getSelectedOfflineMapId()));
  // This simulates another tab committing a change while WebView is suspended.
  store.setItem('geonexo:selected-offline-map-package', 'resumed-region');
  win.dispatchEvent(new Event('focus'));
  win.dispatchEvent(new Event('pageshow'));
  assert.deepEqual(values, ['resumed-region']);
  assert.equal(getSelectedOfflineMapId(), 'resumed-region');
  unsubscribe();
});
