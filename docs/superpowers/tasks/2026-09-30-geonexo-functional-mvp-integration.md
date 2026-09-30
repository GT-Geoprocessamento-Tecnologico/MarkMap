# GeoNexo functional MVP integration

**Task ID:** GEO-FUNCTIONAL-MVP-INTEGRATION-2026-09-30  
**Role:** root frontend integration; L6 repository API delegated separately  
**Status:** active  
**Specification:** [functional MVP integration](../specs/2026-09-30-functional-mvp-integration.md)  
**Parent objective:** [functional local MVP](2026-09-30-geonexo-functional-mvp.md)

## Objective

Connect local project persistence, offline map packages, imported GeoJSON and existing PDF preview into user-facing flows so GeoNexo is practically usable in a browser without Neon.

## Scope

- Root-owned existing files: `apps/admin/src/lib/hooks/projects.ts`, `apps/admin/src/pages/projects/ProjectsPage.tsx`, `apps/admin/src/pages/projects/ProjectPage.tsx`, `apps/admin/src/pages/settings/SettingsPage.tsx`, and `apps/admin/src/pages/workspace/CommandCenterPage.tsx`.
- L6-owned repository API and focused tests are a separately bounded delegated task.
- Use existing W2 files/APIs; do not edit W2 storage/protocol modules or contracts.
- Add narrowly focused frontend tests only where needed to prove local project and offline package behavior.

## Acceptance criteria

1. Project create/list/detail runs locally without API/Neon, persists across reload, records one pending outbox operation, and never says it synced.
2. Settings installs, selects, lists and removes a licensed offline package from a user-selected local directory.
3. Command Center renders the selected package from IndexedDB with local PMTiles, glyphs and sprites, shows attribution, overlays saved local GeoJSON, and does not fall back to external styles/tiles while that package is selected.
4. Browser reload preserves package selection and project data. Real Chromium smoke blocks external requests while opening the map.
5. The existing PDF flow remains local and Araguaína's contradictory CRS/GPTS warning stays visible without map placement.
6. Fresh typecheck, focused tests, build, independent review, and diff check pass for the scoped changes.

## Risk, verification, and permissions

- Primary risk: map resource URL/protocol integration silently falls back to a network basemap or package selection loses local data. Verify from browser request traces and durable IndexedDB state.
- Local browser test package path: `C:\Users\MATEUS\AppData\Local\Temp\geonexo-g05-b5af6f8a6cab4b4cbde973301ed06453`; source/assets remain out of the repository. Prepare a separate temporary import copy if URL/hash rewriting is required; do not clean either directory.
- Workspace-local edits and tests are authorized. Do not write to Neon, commit, push, deploy, delete data/temp files, or stop the user's existing process.
- Expected evidence: exact commands and exits, installed package/archive hashes, browser route and rendered assertions, project/outbox persistence after reload, external request count, and independent reviewer result.
- Stop if package license/source validation fails, map requires arbitrary remote fallback, or contradictory PDF coordinates would need guessing.
