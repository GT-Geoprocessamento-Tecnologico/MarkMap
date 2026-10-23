import test from "node:test";
import assert from "node:assert/strict";
import {
  isRegionalQuotaError,
  describeRegionInstallError,
} from "./region-install-feedback.mjs";
import { fetchRemoteRegionManifest } from "./remote-region-manifest.mjs";

const endpoint = "https://example.org/maps/a/manifest.json";

test("A10 distinguishes a user abort from quota or corruption without deleting checkpoints", () => {
  const aborted = describeRegionInstallError("aborted");
  assert.equal(aborted.kind, "cancel");
  assert.match(aborted.message, /retomar/);
  const quota = describeRegionInstallError("insufficient-space");
  assert.equal(quota.kind, "quota");
  assert.match(quota.message, /Seus projetos/);
  const limit = describeRegionInstallError("app-budget-exceeded");
  assert.equal(limit.kind, "quota");
  assert.match(limit.message, /nenhum mapa foi excluído/);
  const corrupt = describeRegionInstallError("checksum-mismatch");
  assert.equal(corrupt.kind, "integrity");
  assert.equal(corrupt.retryable, false);
  const otherTab = describeRegionInstallError("install-busy-other-tab");
  assert.equal(otherTab.kind, "busy");
});

test("A11 categorizes quota errors but does not treat ordinary failures as quota", () => {
  assert.equal(
    isRegionalQuotaError(new DOMException("disk full", "QuotaExceededError")),
    true,
  );
  assert.equal(
    isRegionalQuotaError(new Error("storage quota is insufficient")),
    true,
  );
  assert.equal(isRegionalQuotaError(new Error("network timeout")), false);
  assert.equal(isRegionalQuotaError(null), false);
  assert.equal(
    isRegionalQuotaError({ name: "Other", message: "quota exceeded" }),
    true,
  );
});

test("A10 remote manifest inspection forwards AbortSignal without credentials", async () => {
  const controller = new AbortController();
  const fetched = await fetchRemoteRegionManifest(
    endpoint,
    async (url, opts) => {
      assert.equal(url, endpoint);
      assert.equal(opts.signal, controller.signal);
      assert.equal(opts.credentials, "omit");
      assert.equal(opts.redirect, "error");
      return new Response('{"id":"a"}');
    },
    controller.signal,
  );
  assert.equal(fetched.manifest.id, "a");
  assert.equal(fetched.baseUrl, "https://example.org/maps/a/");
});

test("A10 cancellation before manifest request makes no network call", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    fetchRemoteRegionManifest(
      endpoint,
      async () => {
        calls++;
        return new Response("{}");
      },
      controller.signal,
    ),
    (err) => err.name === "AbortError",
  );
  assert.equal(calls, 0);
});

test("A10 midstream manifest cancellation prevents successful inspection", async () => {
  const controller = new AbortController();
  let canceled = false;
  const reader = new ReadableStream({
    pull(source) {
      if (!canceled) {
        source.enqueue(new TextEncoder().encode('{"id":'));
        controller.abort();
        canceled = true;
        return;
      }
      source.enqueue(new TextEncoder().encode('"a"}'));
      source.close();
    },
  });
  await assert.rejects(
    fetchRemoteRegionManifest(
      endpoint,
      async () => new Response(reader),
      controller.signal,
    ),
    (err) => err.name === "AbortError",
  );
});
