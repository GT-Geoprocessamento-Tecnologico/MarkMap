# Modelo de dados

## Banco remoto

PostgreSQL/Neon com PostGIS.

SRID canônico das geometrias: **4674 (SIRGAS 2000)**.

## Tabelas principais

### workspaces

Identifica o escopo isolado de sincronização.

Campos relevantes:

- `id`
- `proof_digest`
- `capability_hash`
- `generation`
- `next_sequence`
- `revoked`
- timestamps

### projects

Projeto dentro de workspace.

- `id`
- `workspace_id`
- `name`
- `description`
- `status`
- timestamps e soft delete

### maps

Mapa vinculado a projeto.

- `workspace_id`
- `project_id`
- nome/descrição
- centro/zoom padrão

### layers

Camada GIS.

- tipos: `point`, `line`, `polygon`, `mixed`, `raster`, `remote`;
- `geometry_type`;
- `srid = 4674`;
- style/metadata JSON;
- visibilidade/ordem;
- soft delete.

### features

Feição vetorial.

- `workspace_id`
- `layer_id`
- `geometry(Geometry,4674)`
- `properties jsonb`
- `version`
- timestamps/soft delete

Índices incluem GiST na geometria e índice por layer.

## Sincronização

### sync_entities

Estado materializado por `workspace + entity + entity_id`.

### sync_operations

Log idempotente de operações aceitas, com `version` e sequência monotônica.

### sync_tombstones

Exclusões propagáveis para pull incremental.

### upload_sessions

Sessões de upload previstas no schema. O storage remoto ainda não está funcional pela API atual.

## Outras tabelas

O schema também exporta:

- `map_sources`
- `imports`
- `audit_events`

## Migrations

Versionadas em `packages/db/drizzle/`.

A migration `0002_sync_schema_cleanup.sql` existe no repositório; execução remota deve ser tratada separadamente e não é implícita por estar versionada.
