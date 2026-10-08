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

## Maps Engine v2 offline

Iniciativa em `feat/maps-engine-v2-offline` (PRD:
`docs/markmap-maps-engine-v2-prd-handoff.md`). Pilha preservada; novos módulos
entram dentro dos pacotes existentes.

```text
scripts/region-pipeline.mjs (build time, offline)
        |
        +-- search/shard-*.json      sharded search index
        +-- routing/graph.json       routing graph
        +-- elevation/contours.json  contours + DEM metadata
        +-- osm/*.pbf, style.json
        +-- manifest.json            v2 + checksums
        v
package regional (staged -> validated -> atomically activated)
        |
        +-- @geonexo/contracts  schemas (elevation, routing, content, offline-map v2)
        +-- @geonexo/maps       search | routing | elevation | content | security | automotive
        +-- @geonexo/geo        gpx.ts / kml.ts / navigation.ts
        |
        v
MapLibre + Web Worker (search, routing) + IndexedDB/OPFS (LargeBlobStore)
```

Módulos novos:

- `packages/maps/src/search` — índice sharded por primeira letra normalizada,
  prefixo binário + Levenshtein, relevância; nunca chama API remota;
- `packages/maps/src/routing` — `findRoute` (Dijkstra custo-tempo, perfis
  walk/bicycle/car), manobras por bearing, TTS local pt-BR; módulo puro apto a
  Web Worker;
- `packages/maps/src/elevation` — `sampleDem`/`sampleDemBilinear`,
  `computeElevationProfile`, `generateContours` (marching squares);
- `packages/maps/src/content` — `WikipediaStore` + sanitização de HTML,
  `TransitStore`;
- `packages/maps/src/security` — path safety, checksum, limites de tamanho,
  defesa XML/zip bomb, sanitização de URL;
- `packages/maps/src/automotive` — adaptadores Android Auto / CarPlay;
- `packages/geo/src/gpx.ts` / `kml.ts` — parsers regex sem `DOMParser` (sem
  vetor XXE) e sem dependência de zod.

Decisões registradas: `ADR-0004` (pacote v2 + ativação atômica),
`ADR-0005` (LargeBlobStore multi-backend),
`ADR-0006` (roteamento offline custo-tempo).

## Regra arquitetural

Não criar caminhos paralelos para:

- persistência offline;
- sincronização;
- contratos;
- GIS;
- PWA;
- mobile.

Mudanças devem evoluir os módulos existentes.
