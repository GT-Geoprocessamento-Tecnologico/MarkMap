// Desenvolvido por MtsFerreira — keep all app chrome theme-dependent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const css = read("apps/admin/src/styles/main.css");
const block = (selector) => {
  const start = css.indexOf(selector + " {");
  assert.ok(start >= 0, "Missing " + selector);
  return css.slice(start + selector.length + 2).split("}")[0];
};
test("sidebar and header are dark only under the .dark theme", () => {
  for (const area of ["sidebar", "header"]) {
    const selector = ".markmap-shell-" + area;
    assert.doesNotMatch(block(selector), /color-scheme:\s*dark|--text-primary:/);
    assert.match(block(".dark " + selector), /color-scheme:\s*dark/);
  }
});
test("map controls, install screen and standalone shell use semantic colors", () => {
  assert.match(block(".markmap-workspace"), /var\(--bg-main\)/);
  assert.match(block(".dark .markmap-workspace"), /background:\s*#0a1b21/);
  assert.match(block(".pwa-install-gate"), /var\(--bg-main\)/);
  assert.match(css, /@media \(display-mode: standalone\)[\s\S]*body\s*\{\s*background:\s*var\(--bg-main\)/);
});
test("3D viewer updates background on theme changes without recreating its renderer", () => {
  const canvas = read("apps/admin/src/components/mesh/MeshCanvas.tsx");
  const page = read("apps/admin/src/pages/workspace/MeshStudioPage.tsx");
  assert.match(canvas, /setClearColor\(color,\s*1\)/);
  assert.match(canvas, /addEventListener\("geonexo-theme-change", syncBackground\)/);
  assert.match(canvas, /removeEventListener\("geonexo-theme-change", syncBackground\)/);
  assert.doesNotMatch(page, /bg-\[#08121d\]|bg-black\/60/);
});
test("saved appearance is applied before the bundle mounts", () => {
  const html = read("apps/admin/index.html");
  assert.match(html, /localStorage\.getItem\("theme"\)/);
  assert.match(html, /document\.documentElement\.classList\.toggle\("dark", !light\)/);
});
