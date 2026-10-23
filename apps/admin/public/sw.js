const CACHE_PREFIX = "markmap-";
const LEGACY_CACHE_PREFIX = "geonexo-";
const SHELL_ASSETS =
  typeof __MARKMAP_SHELL_MANIFEST__ === "undefined"
    ? []
    : __MARKMAP_SHELL_MANIFEST__;
const SHELL_VERSION =
  typeof __MARKMAP_SHELL_VERSION__ === "undefined"
    ? "v2"
    : __MARKMAP_SHELL_VERSION__;
const STATIC_ASSETS = SHELL_ASSETS.length
  ? SHELL_ASSETS
  : [
      "/",
      "/index.html",
      "/manifest.json",
      "/icons/icon-192x192.png",
      "/icons/icon-512x512.png",
    ];

// These are the only runtime paths this worker may intercept besides navigation.
const CACHE_NAME = `markmap-cache-${SHELL_VERSION}`;
const STATIC_PATH_PREFIXES = ["/assets/", "/icons/", "/fonts/"];
const API_PATH_PREFIXES = [
  "/api",
  "/projects",
  "/layers",
  "/features",
  "/notifications",
  "/storage",
  "/health",
];

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isApiPath(pathname) {
  return API_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isDeclaredStaticPath(pathname) {
  return (
    STATIC_ASSETS.includes(pathname) ||
    STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isNavigation(request) {
  return request.mode === "navigate";
}

function isAppNavigationPath(pathname) {
  // The same SPA may be mounted under /app without changing its route tree.
  const route =
    pathname === "/app"
      ? "/"
      : pathname.startsWith("/app/")
        ? pathname.slice(4)
        : pathname;
  return [
    /^\/$/,
    /^\/mesh$/,
    /^\/imports$/,
    /^\/projects(?:\/[^/]+(?:\/(?:map|mesh))?)?$/,
    /^\/settings$/,
    /^\/analytics$/,
    /^\/coordinate-systems$/,
    /^\/telemetry$/,
    /^\/workspace$/,
  ].some((pattern) => pattern.test(route));
}

function isInterceptableStaticRequest(request) {
  const url = new URL(request.url);
  return (
    isSameOrigin(request) &&
    !isApiPath(url.pathname) &&
    isDeclaredStaticPath(url.pathname)
  );
}

async function fetchAndCache(request, event, cache) {
  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    event.waitUntil(cache.put(request, networkResponse.clone()));
  }
  return networkResponse;
}

const SHELL_MATCH = { ignoreVary: true };

async function handleNavigation(request, cache) {
  const cachedShell =
    (await cache.match("/", SHELL_MATCH)) ||
    (await cache.match("/index.html", SHELL_MATCH));
  try {
    // Navigation is network-first, but never persisted: it may carry private HTML.
    return await fetch(request);
  } catch {
    return cachedShell || Response.error();
  }
}

async function installShell() {
  const stagingName = `${CACHE_NAME}-installing-${Date.now()}`;
  const staging = await caches.open(stagingName);
  try {
    await staging.addAll(STATIC_ASSETS);
    await staging.put("/__geonexo_install_complete__", new Response("ok"));
    const existing = await caches.open(CACHE_NAME);
    for (const request of STATIC_ASSETS) {
      const response = await staging.match(request, SHELL_MATCH);
      if (response) await existing.put(request, response);
    }
    await existing.put("/__geonexo_install_complete__", new Response("ok"));
    await caches.delete(stagingName);
  } catch (error) {
    await caches.delete(stagingName);
    throw error;
  }
}

async function handleStaticAsset(request, event, cache) {
  const cachedResponse = await cache.match(request, SHELL_MATCH);
  if (cachedResponse) {
    // Keep the stale-while-revalidate behavior, but bind the write to the event.
    event.waitUntil(
      fetchAndCache(request, event, cache).catch(() => undefined),
    );
    return cachedResponse;
  }

  try {
    return await fetchAndCache(request, event, cache);
  } catch {
    // A missing asset must remain a failed request, never the application shell.
    return Response.error();
  }
}

// Install Event - Pre-cache critical App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(installShell());
});

// Activate Event - Clean up only caches owned by this application.
self.addEventListener("activate", (event) => {
  const activationWork = caches
    .keys()
    .then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              (cacheName.startsWith(CACHE_PREFIX) ||
                cacheName.startsWith(LEGACY_CACHE_PREFIX)) &&
              cacheName !== CACHE_NAME &&
              !cacheName.includes("-installing-"),
          )
          .map((cacheName) => caches.delete(cacheName)),
      ),
    );
  event.waitUntil(
    Promise.all([activationWork, Promise.resolve(self.clients.claim())]),
  );
});

// Fetch Event - Restrict interception to same-origin navigation and declared assets.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !isSameOrigin(request)) return;

  const url = new URL(request.url);
  if (isNavigation(request) && url.pathname === "/install") {
    event.respondWith(
      Promise.resolve(
        Response.redirect(new URL("/", self.location.origin).href, 302),
      ),
    );
    return;
  }
  if (isNavigation(request)) {
    // Do not intercept or cache arbitrary same-origin documents or API responses.
    if (!isAppNavigationPath(url.pathname)) return;
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => handleNavigation(request, cache)),
    );
    return;
  }

  if (isApiPath(url.pathname)) return;

  if (isInterceptableStaticRequest(request)) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then((cache) => handleStaticAsset(request, event, cache)),
    );
  }
});

// Only a same-origin window client can complete a short-lived handshake.
// A postMessage flag alone must not activate a worker without compatibility negotiation.
const pendingUpgradeClients = new Map();
self.addEventListener("message", (event) => {
  const client = event.source;
  if (
    !client ||
    typeof client.id !== "string" ||
    typeof client.url !== "string"
  )
    return;
  let clientUrl;
  try {
    clientUrl = new URL(client.url);
  } catch {
    return;
  }
  if (clientUrl.origin !== self.location.origin) return;

  if (event.data?.type === "CHECK_COMPATIBILITY") {
    if (!event.ports?.[0]) return;
    pendingUpgradeClients.set(client.id, Date.now());
    event.ports[0].postMessage({
      type: "MARKMAP_COMPATIBILITY",
      shellProtocolVersion: 1,
      localSchemaVersion: 1,
      regionPackageSchemaVersion: 2,
    });
    return;
  }
  if (
    event.data?.type === "SKIP_WAITING" &&
    event.data.durableWritesReady === true &&
    event.data.compatibilityVersion === 1
  ) {
    const requestedAt = pendingUpgradeClients.get(client.id);
    pendingUpgradeClients.delete(client.id);
    if (typeof requestedAt === "number" && Date.now() - requestedAt < 15000) {
      event.waitUntil(self.skipWaiting());
    }
  }
});
