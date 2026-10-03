# GeoNexo

GeoNexo é uma aplicação GIS **offline-first** para trabalho de campo, com React/Vite, MapLibre, Terra Draw, IndexedDB/outbox e sincronização por API Hono para PostgreSQL/Neon + PostGIS.

## Estado atual

- operação local: IndexedDB + outbox;
- sync: push/pull, retry, idempotência, tombstones e conflitos explícitos;
- PWA: manifest, service worker, cold offline e upgrade local automatizados;
- GIS: MapLibre, Terra Draw, SIRGAS 2000, GeoPDF e auto-calibração por grade;
- mobile: Capacitor opcional Android/iOS;
- qualidade: lint, typecheck, unit, build, E2E, PostGIS, Lighthouse/a11y, dependency audit e secret scan.

## Desenvolvimento rápido

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

## Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Documentação

A documentação oficial está em [`docs/`](docs/README.md). Para preparação de release use [`docs/release-runbook.md`](docs/release-runbook.md).

## Estrutura

```text
apps/admin       PWA e app Capacitor
services/api     API Hono
packages/*       contratos, banco, GIS, mapas e UI
docs             documentação oficial
.github/workflows CI, E2E, integração, qualidade/segurança e builds mobile
```

## Regras importantes

- não introduzir arquitetura paralela de offline/sync/GIS;
- não colocar credenciais privilegiadas no cliente;
- não executar migration destrutiva, deploy público, release/tag, publicação ou rotação de secrets sem autorização explícita;
- não considerar testes físicos concluídos a partir de CI.

Para dependências e atribuições consulte [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
