# MarkMap

MarkMap é uma aplicação GIS **offline-first** para planejamento e trabalho de campo, com React/Vite, MapLibre, Terra Draw, IndexedDB/outbox e sincronização por API Hono para PostgreSQL/Neon + PostGIS.

## Produtos no monorepo

- `apps/admin`: aplicação operacional Web/PWA + núcleo usado pelo Capacitor Android/iOS;
- `apps/site`: site público da MarkMap para apresentação e futura distribuição;
- `services/api`: API Hono;
- `packages/*`: contratos, banco, GIS, mapas e UI compartilhada.

**Contrato de separação:** site e app vivem em subdomínios distintos e mantêm deploy, PWA e armazenamento independentes. O site somente encaminha a instalação para o app; detalhes: [docs/site-app-boundaries.md](docs/site-app-boundaries.md).

## Estado atual

- operação local: IndexedDB + outbox;
- sync: push/pull, retry, idempotência, tombstones e conflitos explícitos;
- PWA: manifest, service worker, cold offline e upgrade local;
- GIS: MapLibre, Terra Draw, SIRGAS 2000, GeoPDF e calibração;
- mobile: Capacitor Android/iOS;
- identidade pública: **MarkMap — Planejamento Inteligente**.

## Desenvolvimento

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Site público:

```bash
pnpm --filter markmap-site dev
```

## Gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Compatibilidade da migração de marca

Os namespaces internos `@markmap/*`, nomes históricos de infraestrutura e identificadores remotos existentes permanecem temporariamente preservados para evitar quebra de contratos, storage e sincronização. A marca exibida ao usuário é MarkMap; identificadores nativos existentes permanecem estáveis por compatibilidade de instalação e dados locais.

## Regras importantes

- Toda atualização publicada do app deve incrementar a versão numérica em `apps/admin/package.json` e registrar a entrega em [CHANGELOG.md](CHANGELOG.md). Todos os agentes seguem [AGENTS.md](AGENTS.md) e a [política de versionamento](docs/versioning.md); `pnpm verify:version` verifica o candidato.
- offline-first continua sendo requisito central;
- não introduzir arquitetura paralela de offline/sync/GIS;
- não colocar credenciais privilegiadas no cliente;
- não executar migration destrutiva, deploy público, release/tag, publicação ou rotação de secrets sem autorização explícita.

Documentação oficial: [`docs/`](docs/README.md).
