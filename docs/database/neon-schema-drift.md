# Neon schema and metadata drift report

**Task:** GEO-G0.4-META-01  
**Status:** COMPLETE (metadata audit); G0.4 is **not closable for remote schema**.  
**Audited:** 2026-09-30  
**Mode:** read-only Neon metadata tools and SELECT-only catalog queries. No migration, SQL write, branch/database/role/endpoint change, or test-row write was performed.

## Remote identity

The project was confirmed with a bounded `list_projects(search="GeoNexo", limit=20)` lookup. One matching project was returned:

| Item | Observed value |
|---|---|
| Project name | `GEONEXO` |
| Project ID | `cold-bonus-98807676` |
| Region | `aws-us-east-2` |
| PostgreSQL version | `18` |
| Default branch | `production` (`br-delicate-base-b4a2d3rl`) |
| Branch count | 1 (the default branch only) |
| Branch state | `ready`; `primary=true`; `default=true`; `protected=false` |
| Database | `neondb` (ID `605043`, owner `neondb_owner`) |

Only non-secret identifiers are recorded here. Connection strings, credentials, endpoint URLs, and account contact data are intentionally omitted.

## Remote object inventory

`get_database_tables(project_id, branch_id, database_name)` returned an empty list. `describe_branch` showed only the built-in `auth` and `public` schemas (plus built-in functions); it showed no application tables.

The required table descriptions were attempted individually with `describe_table_schema` and each returned `NotFoundError: Table not found`:

| Required table | Remote result | Expected source |
|---|---|---|
| `public.projects` | **ABSENT** | `packages/db/src/schema/projects.ts` |
| `public.maps` | **ABSENT** | `packages/db/src/schema/maps.ts` |
| `public.layers` | **ABSENT** | `packages/db/src/schema/layers.ts` |
| `public.features` | **ABSENT** | `packages/db/src/schema/features.ts` |
| `public.map_sources` | **ABSENT** | `packages/db/src/schema/map-sources.ts` |
| `public.imports` | **ABSENT** | `packages/db/src/schema/imports.ts` |
| `public.audit_events` | **ABSENT** | `packages/db/src/schema/audit-events.ts` |

Schema descriptions from a SELECT-only `pg_namespace` query:

| Schema | Description |
|---|---|
| `auth` | `NULL` |
| `public` | `standard public schema` |

## Extensions and indexes

SELECT-only catalog checks on `pg_extension` and `pg_indexes` returned empty results for the requested application requirements:

- `postgis`: **ABSENT**
- `pgcrypto`: **ABSENT**
- application indexes: **ABSENT**

The expected indexes from the current Drizzle schema/migration are therefore all absent remotely:

`audit_events_entity_idx`, `features_geometry_idx` (GiST), `features_layer_id_idx`, `layers_project_id_sort_order_idx`, and `layers_project_created_at_id_idx`.

The last index is declared in `packages/db/src/schema/layers.ts` but is not present in `packages/db/drizzle/0000_big_pete_wisdom.sql`; this is a repository-local migration/spec drift that must be resolved before a future remote migration. The other four indexes are represented by the migration file.

## Comparison with repository sources

The repository defines seven application tables in `packages/db/src/schema/` and the initial migration `packages/db/drizzle/0000_big_pete_wisdom.sql` creates those tables, `postgis`, and `pgcrypto`. The remote default branch contains none of them and neither extension. This is a complete remote absence, not a column-level mismatch.

No table descriptions/comments are available for the required tables because the tables do not exist. No remote schema facts support assuming the database matches Drizzle.

## G0.4 decision

**Metadata-only audit: PASS.** The Neon project, default branch, database, schemas, table absence, extension absence, and index absence are evidenced by named read-only checks above. A separate local disposable PostGIS target has also been reidentified and tested; see [disposable test targets](disposable-test-targets.md). This does not establish Neon connectivity or remote schema parity.

**G0.4 remote-schema gate: BLOCKED/PENDING.** The remote schema is not provisioned and cannot be considered aligned. Closing the gate requires an explicitly approved, versioned migration workflow (temporary Neon branch, migration test, approval, then application). That work is outside this read-only task and was intentionally not attempted.

## Evidence and stop conditions

Checks executed:

1. `mcp__Neon__list_projects` with bounded project-name search.
2. `mcp__Neon__describe_project`.
3. `mcp__Neon__get_default_branch`.
4. `mcp__Neon__list_branches`.
5. `mcp__Neon__list_postgres_databases`.
6. `mcp__Neon__get_database_tables`.
7. `mcp__Neon__describe_branch`.
8. `mcp__Neon__describe_table_schema` for each required table.
9. SELECT-only `pg_namespace`, `pg_extension`, and `pg_indexes` catalog queries through `mcp__Neon__run_sql`.

**Changed file:** `docs/database/neon-schema-drift.md` only.  
**Blocker for next step:** approved remote migration authority is required; no remote write was performed.
