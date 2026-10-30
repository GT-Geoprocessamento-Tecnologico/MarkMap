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
const RECOVERY_PATH = '/__markmap_recover_shell__';
const LOCAL_FIRST_DB = 'GeoNexoLocalFirstDB';
const LOCAL_FIRST_DB_VERSION = 2;
// SW processes are ephemeral: recovery consent must survive worker termination.
const RECOVERY_TOKEN_KEY = `/__markmap_recovery_challenge_v1__/${CACHE_NAME}`;
let recoverySequence = Promise.resolve();
async function withRecoveryLock(action) {
  const previous = recoverySequence;
  let release;
  recoverySequence = new Promise((resolve) => { release = resolve; });
  await previous;
  try { return await action(); }
  finally { release(); }
}
async function issueRecoveryToken() {
  return withRecoveryLock(async () => {
    const token = crypto.randomUUID();
    const cache = await caches.open(APPROVAL_CACHE);
    await cache.put(RECOVERY_TOKEN_KEY, new Response(JSON.stringify({
      token, shell: CACHE_NAME, expires: Date.now() + 5 * 60 * 1000,
    }), { headers: { 'Content-Type': 'application/json' } }));
    return token;
  });
}
async function consumeRecoveryToken(token) {
  return withRecoveryLock(async () => {
    const cache = await caches.open(APPROVAL_CACHE);
    const response = await cache.match(RECOVERY_TOKEN_KEY);
    if (!response) return false;
    let value;
    try { value = await response.json(); } catch { await cache.delete(RECOVERY_TOKEN_KEY); return false; }
    if (value?.shell !== CACHE_NAME || typeof value.token !== 'string' ||
        typeof value.expires !== 'number' || Date.now() > value.expires) {
      await cache.delete(RECOVERY_TOKEN_KEY);
      return false;
    }
    if (token !== value.token) return false;
    // Consume before IndexedDB verification. A denied consent requires a fresh click.
    await cache.delete(RECOVERY_TOKEN_KEY);
    return true;
  });
}

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
async function isComplete(name, verifyAssets = false) {
  // CacheStorage can evict individual entries: a completion marker alone is
  // not evidence of a usable offline app shell.
  const names = await caches.keys();
  if (!names.includes(name)) return false;
  const cache = await caches.open(name);
  if (!(await cache.match(COMPLETE_KEY)) || !(await cache.match('/index.html'))) return false;
  if (verifyAssets) {
    for (const path of STATIC_ASSETS) {
      if (!(await cache.match(path))) return false;
    }
  }
  return true;
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
    const approvals = await caches.open(APPROVAL_CACHE);
    if (!(await approvals.match(APPROVAL_KEY))) await saveApproval(CACHE_NAME, APP_VERSION, BUILD_SHA);
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
  // Preserve the user's IndexedDB, outbox and offline maps. Require explicit
  // recovery consent and a durable local transaction before changing the pin.
  return recoveryPage();
}
function escapeRecoveryHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}
async function recoveryPage(reason = '') {
  const candidateReady = await isComplete(CACHE_NAME, true);
  const token = candidateReady ? await issueRecoveryToken() : '';
  const body = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Recuperar MarkMap</title></head>
<body><main><h1>Versão local indisponível</h1>
<p>A versão do aplicativo previamente aprovada não está mais no cache. Seus dados locais não foram apagados.</p>
${reason ? `<p role="alert">${escapeRecoveryHtml(reason)}</p>` : ''}
${candidateReady ? `<p>Se desejar, autorize manualmente a versão ${escapeRecoveryHtml(APP_VERSION)}.
A recuperação verifica o armazenamento local antes de continuar.</p>
<form method="POST" action="${RECOVERY_PATH}">
<input type="hidden" name="token" value="${token}">
<button type="submit">Verificar dados e aprovar recuperação</button></form>` :
'<p>A versão disponível ainda não está pronta. Conecte-se à internet e abra o aplicativo novamente.</p>'}
<p>Não reinstale o aplicativo nem limpe seus dados ou mapas offline.</p>
</main></body></html>`;
  return new Response(body, { status: 503, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
/**
 * An explicit recovery click may change only the shell approval record.
 * Check a readwrite barrier on the existing local DB without creating a new DB.
 */
async function verifyRecoveryLocalData() {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB indisponível.');
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_FIRST_DB);
    let settled = false;
    const fail = () => { if (!settled) { settled = true; reject(new Error('Banco local indisponível.')); } };
    req.onupgradeneeded = () => { try { req.transaction?.abort(); } catch {} fail(); };
    req.onerror = fail;
    req.onblocked = fail;
    req.onsuccess = () => {
      if (settled) { req.result.close(); return; }
      settled = true; resolve(req.result);
    };
  });
  try {
    const required = ['meta', 'entities', 'originals', 'outbox', 'conflicts', 'acks'];
    if (db.version !== LOCAL_FIRST_DB_VERSION || required.some((name) => !db.objectStoreNames.contains(name)))
      throw new Error('Banco local em versão incompatível.');
    await new Promise((resolve, reject) => {
      const tx = db.transaction(required, 'readwrite');
      const sync = tx.objectStore('meta').get('syncInProgress');
      tx.oncomplete = () => sync.result === undefined ? resolve() : reject(new Error('Sincronização em andamento.'));
      tx.onabort = () => reject(tx.error || new Error('Transação local interrompida.'));
      tx.onerror = () => reject(tx.error || new Error('Falha de transação local.'));
      sync.onerror = () => reject(sync.error || new Error('Falha ao ler sincronização.'));
    });
  } finally { db.close(); }
}
async function handleRecoveryRequest(request) {
  const data = await request.formData().catch(() => null);
  const token = data?.get('token');
  // The one-time challenge is stored in CacheStorage, not volatile SW memory.
  if (typeof token !== 'string' || !(await consumeRecoveryToken(token)))
    return recoveryPage('Solicitação expirada. Tente novamente.');
  if (!(await isComplete(CACHE_NAME, true))) return recoveryPage('A atualização ainda não está pronta.');
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (windows.filter((client) => {
    try { return new URL(client.url).origin === self.location.origin; } catch { return false; }
  }).length > 1) return recoveryPage('Feche as outras janelas do MarkMap antes de recuperar.');
  try {
    await verifyRecoveryLocalData();
    await saveApproval(CACHE_NAME, APP_VERSION, BUILD_SHA);
    return Response.redirect(new URL('/workspace', self.location.origin).href, 303);
  } catch {
    return recoveryPage('Não foi possível conferir as gravações locais. Nenhuma atualização foi autorizada.');
  }
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
  if (!isSameOrigin(request)) return;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === RECOVERY_PATH) {
    event.respondWith(handleRecoveryRequest(request));
    return;
  }
  if (request.method !== 'GET') return;
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
  const ready = await isComplete(CACHE_NAME, true);
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
  if (!(await isComplete(CACHE_NAME, true))) {
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