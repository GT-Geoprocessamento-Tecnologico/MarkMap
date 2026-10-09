import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateShellManifest } from "./generate-shell-manifest.mjs";

test("shell content changes invalidate app version even when filenames are stable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "markmap-shell-"));
  try {
    await mkdir(join(dir, "icons"));
    await writeFile(join(dir, "index.html"), "<html>1</html>");
    await writeFile(join(dir, "manifest.json"), "{}");
    await writeFile(join(dir, "icons/icon-192x192.png"), "image1");
    await writeFile(join(dir, "icons/icon-512x512.png"), "image2");
    await writeFile(join(dir, "sw.js"),
      "const SHELL_VERSION = typeof __GEONEXO_SHELL_VERSION__ === 'undefined' ? 'v2' : __GEONEXO_SHELL_VERSION__;\n");
    const first = await generateShellManifest(dir);
    const worker = await readFile(join(dir, "sw.js"), "utf8");
    assert.ok(worker.includes(first.version));
    await writeFile(join(dir, "index.html"), "<html>2</html>");
    const second = await generateShellManifest(dir);
    assert.notEqual(first.version, second.version);
    assert.deepEqual(first.assets, second.assets);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
