// Migration worker: prior marketing-site PWAs installed /app/ on the wrong origin.
// No application shell is cached here. The real PWA is at appmarkmap.mtsferreira.dev.
const APP_ORIGIN = "https://appmarkmap.mtsferreira.dev";
const LEGACY_CACHE_PREFIX = "markmap-site-app-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter((name) => name.startsWith(LEGACY_CACHE_PREFIX))
              .map((name) => caches.delete(name)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== "/app" && !url.pathname.startsWith("/app/")) return;
  const relativePath = url.pathname.slice("/app".length) || "/";
  const destination = new URL(relativePath + url.search, APP_ORIGIN);
  event.respondWith(Promise.resolve(Response.redirect(destination.href, 302)));
});
