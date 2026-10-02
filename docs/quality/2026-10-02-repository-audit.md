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
| PWA registration bootstrap | QUEBRADO | browser source used `process.env.NODE_ENV` under Vite; corrected in this audit branch |
| PWA/mobile physical validation | PARCIAL | automated mobile tests exist; physical install/update/offline evidence still pending |
| GeoPDF embedded georeference | FUNCIONA | ISO Measure/LGIDict path and real Araguaína evidence exist |
| GeoPDF manual calibration | PARCIAL | 3–6 control-point affine calibration exists; physical/E2E confirmation pending |
| Dataset import | PARCIAL | GeoJSON/JSON, PDF and GLB are exposed; legacy GIS round-trip remains pending |
| Android Capacitor pipeline | PARCIAL | workflow and permissions exist; latest HEAD artifact must be revalidated |
| iOS Capacitor pipeline | PARCIAL | macOS workflow exists; latest HEAD artifact must be revalidated |
| Remote file synchronization | NÃO IMPLEMENTADO | storage presign routes intentionally return 503 |
| Public API abuse protection | PARCIAL | workspace capability protects sync; public provision/recover endpoints have no explicit rate-limit layer |
| Release/privacy/signing | NÃO IMPLEMENTADO | privacy policy, store signing and public deployment remain pending |

## Corrections included in the audit branch

1. PWA registration now uses `import.meta.env.PROD`, the Vite-native production flag.
2. Regression test prevents `process.env.NODE_ENV` from returning to browser bootstrap code.
3. `*.pid` is ignored as a runtime artifact.
4. Versioned database cleanup migration removes the production-only obsolete import FK and redundant indexes.
5. Neon drift documentation was replaced with the current production state.

## Neon read-only evidence

- PostGIS 3.6.4 and pgcrypto 1.4 are installed.
- Domain and sync row counts were zero during this audit.
- No invalid indexes were found.
- No long-running queries or held locks were found.
- The private `geonexo-assets` bucket exists.
- A temporary branch validated the cleanup migration; production has not received it.

## Release blockers that require external evidence or a product decision

- live GitHub Actions result for the audit PR;
- physical Android offline/force-stop/GPS/GeoPDF test;
- physical iOS test;
- controlled two-installation sync/conflict smoke;
- production cleanup migration approval;
- privacy policy;
- release signing/provisioning;
- public web deployment/domain;
- decision/implementation for workspace provision/recover rate limiting;
- workspace-scoped remote file upload/download API.
