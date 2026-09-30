# GeoNexo baseline repair evidence — 2026-09-30

**Task:** GEO-LOCALFIRST-2026-09-29. **State:** repaired baseline checks pass; full product objective is incomplete. New subsystem plan has passed independent documentation review and awaits the user's written-plan review.

**Checkout:** `D:/MATEUS/Documentos/GitHub/GeoNexo-localfirst`, `feature/geonexo-localfirst-geopdf`, base `a80586a5f2e8aca8c21ff88a661e21e7f61c941e`. Main remains clean at the same base. No commit/push/deploy or production database write.

## Fresh root evidence after all source writers finished

All Turbo commands used `--force`, `--concurrency=1`; test arguments were passed through a literal PowerShell argv array so Vitest alone received `--maxWorkers=1`.

| Check | Actual command | Result |
| --- | --- | --- |
| Lint | `turbo run lint --force --concurrency=1` | exit 0; 7/7 tasks; 24 existing explicit-any warnings, no errors |
| TypeScript | `turbo run typecheck --force --concurrency=1` | exit 0; 7/7 tasks |
| Unit suites | `turbo run test --force --concurrency=1 -- --maxWorkers=1` | exit 0; 12/12 tasks; 253 passed, 15 PostGIS cases skipped here |
| Build | `turbo run build --force --concurrency=1` | exit 0; 7/7 tasks |
| Real PostGIS | `pnpm --filter @geonexo/db exec vitest run tests/integration/postgis.test.ts --maxWorkers=1` with the identified disposable `TEST_DATABASE_URL` | exit 0; 15/15 passed |
| Existing browser smoke | `pnpm --filter admin exec playwright test --workers=1` | exit 0; 3/3, Chromium/Firefox/WebKit |
| Package audit | `pnpm audit --json` | exit 0; zero advisories across 1006 dependencies |
| Whitespace/diff | `git diff --check` | exit 0 |

Unit counts: geo 36, UI 18, maps 22, contracts 106, DB 15, admin 11, API 45. The separate live PostGIS run executes the 15 cases skipped by the generic suite; skipped cases were not counted as passed there.

Local PostGIS target positively identified: owned healthy container `geonexo-localfirst-test-20260929`, `127.0.0.1:52435`, database `geonexo_localfirst_test`. Original local database and Neon production were not test targets. Earlier CLI `drizzle-kit migrate` against this disposable target also exited 0; the final integration suite exercises migrations through its real postgres-js migrator.

Logs under the session TEMP directory:

- `geonexo-lint-final-20260930.log`
- `geonexo-typecheck-final-20260930.log`
- `geonexo-test-final-20260930.log`
- `geonexo-build-final-20260930.log`
- `geonexo-postgis-final-20260930.log`
- `geonexo-e2e-final-20260930.log`
- `geonexo-audit-final-20260930.json`
- `geonexo-api-runtime-evidence-20260930.log`
- `geonexo-production-sw-evidence-20260930.log`

## Real built API runtime

Root spawned the built `services/api/dist/server.js` with an isolated test DB and an OS-selected loopback port. Actual startup/readiness URL was `http://127.0.0.1:64589`; this temporary API was closed after the diagnostic, so it is not a persistent preview URL.

- `/api/v1/health`: HTTP 200 with real disposable PostGIS.
- Project creation: HTTP 201; nullable DB description omitted, date serialized as ISO and UUID returned.
- Project list/page two: HTTP 200, real cursor, no repeated first project.
- Invalid cursor: HTTP 400.
- Unauthenticated storage presign: HTTP 503, fail closed.
- Diagnostic exit 0; owned API child closed. This proves current server/runtime/local DB behavior, not a Neon application round trip or synchronization.

## Production service-worker/browser diagnostic

The actual Vite preview URL is `https://127.0.0.1:4173/`; loopback readiness returned HTTP 200. Automatic policy review rejected the attempt to open the system browser, reporting only `blocked by policy`; no automatic opening is claimed. The preview remains available for manual inspection. The HTTPS certificate is the existing local development certificate; Playwright explicitly accepts it. This is a local built-app preview, not deployment.

Root used installed Chromium with external requests denied and bounded DOM/SW waits. The worker was **activated and controlling the page** before offline testing.

```text
ONLINE_SHELL_VISIBLE=true
SW_ACTIVATED_AND_CONTROLLED=true
CACHE_INITIAL=[/, index.html, manifest.json, icon-192x192.png, icon-512x512.png]
FIRST_OFFLINE_RELOAD_VISIBLE=false
CACHE_AFTER_CONTROLLED_RELOAD includes the emitted hashed JS and CSS
WARM_OFFLINE_DEEPLINK_VISIBLE=true
OFFLINE_API=network-error
SW_DIAGNOSTIC_EXIT=0
```

The diagnostic completed while detecting a missing requirement: initial installation does not precache the emitted application bundles. Cold offline relaunch is **not ready**. A controlled online reload warms those bundles and permits `/projects` offline, which is weaker evidence. PWA plan W1 repairs complete precaching and update behavior; no installed-native or complete-offline claim follows from current smoke tests.

The existing three-engine E2E only asserts `/` navigation, title and a visible GeoNexo label. It contains no sync/import/sensor/installation assertions and no explicit check of every possible login route. Do not extrapolate it to full product acceptance.

## Repairs and independent review

- Dependency/config gates, Vitest/Playwright wiring and legitimate legacy contracts are repaired without excluding retained source/tests.
- PostgreSQL adapter/handle ownership, sanitized health, shutdown deadlines, domain errors and API/body/geometry/property validation have regression coverage.
- Map popup uses text nodes; service-worker policy bypasses API/non-GET/foreign requests and preserves foreign caches.
- Project list uses the database, matches frontend wire schema and forwards pagination. DB keyset ordering/filtering uses consistent millisecond precision plus UUID tie-breaking; real sub-millisecond project/layer/feature regression proves no dropped/duplicate records.
- Storage presigning stays disabled until workspace authorization/scoped keys are implemented. This closes arbitrary-key access exposure; real uploads remain unavailable.
- **GEO-REVIEW-FINAL-36:** independent read-only technical review passed with explicit residuals. Final focused checks passed 11 API and 15 DB-unit cases; no live DB writes by reviewer.
- **GEO-REVIEW-PLAN-31FINAL:** independently reread four plans and passed after resolving contract, recovery, cursor, upload and ownership inconsistencies.

## Material remaining work

1. No GeoPDF parser/rendering/calibration/PDF map layer exists; candidate APIs are research, not fixture proof.
2. Product paths still default to mock data; transactional local entities/outbox, workspace capability, sync/conflicts and scoped blob transport remain planned.
3. Neon connector metadata was read, but application runtime connectivity/migrations/round trip to an isolated Neon branch is unproved. Production was not mutated.
4. Cold offline launch, licensed regional basemaps, native-like interaction changes and sensor lifecycle need implementation and acceptance checks.
5. DB module captures process configuration at import; injected server Env consistency is assigned to local-sync Task 3.
6. Full project CRUD and import/sync API remain planned. Storage intentionally returns 503 until authorization exists.
7. Admin build emits approximately 1.77 MB JS (about 499 kB gzip) and a large-chunk warning. Turbo warns that the UI typecheck-only build has no emitted files. Passing build does not prove device performance.
8. Physical Android/iOS GPS/orientation/installation checks and production readiness remain unproved.

**Next gate:** review the [concrete implementation plan](../superpowers/plans/2026-09-30-geonexo-localfirst-geopdf.md). The user's parallel-subagent choice persists. Invoked writing-plans requires that review before new architecture implementation. Baseline checks do not complete the overall goal.
