# Neon schema and metadata drift report

**Status:** AUDITED — cleanup migration prepared and validated; production application pending explicit approval.  
**Audited:** 2026-10-02  
**Project:** `GEONEXO` (`cold-bonus-98807676`)  
**Default branch:** `production` (`br-delicate-base-b4a2d3rl`)  
**Database:** `neondb`

## Current production state

Read-only catalog checks confirm:

- PostgreSQL 18;
- `postgis` 3.6.4;
- `pgcrypto` 1.4;
- application/domain tables are present;
- workspace/sync tables are present;
- all audited application tables are currently empty;
- no invalid/not-ready indexes;
- no queries running longer than five minutes;
- no locks held at audit time;
- bucket `geonexo-assets` exists with private access.

Production tables observed:

- `projects`
- `maps`
- `layers`
- `features`
- `map_sources`
- `imports`
- `audit_events`
- `workspaces`
- `sync_entities`
- `sync_operations`
- `sync_tombstones`
- `upload_sessions`

Only non-secret identifiers are recorded here.

## Drift found

### 1. Duplicate target-layer foreign key on `imports`

Production contains both:

- `imports_target_layer_id_fkey` → `ON DELETE SET NULL`
- `imports_target_layer_id_layers_id_fk` → `ON DELETE CASCADE`

The current Drizzle schema expects the CASCADE behavior. The SET NULL constraint came from the manual production bootstrap and remained when the versioned workspace migration added the intended named CASCADE constraint.

### 2. Redundant indexes

The following indexes duplicate indexes already supplied by UNIQUE/PRIMARY KEY constraints:

- `workspaces_capability_hash_idx` duplicates `workspaces_capability_hash_key`;
- `sync_entities_pk` duplicates `sync_entities_pkey`;
- `sync_operations_workspace_operation_idx` duplicates `sync_operations_pkey`;
- `sync_tombstones_key_idx` duplicates `sync_tombstones_pkey`.

They add write/storage overhead without changing uniqueness guarantees.

## Versioned correction

Repository migration:

`packages/db/drizzle/0002_sync_schema_cleanup.sql`

It removes only the obsolete SET NULL FK and redundant indexes. It does not remove application data or primary/unique constraints.

A Neon temporary migration branch was prepared and the cleanup executed successfully:

- migration id: `d8e4b27f-d9f0-40d0-9574-13f215efb760`;
- temporary branch: `br-mute-unit-b4nkmmlb`;
- parent: production `br-delicate-base-b4a2d3rl`.

Read-only verification on the temporary branch confirms:

- only the intended CASCADE target-layer FK remains;
- the composite workspace-layer FK remains;
- primary/unique constraint-backed indexes remain;
- the four redundant indexes are absent.

## Production decision

**Production is still unchanged by this cleanup.**

Applying the prepared migration to production is a destructive DDL action (constraint/index removal) and requires explicit authorization before `complete_database_migration` may be called.

## Remaining infrastructure notes

- production branch is not protected;
- project is on Neon Free v3;
- the database currently has no domain/sync rows, so application behavior still needs a controlled live sync smoke before release;
- remote object storage exists, but the API storage presign routes remain deliberately unavailable until a workspace-scoped authorization design is completed.
