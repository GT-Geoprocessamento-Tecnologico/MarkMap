// Desenvolvido por MtsFerreira. Contrato testável entre os dois produtos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const config = read("apps/site/src/site-config.ts");
const url = new URL(config.match(/appDownloadUrl:\s*"([^"]+)"/)?.[1]);

test("site encaminha instalação à origem dedicada por HTTPS", () => {
  assert.equal(url.protocol, "https:");
  assert.equal(url.searchParams.get("install"), "1");
  assert.equal(url.pathname, "/");
  assert.match(read("apps/site/src/components/InstallAppButton.tsx"), /href=\{siteConfig\.appDownloadUrl\}/);
});

test("vitrine não instala PWA nem hospeda arquivos do app", () => {
  assert.doesNotMatch(read("apps/site/index.html"), /rel=["']manifest["']/);
  assert.doesNotMatch(read("apps/site/src/main.tsx"), /serviceWorker\.register/);
  assert.equal(existsSync(new URL("apps/site/public/manifest.json", root)), false);
  const vercel = JSON.parse(read("apps/site/vercel.json"));
  assert.ok(vercel.rewrites.every(({ destination }) => !/^https?:/i.test(destination)));
  const legacy = vercel.redirects.find(({ source }) => source === "/app");
  assert.equal(new URL(legacy.destination).origin, url.origin);
});

test("app mantém identidade standalone e autorização própria", () => {
  const manifest = JSON.parse(read("apps/admin/public/manifest.json"));
  for (const key of ["id", "start_url", "scope"]) assert.equal(manifest[key], "/");
  assert.equal(manifest.display, "standalone");
  assert.match(read("apps/admin/src/lib/pwa-install.ts"), /promptEvent\.prompt\(\)/);
  assert.match(read("apps/admin/src/App.tsx"), /shouldShowPwaInstallFlow/);
});

test("assinatura permanente mostra a versão declarada pelo app", () => {
  const app = JSON.parse(read("apps/admin/package.json"));
  const credits = read("apps/admin/src/lib/app-credits.ts");
  assert.ok(app.version);
  assert.match(credits, /Desenvolvido por MtsFerreira/);
  assert.match(credits, /import \{ version \} from "\.\.\/\.\.\/package\.json"/);
  for (const path of ["apps/admin/src/components/layout/RootLayout.tsx", "apps/admin/src/components/AppFooter.tsx"]) {
    const source = read(path);
    assert.match(source, /appCredits\.author/);
    assert.match(source, /appCredits\.version/);
  }
});
