const CACHE_NAME = "markmap-site-app-v1";
const APP_START = "/app/";
const APP_SHELL_MANIFEST = "/shell-manifest.json";

function isAppNavigation(pathname) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

function isAppAsset(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/fonts/")
  );
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const shellResponse = await fetch(APP_SHELL_MANIFEST, { cache: "no-store" });
  if (!shellResponse.ok) throw new Error("App shell manifest unavailable");

  const shell = await shellResponse.json();
  const assets = Array.isArray(shell.assets) ? shell.assets : [];
  const scopedAssets = assets
    .filter((asset) => typeof asset === "string")
    .map((asset) => {
      if (asset === "/" || asset === "/index.html") return APP_START;
      if (asset === "/manifest.json") return "/manifest.json";
      return asset;
    });

  await cache.addAll([
    APP_START,
    "/manifest.json",
    ...new Set(scopedAssets),
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("markmap-site-app-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && isAppNavigation(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)),
            );
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(request)) ||
            (await cache.match(APP_START)) ||
            Response.error()
          );
        }),
    );
    return;
  }

  if (isAppAsset(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          event.waitUntil(
            fetch(request)
              .then((response) => {
                if (response.ok) return cache.put(request, response.clone());
                return undefined;
              })
              .catch(() => undefined),
          );
          return cached;
        }

        try {
          const response = await fetch(request);
          if (response.ok) {
            event.waitUntil(cache.put(request, response.clone()));
          }
          return response;
        } catch {
          return Response.error();
        }
      }),
    );
  }
});
