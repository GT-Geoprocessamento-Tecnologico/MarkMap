// Desenvolvido por MtsFerreira — regression checks for public text contrast.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const css = readFileSync(new URL("../apps/admin/src/styles/main.css", import.meta.url), "utf8");
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex) => rgb(hex).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((a, b) => b - a);
  return (x + .05) / (y + .05);
};
const token = (block, name) => {
  const value = block.match(new RegExp("--" + name + ":\\s*(#[a-fA-F0-9]{6})"))?.[1];
  assert.ok(value, "Missing " + name);
  return value;
};

test("light/dark accent text has at least 4.5:1 contrast", () => {
  const light = css.split(".dark {")[0];
  const dark = css.split(".dark {")[1].split("\n  }\n}")[0];
  for (const [section, background] of [[light, "#f4f8fb"], [dark, "#0b1b23"]]) {
    for (const name of ["color-primary-ink", "color-secondary-ink"]) {
      assert.ok(ratio(token(section, name), background) >= 4.5, name + " contrast failed");
    }
  }
});

test("brand gradient keeps labels readable at both ends", () => {
  assert.ok(css.includes(".bg-gradient-to-r.from-brand-blue.to-brand-cyan.text-white"));
  for (const color of ["#1c98d1", "#00d6db"]) {
    assert.ok(ratio("#06131a", color) >= 4.5, "Gradient endpoint " + color);
  }
});

test("always-dark map and active mobile navigation use contrast tokens", () => {
  const map = css.split(".dark .markmap-workspace {")[1].split("}")[0];
  assert.ok(ratio(token(map, "text-primary"), "#0a1b21") >= 4.5);
  assert.match(css, /\.markmap-mobile-tab\.is-active\s*\{\s*color:\s*var\(--color-secondary-ink\)/);
});
