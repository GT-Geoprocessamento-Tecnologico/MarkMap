import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchRemoteRegionManifest } from "./remote-region-manifest.mjs";

test("only bounded HTTPS manifest without credentials is fetched", async () => {
  const fake = async (url, opts) => {
    assert.equal(url, "https://example.org/regions/demo/manifest.json");
    assert.equal(opts.credentials, "omit");
    assert.equal(opts.redirect, "error");
    return new Response('{"id":"demo"}', { status: 200 });
  };
  const output = await fetchRemoteRegionManifest(
    "https://example.org/regions/demo/manifest.json",
    fake,
  );
  assert.equal(output.manifest.id, "demo");
  assert.equal(output.baseUrl, "https://example.org/regions/demo/");
});

test("rejects unsafe manifest locations before making a request", async () => {
  let requests = 0;
  const fake = async () => {
    requests++;
    return new Response("{}");
  };
  for (const invalid of [
    "http://example.org/region/manifest.json",
    "https://example.org/region/manifest.json?token=secret",
    "https://user:pw@example.org/region/manifest.json",
    "https://example.org/maps.zip",
  ]) {
    await assert.rejects(fetchRemoteRegionManifest(invalid, fake));
  }
  assert.equal(requests, 0);
});

test("rejects a manifest response larger than 64 KiB", async () => {
  await assert.rejects(
    fetchRemoteRegionManifest(
      "https://example.org/manifest.json",
      async () => new Response("x".repeat(65537)),
    ),
    /64 KiB/,
  );
});
