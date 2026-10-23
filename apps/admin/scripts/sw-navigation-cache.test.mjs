import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const workerPath = new URL("../public/sw.js", import.meta.url);
const origin = "https://markmap.example";

async function harness({ offline = false } = {}) {
  const listeners = new Map();
  let networkReads = 0;
  let writes = 0;
  const cache = {
    async match(key) {
      return key === "/" || key === "/index.html"
        ? new Response("offline app shell", {
            headers: { "Content-Type": "text/html" },
          })
        : undefined;
    },
    async put() {
      writes++;
    },
  };
  const caches = {
    async open() {
      return cache;
    },
  };
  const fetch = async () => {
    networkReads++;
    if (offline) throw new TypeError("offline");
    return new Response("network document", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  };
  const self = {
    location: { origin },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const source = await readFile(workerPath, "utf8");
  runInNewContext(source, {
    self,
    caches,
    fetch,
    Response,
    URL,
    Date,
    Promise,
    console,
  });

  async function navigate(path, { method = "GET", mode = "navigate" } = {}) {
    const request = { url: new URL(path, origin).href, mode, method };
    let pending = null;
    const event = {
      request,
      respondWith(response) {
        pending = Promise.resolve(response);
      },
      waitUntil(promise) {
        Promise.resolve(promise).catch(() => {});
      },
    };
    listeners.get("fetch")(event);
    return pending ? await pending : null;
  }

  return {
    navigate,
    get writes() {
      return writes;
    },
    get networkReads() {
      return networkReads;
    },
  };
}

test("PWA: navigation interception is limited to real SPA routes", async () => {
  const sw = await harness();
  for (const route of [
    "/",
    "/mesh",
    "/projects",
    "/projects/example/map",
    "/app",
    "/app/mesh",
    "/app/projects/example/mesh",
    "/app/settings",
  ]) {
    const result = await sw.navigate(route);
    assert.equal(await result.text(), "network document", route);
  }
  for (const route of [
    "/admin/private",
    "/app/admin/private",
    "/api/v1/sync/pull",
    "/storage/private",
    "/health",
    "/unknown",
    "/projects/example/export",
  ]) {
    assert.equal(await sw.navigate(route), null, route);
  }
  assert.equal(sw.networkReads, 8);
  assert.equal(
    sw.writes,
    0,
    "documents must never be written to the public shell cache",
  );
});

test("PWA: offline navigation falls back to precached application shell only", async () => {
  const sw = await harness({ offline: true });
  const offline = await sw.navigate("/projects/example/map");
  assert.equal(await offline.text(), "offline app shell");
  assert.equal(await sw.navigate("/private/report"), null);
  assert.equal(sw.writes, 0);
});

test("PWA: non-GET and cross-origin requests are not intercepted", async () => {
  const sw = await harness();
  assert.equal(await sw.navigate("/projects", { method: "POST" }), null);
  assert.equal(await sw.navigate("https://another.example/projects"), null);
  assert.equal(sw.networkReads, 0);
});
