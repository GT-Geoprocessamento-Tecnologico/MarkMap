# Arquitetura

## Visão

```text
React 18 + Vite + TypeScript
        |
        +-- TanStack Router / Query
        +-- MapLibre + Terra Draw
        +-- IndexedDB / LocalRepository
        +-- SyncEngine
        +-- Capacitor (Android/iOS)
        |
        | HTTP quando VITE_API_MODE=live
        v
Hono API
        |
        +-- capability de workspace
        +-- /sync/push
        +-- /sync/pull
        +-- rotas de domínio em ambiente não-production
        |
        v
@geonexo/db
        |
        v
PostgreSQL / Neon + PostGIS
```

## Frontend

Aplicação principal em `apps/admin`.

- React 18.
- Vite.
- TanStack Router.
- TanStack Query configurado com `networkMode: "offlineFirst"`.
- Zustand para estado local de UI onde aplicável.
- MapLibre para mapa.
- Terra Draw para edição vetorial.
- PDF.js no app e `@geonexo/geo` para lógica GIS/GeoPDF.
- Capacitor como ponte nativa.

## Persistência local

`apps/admin/src/lib/local-db` cria stores IndexedDB:

- `meta`
- `entities`
- `originals`
- `outbox`
- `conflicts`
- `acks`

`LocalRepository` mantém mutações locais duráveis antes de qualquer dependência da rede.

## Backend

`services/api` usa Hono.

Controles globais observados:

- request ID;
- headers seguros;
- CORS allowlist;
- logging;
- limite de corpo de 1 MiB para POST/PATCH;
- error handler;
- graceful shutdown.

## Banco

`packages/db` usa Drizzle e PostgreSQL/PostGIS.

SRID canônico de feições: **EPSG:4674 / SIRGAS 2000**.

## Isolamento

A sincronização utiliza uma capability vinculada a um workspace. O bearer é armazenado como hash no servidor; o cliente recebe a capability e a persiste localmente.

## Regra arquitetural

Não criar caminhos paralelos para:

- persistência offline;
- sincronização;
- contratos;
- GIS;
- PWA;
- mobile.

Mudanças devem evoluir os módulos existentes.
