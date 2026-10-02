# GeoNexo repository audit — 2026-10-02

**Baseline HEAD:** `3d21e1ce7946854c97e8f64a72ccc8e07ca93457`  
**Audit branch:** `audit/release-readiness-2026-10-02`

## Classification

| Area | State | Evidence / note |
|---|---|---|
| Local-first IndexedDB/outbox | FUNCIONA | transactional local repository, sync controller, reconnect/retry/conflict tests |
| Sync push/pull | FUNCIONA | workspace capability, idempotent receipts, cursor, tombstones and conflict flow are implemented |
| PostGIS materialization | FUNCIONA | project/map/layer/feature/import materialization; integration test validates Point + SRID 4674 |
| Production Neon base schema | FUNCIONA | tables/extensions present and empty |
| Production Neon schema parity | PARCIAL | duplicate import FK + four redundant indexes found; cleanup prepared |
| PWA service worker policy | FUNCIONA | API bypass, shell fallback, owned-cache cleanup and controlled update handshake tested |
| PWA registration bootstrap | FUNCIONA NO BRANCH DE AUDITORIA | Vite production flag corrected and regression covered |
| PWA/mobile physical validation | PARCIAL | automated mobile tests exist; physical install/update/offline evidence still pending |
| GeoPDF embedded georeference | FUNCIONA | ISO Measure/LGIDict path and real Araguaína evidence exist |
| GeoPDF manual calibration | PARCIAL | 3–6 control-point affine calibration exists; physical/E2E confirmation pending |
| Dataset import | PARCIAL | GeoJSON/JSON, PDF and GLB are exposed; legacy GIS round-trip remains pending |
| Android Capacitor pipeline | PARCIAL | workflow and permissions exist; current PR does not execute Android workflow |
| iOS Capacitor pipeline | PARCIAL | macOS workflow exists; current PR does not execute iOS workflow |
| Remote file synchronization | NÃO IMPLEMENTADO | storage presign routes intentionally return 503 |
| Public API abuse protection | PARCIAL | workspace capability protects sync; public provision/recover endpoints have no explicit distributed rate limit |
| Release/privacy/signing | NÃO IMPLEMENTADO | privacy policy, store signing and public deployment remain pending |
| Repository hygiene | FUNCIONA NO BRANCH DE AUDITORIA | runtime/stale artifacts removed; README aligned to real repository structure |

## Corrections included in the audit branch

1. PWA registration uses `import.meta.env.PROD`.
2. Regression test prevents `process.env.NODE_ENV` from returning to browser bootstrap code.
3. Runtime/stale files are removed and `*.pid` is ignored.
4. Stale README content is replaced with the current stack, structure and offline-first flow.
5. Versioned database cleanup migration removes the production-only obsolete import FK and redundant indexes.
6. Neon drift documentation reflects the current production state.

## GitHub checks on PR #2

At the audited PR head, these checks completed successfully:

- Lint
- Typecheck
- Unit Tests
- Build all packages
- Playwright E2E
- Playwright E2E (iOS mobile emulation)
- Offline sync → PostGIS → pull

Android APK and iOS App workflows are push-to-main/workflow-dispatch only, so they are not proven by the PR checks.

## Neon read-only evidence

- PostgreSQL 18.
- PostGIS 3.6.4 and pgcrypto 1.4.
- Domain and sync tables present.
- Domain and sync row counts were zero during this audit.
- Duplicate `imports` FK and four redundant indexes remain in production until explicitly approved cleanup.
- No long-running queries or held locks.
- Private bucket `geonexo-assets` exists.
- Temporary branch `br-mute-unit-b4nkmmlb` validated the cleanup migration; production remains unchanged.

## Release blockers

- merge/revalidate the audit corrections on main;
- Android APK validation for the resulting main HEAD;
- iOS archive validation for the resulting main HEAD;
- physical Android offline/force-stop/GPS/GeoPDF test;
- physical iOS test;
- controlled two-installation sync/conflict smoke;
- production cleanup migration approval;
- privacy policy;
- release signing/provisioning;
- public web deployment/domain;
- distributed abuse protection for workspace provision/recover;
- workspace-scoped remote file upload/download API;
- legacy GIS format round-trip validation.
