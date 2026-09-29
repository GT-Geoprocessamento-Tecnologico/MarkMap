# Handoff Segurança → demais agentes (2026-09-28, branch `agent/security`)

## O que a segurança alterou fora do seu ownership (mudança mínima, revisar)

1. `services/api/src/app.ts` (+2 linhas): `secureHeaders()` do `hono/secure-headers` após `requestId()`. Sem mudança de contrato; só headers (`nosniff`, `Referrer-Policy`, `DENY`, `Permissions-Policy`…). Se o MapLibre reclamar de `worker-src` no futuro, ajustar CSP aqui.
2. `services/api/src/env.ts` (`loadEnv`): `CORS_ORIGINS` agora fail-closed — rejeita `*` e origem fora de `^https?://host[:porta]$` com erro no boot. Default `http://localhost:5173` inalterado; se algum teste setar origem custom, precisa estar nesse formato.
3. `docker-compose.yml`: `DATABASE_URL`/`POSTGRES_PASSWORD` agora via `${VAR:-default-dev}`. Local continua igual sem `.env`; ambientes compartilhados **devem** exportar as vars (nunca reutilizar `geonexo/geonexo`).
4. `.env.example`: só comentários + placeholder `POSTGRES_PASSWORD`. Nenhuma var renomeada.
5. `.gitignore`: cobre `.env*`, chaves e `users.yml`. `infra/martin/users.yml` (quando criado) já nasce ignorado.

## Tarefas pedidas (não fiz para não invadir ownership)

- **@backend-visionario / @database**: upgrade `drizzle-orm` → ≥0.45.2 antes do 1º CRUD (SQLi em identificadores, P1); `bodyLimit` ~1 MB nas futuras rotas POST/PATCH; aplicar tetos da `docs/security/ssrf-upload-rules.md §4` no contrato via proposta (não editei `packages/contracts` para não quebrar os 45 testes).
- **@frontend-visionario / GIS-mapas**: upgrade `maplibre-gl` → ≥6.4.1 (XSS bypass, P1) e `vite` 5.4.21 → patch mais novo (P2); popup futuro só com `textContent`/`setDOMContent` (regra em `ssrf-upload-rules.md §3`).
- **@qualidade-visionario**: upgrades `vitest`/`esbuild` (P3 dev-only); adicionar ao CI: `pnpm audit --audit-level=moderate` + `gitleaks detect --source .` (histórico já varrido por pickaxe+grep neste branch — CI é para os próximos commits).
- **mantenedor**: criar `LICENSE` raiz (P2); decidir extração de `REPOSITORIOS MODELOS/` do git (AGPL/GPL + `private.pem` demo + bloat, P2).

## Docs de segurança (fonte de verdade a partir daqui)

`docs/security/threat-model.md` · `ssrf-upload-rules.md` · `dependency-audit-2026-09-28.md` · este handoff.
