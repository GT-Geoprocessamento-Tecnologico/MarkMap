# GeoNexo

GeoNexo é uma aplicação GIS **offline-first** para trabalho de campo, com interface React/Vite, mapas MapLibre, edição vetorial Terra Draw, armazenamento operacional local em IndexedDB e sincronização posterior por API Hono para PostgreSQL/Neon + PostGIS.

## Estado atual

- Fonte operacional no dispositivo: **IndexedDB + outbox**.
- Sincronização remota: **push/pull**, cursor incremental, idempotência, tombstones e conflitos explícitos.
- Mobile: **Capacitor** para Android e iOS.
- GIS: MapLibre, Terra Draw, CRS SIRGAS 2000 e suporte GeoPDF.
- Qualidade: lint, typecheck, unit, build, E2E e integração PostGIS em GitHub Actions.
- Fase: MVP instalável em validação de campo.

## Desenvolvimento rápido

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Principais gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Documentação

A documentação técnica e operacional está centralizada em [`docs/`](docs/README.md).

Comece por:

- [Visão geral](docs/overview.md)
- [Arquitetura](docs/architecture.md)
- [Instalação e configuração](docs/setup.md)
- [Desenvolvimento](docs/development.md)
- [Testes e qualidade](docs/testing.md)
- [API](docs/api-reference.md)
- [Modelo de dados](docs/data-model.md)
- [Offline e sincronização](docs/sync-flow.md)
- [GIS e GeoPDF](docs/gis-geopdf.md)
- [Android e iOS](docs/mobile.md)
- [Segurança](docs/security.md)
- [Deploy e distribuição](docs/deployment.md)
- [Status técnico](docs/status.md)
- [Auditoria do repositório](docs/repository-audit.md)

## Estrutura

```text
apps/admin       PWA e app Capacitor
services/api     API Hono
packages/*       contratos, banco, GIS, mapas, UI e utilitários
docs             documentação oficial do repositório
.github/workflows CI, build, E2E, integração e builds mobile
```

## Regras importantes

- Não introduzir uma segunda arquitetura de offline/sync/GIS.
- Não colocar credenciais do banco no cliente.
- Não executar migration destrutiva, deploy público, release, publicação em loja ou rotação de secrets sem autorização explícita.
- Não considerar testes físicos concluídos a partir de emulação ou CI.

Para dependências e atribuições de terceiros, consulte [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
