// MarkMap offline-first shell: server deployments do not imply local app upgrades.
// The approved shell remains pinned across worker restarts and natural activation.
const SHELL_ASSETS = typeof __MARKMAP_SHELL_MANIFEST__ === 'undefined' ? [] : __MARKMAP_SHELL_MANIFEST__;
const SHELL_VERSION = typeof __MARKMAP_SHELL_VERSION__ === 'undefined' ? 'v2' : __MARKMAP_SHELL_VERSION__;
const APP_VERSION = typeof __MARKMAP_APP_VERSION__ === 'undefined' ? 'unknown' : __MARKMAP_APP_VERSION__;
// Full Git SHA belongs to network-only version.json, not the service worker.
// Otherwise a docs-only deploy silently changes SW bytes on installed PWAs.
const BUILD_SHA = 'unavailable';
const STATIC_ASSETS = SHELL_ASSETS.length ? SHELL_ASSETS : [
  '/', '/index.html', '/manifest.json',
  '/icons/icon-192x192.png', '/icons/icon-512x512.png',
];
const CACHE_NAME = `markmap-cache-${SHELL_VERSION}`;
const APPROVAL_CACHE = 'markmap-shell-approval-v1';
const APPROVAL_KEY = '/__markmap_approved_shell_v1__';
const COMPLETE_KEY = '/__geonexo_install_complete__';
const STATIC_PATH_PREFIXES = ['/assets/', '/icons/', '/fonts/'];
const API_PATH_PREFIXES = [
  '/api', '/projects', '/layers', '/features', '/notifications', '/storage', '/health',
];
const SAME_ORIGIN_SHELL_VERSION = 1;

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}
function isApiPath(pathname) {
  return API_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
function isDeclaredStaticPath(pathname) {
  return STATIC_ASSETS.includes(pathname) || STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
function isAppNavigationPath(pathname) {
  const route = pathname === '/app' ? '/' : pathname.startsWith('/app/') ? pathname.slice(4) : pathname;
  return [
    /^\/$/, /^\/mesh$/, /^\/imports$/,
    /^\/projects(?:\/[^/]+(?:\/(?:map|mesh))?)?$/,
    /^\/settings$/, /^\/analytics$/, /^\/coordinate-systems$/, /^\/marketplace$/,
    /^\/telemetry$/, /^\/workspace$/,
  ].some((pattern) => pattern.test(route));
}
const SHELL_MATCH = { ignoreVary: true };

async function readApproval() {
  const cache = await caches.open(APPROVAL_CACHE);
  const response = await cache.match(APPROVAL_KEY);
  if (!response) return null;
  try {
    const value = await response.json();
    if (value?.protocol === SAME_ORIGIN_SHELL_VERSION &&
        typeof value.cache === 'string' && /^markmap-cache-[a-z0-9_-]+$/i.test(value.cache) &&
        typeof value.appVersion === 'string') return value;
  } catch { /* Corrupt metadata must never authorize an upgrade. */ }
  throw new Error('Stored shell approval is invalid');
}
async function saveApproval(cacheName, appVersion, buildSha) {
  const store = await caches.open(APPROVAL_CACHE);
  await store.put(APPROVAL_KEY, new Response(JSON.stringify({
    protocol: SAME_ORIGIN_SHELL_VERSION,
    cache: cacheName,
    appVersion,
    buildSha,
  }), { headers: { 'Content-Type': 'application/json' } }));
}
async function isComplete(name) {
  // Do not trust a cache created before an interrupted shell install.
  const names = await caches.keys();
  if (!names.includes(name)) return false;
  const cache = await caches.open(name);
  return Boolean(await cache.match(COMPLETE_KEY));
}

async function installShell() {
  const stagingName = `${CACHE_NAME}-installing-${Date.now()}`;
  const staging = await caches.open(stagingName);
  try {
    // Bypass the browser HTTP cache so the candidate matches this deployment.
    await staging.addAll(STATIC_ASSETS.map((path) => typeof Request === 'undefined'
      ? path : new Request(new URL(path, self.location.origin).href, { cache: 'reload' })));
    await staging.put(COMPLETE_KEY, new Response('ok'));
    const target = await caches.open(CACHE_NAME);
    for (const asset of STATIC_ASSETS) {
      const response = await staging.match(asset, SHELL_MATCH);
      if (!response) throw new Error(`Shell asset missing from staging: ${asset}`);
      await target.put(asset, response);
    }
    await target.put(COMPLETE_KEY, new Response('ok'));
    await caches.delete(stagingName);
    // One-time migration: legacy workers did not persist an approval protocol.
    // Bootstrap this new protocol on its own shell. Subsequent releases are pinned.
    if (!(await readApproval())) await saveApproval(CACHE_NAME, APP_VERSION, BUILD_SHA);
  } catch (error) {
    await caches.delete(stagingName);
    throw error;
  }
}

async function approvedCache() {
  const approved = await readApproval();
  if (!approved || !(await isComplete(approved.cache))) return null;
  return caches.open(approved.cache);
}
async function handleNavigation() {
  try {
    const cache = await approvedCache();
    const shell = cache && (await cache.match('/index.html', SHELL_MATCH) ||
                            await cache.match('/', SHELL_MATCH));
    if (shell) return shell;
  } catch { /* A malformed pin never authorizes a new release. */ }
  // Fail closed rather than serve an unapproved, potentially incompatible release.
  return new Response('Versão aprovada indisponível neste dispositivo. Preserve seus dados locais.', {
    status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
async function handleStaticAsset(request, event) {
  const cache = await approvedCache();
  const cached = cache && await cache.match(request, SHELL_MATCH);
  if (cached) return cached;
  // Other static assets not in the approved shell may be fetched normally. Never
  // overwrite a pinned shell or return an HTML fallback for a missing JS bundle.
  try {
    const response = await fetch(request);
    return response.ok && response.headers.get('content-type')?.includes('text/html') &&
      new URL(request.url).pathname.startsWith('/assets/') ? Response.error() : response;
  } catch { return Response.error(); }
}

self.addEventListener('install', (event) => {
  event.waitUntil(installShell());
});
self.addEventListener('activate', (event) => {
  // Never delete another version's approved shell on natural SW activation.
  // The previous worker could still be serving another tab's immutable bundles.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.pathname === '/install') {
    event.respondWith(Promise.resolve(Response.redirect(new URL('/', self.location.origin).href, 302)));
    return;
  }
  if (request.mode === 'navigate' && isAppNavigationPath(url.pathname)) {
    event.respondWith(handleNavigation());
    return;
  }
  if (url.pathname === '/version.json') {
    // Release discovery must never be satisfied from the pinned offline shell.
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => Response.error()));
    return;
  }
  if (isApiPath(url.pathname)) return;
  if (isDeclaredStaticPath(url.pathname)) {
    event.respondWith(handleStaticAsset(request, event));
  }
});

// Messages from a same-origin window are only accepted with a short-lived
// compatibility handshake; a new deployment is not permission to activate it.
const handshakeClients = new Map();
function verifiedWindow(event) {
  const client = event.source;
  if (!client || typeof client.id !== 'string' || typeof client.url !== 'string') return null;
  try { if (new URL(client.url).origin === self.location.origin) return client; }
  catch { /* invalid */ }
  return null;
}
function authorized(clientId) {
  const stamp = handshakeClients.get(clientId);
  handshakeClients.delete(clientId);
  return typeof stamp === 'number' && Date.now() - stamp < 15000;
}
async function getShellStatus() {
  const pinned = await readApproval();
  const ready = await isComplete(CACHE_NAME);
  return {
    type: 'MARKMAP_SHELL_STATUS', protocol: SAME_ORIGIN_SHELL_VERSION,
    approvedVersion: pinned?.appVersion ?? null,
    approvedBuildSha: pinned?.buildSha ?? null,
    approvedShell: pinned?.cache ?? null,
    availableVersion: APP_VERSION,
    availableBuildSha: BUILD_SHA,
    availableShell: CACHE_NAME,
    updateAvailable: Boolean(pinned && pinned.cache !== CACHE_NAME && ready),
    candidateReady: ready,
  };
}
async function approveShell(clientId, data, port) {
  if (!authorized(clientId) || data.durableWritesReady !== true ||
      data.compatibilityVersion !== SAME_ORIGIN_SHELL_VERSION ||
      data.targetShell !== CACHE_NAME) {
    port.postMessage({ type: 'MARKMAP_SHELL_APPROVAL', approved: false, reason: 'authorization' });
    return;
  }
  // A second open app tab can contain uncommitted editor state. Do not switch
  // the shell from under it; require a single active window for approval.
  const openClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (openClients.some((other) => other.id !== clientId &&
      typeof other.url === 'string' && new URL(other.url).origin === self.location.origin)) {
    port.postMessage({ type: 'MARKMAP_SHELL_APPROVAL', approved: false, reason: 'other-tabs' });
    return;
  }
  if (!(await isComplete(CACHE_NAME))) {
    port.postMessage({ type: 'MARKMAP_SHELL_APPROVAL', approved: false, reason: 'incomplete' });
    return;
  }
  await saveApproval(CACHE_NAME, APP_VERSION, BUILD_SHA);
  port.postMessage({ type: 'MARKMAP_SHELL_APPROVAL', approved: true, version: APP_VERSION });
}
self.addEventListener('message', (event) => {
  const client = verifiedWindow(event);
  if (!client) return;
  const data = event.data;
  if (data?.type === 'CHECK_COMPATIBILITY') {
    if (!event.ports?.[0]) return;
    handshakeClients.set(client.id, Date.now());
    event.ports[0].postMessage({
      type: 'MARKMAP_COMPATIBILITY', shellProtocolVersion: SAME_ORIGIN_SHELL_VERSION,
      localSchemaVersion: 1, regionPackageSchemaVersion: 2,
    });
    return;
  }
  if (data?.type === 'GET_SHELL_STATUS' && event.ports?.[0]) {
    event.waitUntil(getShellStatus().then((status) => {
      event.ports[0].postMessage(status);
    }).catch(() => event.ports[0].postMessage({ type: 'MARKMAP_SHELL_STATUS', error: 'unavailable' })));
    return;
  }
  if (data?.type === 'SKIP_WAITING' &&
      data.durableWritesReady === true &&
      data.compatibilityVersion === SAME_ORIGIN_SHELL_VERSION && authorized(client.id)) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (data?.type === 'APPROVE_SHELL' && event.ports?.[0]) {
    event.waitUntil(approveShell(client.id, data, event.ports[0]).catch(() => {
      event.ports[0].postMessage({ type: 'MARKMAP_SHELL_APPROVAL', approved: false, reason: 'storage-error' });
    }));
  }
});