import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const workerPath = new URL('../public/sw.js', import.meta.url);
const origin = 'https://markmap.example';
const approvedName = 'markmap-cache-v2';
const approvedKey = '/__markmap_approved_shell_v1__';
const completeKey = '/__geonexo_install_complete__';

async function harness({ offline = false, approval = true, missingBundle = false } = {}) {
  const listeners = new Map();
  let networkReads = 0;
  let writes = 0;
  const stores = new Map();
  const cacheStore = (name) => {
    if (!stores.has(name)) {
      const entries = new Map();
      stores.set(name, {
        async match(request) {
          const path = new URL(typeof request === 'string' ? request : request.url, origin).pathname;
          return entries.get(path)?.clone();
        },
        async put(request, response) {
          const path = new URL(typeof request === 'string' ? request : request.url, origin).pathname;
          writes += 1;
          entries.set(path, response.clone());
        },
        seed(path, response) { entries.set(path, response); },
      });
    }
    return stores.get(name);
  };
  const approved = cacheStore(approvedName);
  approved.seed(completeKey, new Response('ok'));
  approved.seed('/index.html', new Response('<html><script src="/assets/main-a1b2c3d4.js"></script>approved app shell</html>', { headers: { 'Content-Type': 'text/html' } }));
  if (!missingBundle) approved.seed('/assets/main-a1b2c3d4.js', new Response('approved bundle'));
  if (approval) {
    cacheStore('markmap-shell-approval-v1').seed(approvedKey, new Response(JSON.stringify({
      protocol: 1, cache: approvedName, appVersion: '0.5.21', buildSha: 'a'.repeat(40),
    }), { headers: { 'Content-Type': 'application/json' } }));
  }
  const caches = { async open(name) { return cacheStore(name); }, async keys() { return [...stores.keys()]; } };
  const fetch = async () => {
    networkReads++;
    if (offline) throw new TypeError('offline');
    return new Response('network document', { status: 200, headers: { 'Content-Type': 'text/html' } });
  };
  const self = {
    location: { origin },
    addEventListener(type, handler) { listeners.set(type, handler); },
  };
  const source = await readFile(workerPath, 'utf8');
  runInNewContext(source, { self, caches, fetch, Response, URL, Date, Promise, console });

  async function navigate(path, { method = 'GET', mode = 'navigate' } = {}) {
    const request = { url: new URL(path, origin).href, mode, method };
    let pending = null;
    const event = {
      request,
      respondWith(response) { pending = Promise.resolve(response); },
      waitUntil(promise) { Promise.resolve(promise).catch(() => {}); },
    };
    listeners.get('fetch')(event);
    return pending ? await pending : null;
  }
  return { navigate, get writes() { return writes; }, get networkReads() { return networkReads; } };
}

test('PWA: approved shell handles only real SPA navigation routes, never network-first HTML', async () => {
  const sw = await harness();
  for (const route of ['/', '/mesh', '/projects', '/projects/example/map', '/app',
    '/app/mesh', '/app/projects/example/mesh', '/app/settings']) {
    const response = await sw.navigate(route);
    assert.equal(response?.status, 200, route);
    assert.match(await response.text(), /approved app shell/, route);
  }
  for (const route of ['/admin/private', '/app/admin/private', '/api/v1/sync/pull',
    '/storage/private', '/health', '/unknown', '/projects/example/export']) {
    assert.equal(await sw.navigate(route), null, route);
  }
  assert.equal(sw.networkReads, 0, 'approved shell must remain local even when network is available');
  assert.equal(sw.writes, 0, 'navigating must not overwrite approved shell or approval');
});

test('PWA: offline navigation still opens previously approved local shell', async () => {
  const sw = await harness({ offline: true });
  const response = await sw.navigate('/projects/example/map');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /approved app shell/);
  assert.equal(await sw.navigate('/private/report'), null);
  assert.equal(sw.networkReads, 0);
  assert.equal(sw.writes, 0);
});

test('PWA: missing approval or evicted JS fails closed to recovery, never adopting network HTML', async () => {
  for (const config of [{ approval: false }, { missingBundle: true }]) {
    const sw = await harness(config);
    const response = await sw.navigate('/workspace');
    assert.equal(response.status, 503);
    assert.match(await response.text(), /Versão local indisponível/);
    assert.equal(sw.networkReads, 0);
    assert.equal(sw.writes, 0);
  }
});

test('PWA: version metadata is network-only, not an offline shell response', async () => {
  const sw = await harness();
  const response = await sw.navigate('/version.json', { mode: 'cors' });
  assert.equal(await response.text(), 'network document');
  assert.equal(sw.networkReads, 1);
  assert.equal(sw.writes, 0);
});

test('PWA: non-GET and cross-origin requests are not intercepted', async () => {
  const sw = await harness();
  assert.equal(await sw.navigate('/projects', { method: 'POST' }), null);
  assert.equal(await sw.navigate('https://another.example/projects'), null);
  assert.equal(sw.networkReads, 0);
});
