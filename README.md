# GeoNexo

GeoNexo é uma aplicação GIS de campo **offline-first**. O trabalho operacional acontece no dispositivo; a sincronização remota usa a API Hono e Neon/PostGIS quando há conectividade.

## Stack

- React + Vite + TypeScript
- Hono
- Drizzle ORM
- Neon PostgreSQL + PostGIS
- MapLibre GL + Terra Draw
- IndexedDB + outbox
- PDF.js + Proj4
- Capacitor para Android/iOS
- pnpm + Turborepo

## Pré-requisitos

- Node.js 22
- pnpm 9.15.9
- Docker, apenas para integrações locais que precisem de Postgres/PostGIS

## Instalação

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Desenvolvimento do frontend:

```bash
pnpm dev
```

O admin abre por padrão em `http://localhost:5173`.

## Estrutura

```text
apps/
  admin/        React/Vite, PWA e empacotamento Capacitor

services/
  api/          API Hono

packages/
  config/       configuração compartilhada
  contracts/    contratos Zod e tipos
  db/           Drizzle, schema, migrations e queries
  geo/          CRS, GeoPDF e utilitários GIS
  maps/         MapLibre, Terra Draw e mapas offline
  ui/           componentes compartilhados

docs/
  adr/
  api/
  database/
  quality/
  security/

scripts/
.github/workflows/
```

## Offline-first

O fluxo principal é:

```text
UI
→ IndexedDB/local repository
→ outbox
→ trabalho continua sem rede
→ conectividade disponível
→ /sync/push
→ Neon/PostGIS
→ /sync/pull
→ IndexedDB
```

Neon não é requisito para criar ou editar dados em campo.

## Variáveis de ambiente

Frontend: `apps/admin/.env.example`.

Principais variáveis:

```env
VITE_API_MODE=mock
VITE_API_URL=/api/v1
```

Para usar a API real, defina `VITE_API_MODE=live` e a URL da API.

Backend:

- `DATABASE_URL` ou `NEON_DB_URL`
- `CORS_ORIGINS`
- `HOST`
- `PORT`
- `LOG_LEVEL`
- variáveis S3 somente quando o fluxo remoto de arquivos for habilitado

Nunca commite credenciais ou connection strings reais.

## Banco

O banco remoto usa Neon PostgreSQL + PostGIS. A persistência espacial canônica usa EPSG:4674 / SIRGAS 2000.

Migrations versionadas ficam em:

```text
packages/db/drizzle/
```

Mudanças de produção devem seguir o fluxo de migration validada em ambiente/branch descartável antes da aplicação final.

## Qualidade

Gates principais:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Workflows relevantes:

- CI
- Build
- E2E Tests
- PostGIS Integration
- Android APK
- iOS App

## Mobile

Android e iOS reutilizam o mesmo núcleo React/Vite via Capacitor.

O repositório possui workflows para gerar artefatos de debug. Publicação em loja, signing e provisioning são etapas separadas de release.

## Continuidade

Antes de uma mudança relevante, consulte:

1. `GEONEXO_INSTRUCOES_MESTRE_PROJETO.md`
2. `GEONEXO_HANDOFF_CONTINUIDADE.md`
3. ADRs em `docs/adr/`
4. documentação da área afetada
5. HEAD atual e checks de CI

O estado dinâmico do projeto deve ser validado contra o código e a infraestrutura atuais.
