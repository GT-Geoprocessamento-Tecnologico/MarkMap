# Dependency & Secret Audit — 2026-09-28 (branch `agent/security`)

## Secrets — git / arquivos

- `glob **/.env*`: só `.env.example` no código próprio (placeholders) + `.env` de repos vendorizados em `REPOSITORIOS MODELOS/` (`SQLX_OFFLINE=true`, valores vazios/comentados). Nenhum `.env` real.
- `grep` (fora `node_modules/.git`): nenhum token/chave privada/`akIA`/`ghp_`/`sk-live` no código próprio. Achados avaliados:
  - `docker-compose.yml` senha `geonexo` (dev local) → externalizada para `${POSTGRES_PASSWORD}`/`${DATABASE_URL}` neste branch.
  - `services/api/tests/api.test.ts` usa `postgres://user:…` como **fixture de teste anti-vazamento** (falso positivo intencional).
  - `REPOSITORIOS MODELOS/martin-main/.../demo/certs/private.pem` → demo de terceiro, não segredo próprio — mas reforça mover a pasta para fora do git.
- `.gitignore` endurecido: `.env*` + `!.env.example` + `*.pem/*.key/*.p12/*.pfx` + `*credentials*/*secrets*/service-account*` + `users.yml`.
- **Histórico Git — varredura conclusiva (4 commits: `7586111`, `c294b2c`, `ea9851f`, `75d02e7`):**
  - `git log --all -S "DATABASE_URL|POSTGRES_PASSWORD|SECRET|TOKEN|PASSWORD|PRIVATE KEY"`: hits só em `c294b2c` (vendored terceiro) e `ea9851f` (menção "No DATABASE_URL exposed" no spec, sem valor).
  - Excluindo `REPOSITORIOS MODELOS/`, o único hit é a menção diretiva do spec — nenhum valor.
  - `7586111` = `.gitattributes` + zips vendored; `75d02e7` = 4 arquivos raiz (`.env.example` com placeholders `NEON_DB_URL=`/`ADMIN_PORT=`/`API_PORT=`, sem valores).
  - `git grep` na árvore `75d02e7` por `ghp_|AKIA|sk-live|AIza|BEGIN .*PRIVATE KEY|xox[bap]-` e `postgres://|POSTGRES_PASSWORD`: **zero** fora do vendored.
  - Working tree: único match é a fixture intencional `api.test.ts:113` (teste anti-vazamento).
  - `gitleaks` não instalado na máquina; pickaxe + grep acima cobrem os 4 commits na íntegra (repo pequeno, diffs revisáveis). Recomendado adicionar `gitleaks detect` no CI (tarefa da qualidade no handoff).

## `pnpm audit --audit-level=moderate` — 13 vulnerabilidades

| Pacote (instalado) | CVE/GHSA | Sev | Ação (owner) |
|---|---|---|---|
| vitest (<3.2.6, file-read via UI) | GHSA-5xrq-8626-4rwp | critical | upgrade vitest ≥3.2.6 (qualidade; dev-only, P3) |
| maplibre-gl 4.7.1 (XSS sanitizer bypass) | GHSA-jrc7-96c5-q579 | critical | upgrade ≥6.4.1 (frontend/mapas; P1 futuro-XSS) |
| drizzle-orm 0.35.3 (SQLi em identificadores) | GHSA-gpj5-g38j-94v9 | high | upgrade ≥0.45.2 antes do 1º CRUD (backend/db; P1) |
| vite 5.4.21 (fs.deny bypass Win) | GHSA-fx2h-pf6j-xcff | high | upgrade série 5.4.x/6+/7 (frontend; P2 dev-only) |
| esbuild ≤0.24.2 (dev-server cross-site) | GHSA-67mh-4wv8-2f99 | moderate | sobe junto com vite (P3) |
| vite (path traversal `.map`) | GHSA-4w7w-66w2-5vf9 | moderate | idem (P3) |
| vite/launch-editor (NTLMv2 via UNC, Windows) | GHSA-v6wh-96g9-6wx3 | moderate | idem (P2 em Windows) |
| vitest/@vitest/mocker (path traversal) | GHSA-82fw-gwwq-j7x9 | moderate | upgrade ≥4.1.11 (P3) |

Nenhum upgrade aplicado neste branch de propósito: trocar versão de lib aprovada sem evidência de exploração local quebraria ownership (backend/frontend) e builds. Upgrades viram tarefas P1–P3 no handoff.

## Licenças — verificação conclusiva do núcleo

- Scan em `apps/ services/ packages/ frontend/ e2e/ infra/` (só código próprio, fora `node_modules`), padrões `SPDX-License-Identifier|General Public License|Affero|GNU GPL|gratis-gis|smash-master|tippecanoe|titiler|supercluster|geojson-vt`: **zero matches**.
- `glob {LICENSE*,NOTICE*,COPYING*,THIRD_PARTY*}`: hits **só** em `REPOSITORIOS MODELOS/`; raiz e núcleo sem `LICENSE`/`NOTICE` (P2 — criar antes de distribuir, decisão do mantenedor).
- `package.json` first-party (8 pkgs, fora `node_modules`): todos `private: true`, sem campo `license` — sem contaminação via metadados.
- Vendored confirmado: `gratis-gis` = **AGPL-3.0**, `smash` = **GPL-3.0** (headers lidos nos arquivos LICENSE). Nenhum código deles no núcleo (zero referências). Risco residual = copy-paste acidental futuro → recomendação = extrair a pasta do git (submódulo ou fora do repo).
- Dependências npm auditadas são MIT/Apache-2.0 (verificado via `pnpm list`: zod/vitest/typescript MIT/Apache; turf/proj4/eslint MIT) — compatíveis.
