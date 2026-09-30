# GeoNexo local-first + GeoPDF — task brief

**ID:** GEO-LOCALFIRST-2026-09-29  
**Status:** execution active; written-plan/specification reviews, P1-GEO-API, and C1 PASS; L6 independent final review PASS (browser smoke included); W0 code/source gate PASS-limited; W1 code gate PASS with cold-offline/product integration pending; D2 is in a second repair for workspace scope/nullability and awaits independent review; W2 exact PMTiles 4.5.0 pin, frozen install, and BSD-3 notice PASS, implementation is active; P1-WORKER remains gated by attribution of the broad dirty lockfile; G0.2/G0.3/G0.5 feasibility PASS; G0.4 remote runtime BLOCKED/PENDING; overall G0.6 product acceptance FAIL/PENDING  
**Current checkout:** `main` at `D:/MATEUS/Documentos/GitHub/GeoNexo`, explicitly consolidated by user request on 2026-09-30  
**Base:** `main` / `a80586a5f2e8aca8c21ff88a661e21e7f61c941e`  
**Scope owners:** frontend (`apps/admin`, `packages/ui`, `packages/maps`, `packages/geo`), backend (`services/api`, `packages/db`, `packages/contracts`), quality (`e2e`, CI), security (cross-cutting).

## Objective

Turn GeoNexo into a mobile-first, installable, local-first mapping PWA with no login screen. Users can work with locally saved data without connectivity; when connectivity returns, the app synchronizes through the API to Neon/PostGIS. A user can import a georeferenced PDF (GeoPDF), have its location resolved from embedded georeferencing and view it as a map layer. An ordinary PDF must be positioned through explicit control points; the app must never guess a geographic location. GPS and device orientation are requested only after user action.

## Scope

- Keep the existing Vite/React, Hono, Drizzle, Neon/PostGIS and MapLibre architecture where it is sound.
- Replace mock-only product flows with local persistence, durable sync, real API routes and testable Neon/PostGIS integration.
- Implement safe PWA shell/offline behavior, explicit offline basemap packages where licensing permits, and native-like responsive interaction.
- Add GeoPDF import/viewing and manual georeferencing for ordinary PDFs.
- Repair existing typecheck, lint, API/client contract and Playwright gates that prevent reliable delivery; remediate relevant confirmed security issues.
- Run the existing and new tests, browser E2E, independent security/technical review, and a verified local browser preview after implementation.

## Out of scope

- Login, sign-up, or password screens; production deployment; remote writes or release publication.
- Claiming strong per-person identity or private multi-user collaboration without an identity/access-control design.
- Treating a normal PDF as georeferenced or silently assigning it a location.
- Blindly importing third-party source code or caching a map provider's tiles without reviewing maintenance, license, attribution, and offline-use terms.

## Proposed product/security boundary

No visible login flow. Each installation receives a random local installation identifier and an automatically provisioned, revocable workspace capability stored only in IndexedDB. The API scopes sync to that workspace and is the only component that holds Neon credentials. This is an anonymous device/workspace identity, not proof of a person's identity. Cross-device sharing, if needed, must use an explicit share capability; it cannot be represented as per-user privacy. Do not expose Neon URLs, passwords, object-store credentials, or unrestricted public write routes to the browser.

## Acceptance criteria

1. There is no login screen, login route, login redirect, or credential prompt.
2. A user can create/edit/delete map data offline, reload the installed PWA offline, and retain the data and queued operations.
3. Reconnection synchronizes through the API to a designated isolated Neon/PostGIS test database. Duplicate operations are idempotent, remote changes are pulled by cursor, deletes propagate as tombstones, and version conflicts preserve both sides for resolution.
4. No Neon/database secret is sent to or bundled into the browser.
5. Importing a supported GeoPDF while offline extracts its embedded georeferencing locally, stores the original locally, and renders a correctly positioned overlay without network access. Unsupported CRS/georeferencing is reported, not guessed.
6. An ordinary PDF requires explicit control points and CRS, shows residual/error information, and is never auto-positioned.
7. The overlay supports page selection and retains a reference to the original PDF. If reprojection or page/inset metadata cannot be handled within a declared accuracy bound, import fails with a useful explanation.
8. Map data, imported PDFs, app shell, and any approved offline basemap package remain available offline. API responses and arbitrary third-party GETs are not globally cached.
9. GPS and orientation permissions are requested only from a user gesture; watchers/listeners stop when no longer needed. Unsupported/denied permissions leave the rest of the map usable.
10. App uses standalone PWA presentation, stable launch behavior, safe-area layout, responsive navigation, and quiet sync behavior. It need not announce routine online/offline transitions; failed/pending sync remains recoverable and visible enough to prevent data loss.
11. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and actual Playwright E2E pass; PostGIS integration tests run against an explicitly configured disposable test target.
12. Independent QA and security review provide fresh evidence; no migration runs against an unverified or production database.

## Risks / stop conditions

- **Offline GeoPDF parser feasibility:** current research found GDAL's PDF driver supports extraction/rasterization but the published `gdal3.js` build lists PDF as write-only. Before selecting a parser, prove offline client-side reading against representative, legally usable GeoPDF fixtures. Stop the PDF implementation if its positioning/accuracy cannot be verified; do not silently downgrade to server-only processing.
- **Identity without login:** the installation capability does not provide person-level authorization. Stop if required product behavior includes private data or shared multi-user access that cannot be safely represented without an approved capability-sharing design.
- **Offline basemaps:** stop before caching provider tiles if terms do not permit offline storage. Select licensed regional packages/self-hosted data or document reduced basemap availability.
- **Neon test target:** stop before migrations or integration writes if an isolated, disposable target cannot be positively identified. Never use production credentials by inference.
- **PDF resource limits:** set and test byte/page/render limits before accepting untrusted documents; reject unsupported/password-protected/corrupt PDFs without losing the original.
- Stop on any destructive migration, unreviewed dependency/license change, georeferencing error beyond the agreed bound, or missing independent verification.

## Baseline evidence (2026-09-29)

- Original `main` at `a80586a5f2e8aca8c21ff88a661e21e7f61c941e` was clean. Work proceeds in the isolated worktree listed above; main remains untouched.
- `pnpm test`: exit 0; 176 tests passed, 10 PostGIS integration tests skipped because no test DB URL was present.
- `pnpm build`: exit 0; admin JS bundle ~1.77 MB raw / ~497 KB gzip, with a large-chunk warning.
- `pnpm typecheck`: fails in `services/api/src/lib/db.ts` (geometry type mismatch and nonexistent exported `Geometry`).
- `pnpm lint`: fails resolving `eslint-plugin-react-hooks` from shared ESLint config.
- `pnpm test:e2e`: fails because Turbo has no `test:e2e` task; Playwright config is incomplete and `@playwright/test` is not the installed package.
- `pnpm audit --audit-level=moderate`: reports 10 vulnerabilities (1 low, 6 moderate, 2 high, 1 critical); exact advisories must be reviewed before dependency changes.
- Frontend import is simulated; no PDF support or durable local-first data sync exists. Service worker caches broad GET traffic, and the frontend/API paths do not align (`/api/v1` client vs root-mounted API routes).
- API project list is stubbed; import/sync endpoints are absent. Security review found unsafe geospatial popup HTML and health error detail exposure.
- PostGIS compose service was healthy locally, but current process did not have `DATABASE_URL` or `TEST_DATABASE_URL`; no Neon connection or write has been proven.

## Live follow-up evidence and repair assignments

- Neon MCP read-only metadata located project `cold-bonus-98807676` (`GEONEXO`) and one branch, `production` (`br-delicate-base-b4a2d3rl`). Database `neondb` has no application tables; PostGIS and pgcrypto are available but not installed. This proves connector access, not application runtime connectivity. No remote schema/data writes were executed.
- A further database defect was identified: `packages/db/src/client.ts` passes the HTTP `neon()` query function to `drizzle-orm/neon-serverless`, whose adapter expects a pool/client. Existing type casts hide the mismatch and skipped integration tests did not exercise it.
- `GEO-FIX-BASELINE-08`: configuration Builder owns manifests, lockfile, lint configuration and E2E wiring; dependency advisory remediation is verified by fresh package audit and compatibility tests.
- `GEO-FIX-API-09`: backend Builder owns database client/type correctness and sanitized health behavior plus regression/integration checks.
- `GEO-FIX-MAP-10`: frontend Builder owns safe text-based map popups and malicious-input regression checks.
- `GEO-RESEARCH-OFFLINE-11`: read-only primary-source research found `pdf-lib` dictionary APIs + PDF.js local rendering + existing proj4 as a feasible candidate for supported ISO/OGC profiles. This is an architectural inference, not an executed offline fixture proof; the GeoPDF gate remains unpassed.
- Local PostGIS integration will use a separate container/database named `geonexo_localfirst_test`; the original local service and Neon production database are not test targets.

## Verification plan

- Unit/contract: IndexedDB schema migrations, queue atomicity, idempotency, cursor/tombstone/conflict semantics, geometry transforms, GeoPDF fixtures, size/page/CRS failures.
- DB/API integration: isolated PostGIS tests for migrations, push/pull, duplicate operations, conflict handling, import metadata, and project/layer/feature CRUD.
- Browser E2E: no login; offline create/edit/delete/reload; reconnect and verify actual test DB persistence; duplicate replay; GeoPDF auto-location while network is disabled; ordinary PDF control points; install shell; permission accept/deny behavior.
- PWA diagnostics: installability, offline first load and deep link, update path, bounded storage/cache behavior, mobile viewport/safe area.
- Independent review: inspect auth/capability boundary, upload parser limits, XSS fix, SSRF/external fetches, service-worker cache rules, API input limits, secrets, and migration safety.
- Final local preview only after gates pass; use the verified loopback URL and report readiness.

## Specification gate

The companion specification is `docs/superpowers/specs/2026-09-29-geonexo-localfirst-geopdf.md`. The user's instruction to execute the PRD authorizes continued implementation and parallel agents. The master implementation plan is `docs/superpowers/plans/2026-09-30-geonexo-localfirst-geopdf.md`; an independent written-plan review passed after repairs on 2026-09-30. G0.2–G0.6 evidence still gates dependent product work. Existing defect repairs remain authorized.

## Follow-up status (2026-09-30)

- All work remains in the isolated branch/worktree; no commit, push, deployment, production migration or unrelated local service change.
- Dependency audit after upgrades: zero advisories; actual versions and commands will be captured in the quality evidence. This does not establish runtime feature completion.
- Disposable PostGIS: owned container `geonexo-localfirst-test-20260929`, loopback `127.0.0.1:52435`, DB `geonexo_localfirst_test`. Original local DB and Neon production remain untouched.
- Backend22 reports 15 unit and 13 real PostGIS integration tests passed. API24 reports 42 tests passed. Independent26 rechecked final source and focused checks, identifying additional residuals.
- API28 corrected a per-property size check that had rejected valid aggregate objects. Its focused contracts suite passed 106 tests. Root's subsequent lint found two formatting errors; the API owner is repairing these in30.
- API30 owns the project-list stub/response mismatch, shared creation validation, consistent health prefix, not-found regressions and fail-closed storage presigning until workspace authorization exists.
- Quality25 confirmed all seven lint tasks passed before28. Quality27 reports real Playwright smoke in Chromium/Firefox/WebKit, three checks passed; coverage is only launch/title/logo, not synchronization, sensors or offline installation.
- SW v2 bypasses API, mutable/cross-origin requests and foreign caches, handles declared UI navigation safely. Complete hashed-asset precaching and cold offline launch remain pending.
- Popup rendering uses text DOM nodes with malicious-input regression coverage. DB ownership/cleanup, API validation/body limits, domain errors and deadline handling have focused regression coverage.
- Root will rerun combined lint/typecheck/unit/build and exclusive disposable-DB tests after writers finish. Earlier passes are not final combined evidence.
- New GeoPDF parsing, real local-first product paths, Neon application round trip, scoped uploads, offline regional basemaps and sensors remain unimplemented. The written plans must not be represented as implementation.

## Final baseline verification and plan handoff (2026-09-30)

- API33 and DB34/34R repaired project wire serialization/pagination and timestamp precision across project/layer/feature cursors. Storage presigning stays unavailable until scoped authorization.
- Root final combined checks after source writers finished: lint 7/7, typecheck 7/7, test 12/12 with 253 unit tests, build 7/7; all exit 0. Exclusive PostGIS integration passed 15/15; three-engine browser smoke passed 3/3. Dependency audit has zero advisories.
- Root ran built API against disposable PostGIS and verified health, create/list/page two, invalid cursor and disabled presigning. Temporary API closed after success.
- Root production Chromium proved active service-worker control and exposed first-offline-reload failure; warm cached bundles enable offline deep links. Cold launch remains a required PWA gate.
- Independent final technical review36 passed with retained module-time Env mismatch and planned-feature limitations. Independent plan review31FINAL passed all four documents after repairs.
- [Detailed baseline evidence](../../quality/2026-09-30-baseline-evidence.md) records commands, counts, limitations and actual loopback preview. Automatic browser-opening attempt was rejected by tool policy; local HTTP readiness passed.
- At the start of the continued execution, the user directly authorized the PRD work and parallel agents. The first independent plan review found missing PRD gates; the master and child plans were repaired, and the independent second review passed the planning findings. This review does not pass any runtime feasibility gate.

## Continued execution status (2026-09-30)

- **Task state:** active. Written-plan review is PASS. G0.2 contract/design freeze is **PASS** in [GEO-ADR-G0.2-2026-09-30](../decisions/2026-09-30-g0.2-anonymous-workspace-and-sync.md); runtime capability, sync, and workspace isolation remain unimplemented. G0.3 GeoPDF feasibility is **PASS (feasibility only)** after independent plan, implementation and security reviews; product parsing/rendering remains PENDING. G0.5 source feasibility is **PASS** after independent report review; package installation/protocol/lifecycle remain unimplemented. G0.4 metadata inventory is documented and local disposable PostGIS integration passes; the Neon production schema remains absent and remote migration/write requires separate approval. G0.6 has a Vite-specific `pwa-executor` review at `../quality/pwa-executor-review.md`; it records PWA acceptance as FAIL/PENDING.
- **Independent current audits:** PWA and GeoPDF audits found the PRD product paths absent or partial; neither changed files. Details are in the PWA review and agent evidence from this run. Do not treat current GeoJSON/GLB persistence as offline PDF or map-data sync.
- **Application launch:** `pnpm --filter admin dev -- --host 127.0.0.1 --port 5173 --strictPort` served `https://127.0.0.1:5173/`, HTTP 200. This is local development launch evidence only; Vite used development SSL and this does not prove installed/cold-offline behavior.
- **Current baseline commands:** `pnpm lint` exited 0 (7/7 tasks, warnings only); `pnpm typecheck` exited 0 (7/7 tasks); `pnpm test` exited 0 with 282 passing tests and 16 PostGIS tests skipped because `TEST_DATABASE_URL` is unset. Turbo replayed cached logs for multiple packages, so these results are baseline signals, not final fresh quality evidence. The focused PWA reviewer separately ran service-worker and offline-db suites fresh: 2 files / 7 tests passed, but these do not cover PWA install or product sync.
- **G0.2 fresh local evidence (2026-09-30):** added canonical map sync entity; strict bounded layer projection; 32-byte unpadded base64url capability/bootstrap secret syntax; opaque `v1.<payload>.<HMAC-SHA256>` cursor shape; scope rejection without server payload; POSIX-safe offline paths, role media types and 250 MiB aggregate map package budget; 10,000-position geometry cap. Root re-ran `pnpm exec vitest run tests/sync.test.ts tests/contracts.test.ts tests/import.test.ts`: 3 files / 78 tests passed. `pnpm --filter @geonexo/contracts typecheck` passed; `git diff --check` passed with one LF/CRLF conversion warning. These checks prove schemas/types only, not CSPRNG entropy or runtime authentication/HMAC enforcement.
- **G0.3 earlier update (superseded):** USGS TNM Access matched the lawful Frederick 1893 sample by exact source ID and returned independent bounds `[-77.5, 39.0, -77.0, 39.5]`. The adapter still rejects `/LGIDict` because `/CTM`, `/Display`, and `/LGIT:Info` registration semantics are not implemented.
- **G0.4 fresh local evidence:** Docker Desktop was started; only the previously identified `geonexo-localfirst-test-20260929` container was started. Read-only identity checks confirmed `geonexo_localfirst_test`, role `geonexo_test`, and PostGIS on loopback `127.0.0.1:58489`. Root ran `pnpm --filter @geonexo/db exec vitest run tests/integration/postgis.test.ts --maxWorkers=1`: exit 0, 1 file / 16 tests passed. `TEST_DATABASE_URL` was constructed only in the process for this command and removed afterward. The two other PostgreSQL services were not used. Neon remote schema remains absent; no remote write occurred.
- **G0.5 W0 chronology:** the first local writer attempt was superseded by the bounded official remote-range extract, local style/assets validation and DPR 1/2 render. Independent review accepted G0.5 for source feasibility only; all archive/style/screenshot artifacts remain in OS temp, and product package installation/protocol remain absent.
- **Safety:** current branch remains `main` with pre-existing user changes. Docker Desktop and the identified disposable test container are currently running for local QA. No commit, remote Neon branch/database creation, remote migration, remote row write, deployment, or production change was performed.
- **Next actions:** complete the bounded repair loops for D2 (exact-target guard, scope/sequence/tombstone/concurrency coverage), L6 (real IndexedDB index/transaction/acknowledgement behavior), W0 (local-only style protocol checks and honest structural/archive evidence), and W1 (hashed worker manifest/test lifecycle/fail-closed update readiness). Each repair requires a fresh independent review. P1-GEO-API and C1 are independently PASS; P1-WORKER waits on resolution/acceptance of the already dirty broad lockfile. Keep the EPSG:32620 cap at 100 m × 100 m until multiscale fixtures and review pass. Preserve the lockfile state and report that its pre-task delta is unavailable. G0.4 remote authorization, G0.6 product acceptance and device checks remain separate gates. Final combined quality verification and §52 handoff must force fresh execution and accurately report skipped remote/device checks.

### P1 specification gate update (2026-09-30)

- Independent review `P1-SPEC-REVIEW` is **PASS** after three repair rounds; evidence and bounded authorization are recorded in [the P1 specification](../specs/2026-09-30-geopdf-p1-implementation.md).
- Independent review `GEO-SPEC-REMAINDER-REVIEW-03` is **PASS** after repairing G0.3 status, ownership paths and the local FlatGeobuf license record. It authorizes only listed local tasks after their dependencies; C1 is the current downstream gate. Evidence is in [the remaining-work specification](../specs/2026-09-30-localfirst-pwa-remaining-implementation.md).
- Parallel local implementation begins under disjoint ownership: `P1-GEO-API` owns `packages/geo/src/pdf/**` and focused geo tests; `P1-PDF-RUNTIME` owns only the package manifests, lockfile, Vite worker configuration if needed, and third-party notices. Neither scope includes remote database writes, deployment, or changes to the user's source PDF.
- This advances a subgate only. Product GeoPDF rendering/overlay, PWA, durable local-first sync, Neon round trip, device QA, and overall PRD acceptance remain open.

### G0.3 candidate evidence update (2026-09-30)

- Added official GDAL autotest fixtures as external temporary test inputs only; no upstream PDF or PDF.js package was added to the checkout. `pdf-lib@1.17.1` is pinned as an experimental `devDependency`.
- An earlier disposable probe treated the Adobe ISO PDF's degree-like `/GPTS` values as WGS84 even though `/GCS` declares projected UTM 20N; its sub-metre comparison against GDAL is excluded from P0 accuracy evidence. A separate generated UTM fixture now passes all four declared controls against pyproj/PROJ independently. The OGC fixture's CTM maps its neatline to the expected 2–3° longitude and 48–49° latitude rectangle.
- A disposable `pdfjs-dist@6.3.289` Chromium worker probe rendered ISO, OGC and Adobe PDFs under loopback-only routing with zero external requests. It exercised an Adobe render at 15,970,098 pixels, loading and render cancellation, worker teardown, a corrupt file, an encrypted file, and a PDF carrying JavaScript/URI actions; see [full evidence and limitations](../../maps/geopdf-feasibility.md).
- **Gate remains FAIL/PENDING (this paragraph superseded below).** The temporary proof resolved a two-page PDF with inherited CropBox/90-degree rotation and indirect viewport references. It detected an equal-area viewport ambiguity and a named `Map B`; the later persistent adapter added explicit caller selection and fixture tests. Product worker integration, end-to-end rotated overlay and adversarial memory limits remain unproved; input/page/pixel/deadline enforcement remains P1 hardening.

### GEO-G0.3-PDF-FEASIBILITY-02 — persist the candidate feasibility proof

- **Role / owner:** GeoPDF experimental candidate Builder; a separate independent quality and security reviewer must verify the result. Root is tooling owner for this bounded spike.
- **Objective:** turn the temporary candidate experiments into repeatable, workspace-local P0 evidence so G0.3 can be decided against the written feasibility plan.
- **Scope:** `packages/geo/src/pdf/experimental/**`, `packages/geo/tests/pdf/**`, a narrowly scoped local browser worker harness under `apps/admin/e2e/**`, and only the exact package manifests/lock entries needed for pinned candidate test dependencies. Keep the parser and worker experimental, unexported, and outside product UI/API/database paths.
- **Acceptance:** persistent fixtures/tests cover indirect references; inherited CropBox and rotation; multiple pages; WGS84 and a verified projected CRS with declared axis order; one named inset and explicit rejection of ambiguous insets unless the caller actually selects a name; ISO VP/Measure and a bounded OGC LGIDict subset; offline PDF.js browser-worker render, cancellation/teardown, corrupt/password input and no automatic external fetch or PDF-JavaScript execution. Record accuracy against GDAL's independent control transform with maximum error at or below 1 m. Unsupported variants, including unhandled USGS `/Display` and `/LGIT:Info`, must fail closed and remain clearly listed.
- **References:** `docs/superpowers/plans/2026-09-30-geopdf-map.md` P0/P1; `docs/maps/geopdf-feasibility.md`; ISO 32000-1, OGC 08-139r3, GDAL upstream tests; current generated fixtures and experimental `pdf-lib` adapter.
- **Dependencies:** written plan review PASS, G0.2 contracts PASS, pinned candidate license review, no product Builder work until fresh independent P0 review.
- **Risk:** PDF parsing is untrusted-input handling; fixture accuracy only proves declared controls and metadata precision. A real project PDF has since been supplied and its CRS/GPTS mismatch is now recorded as a fail-closed case.
- **Permissions:** local reversible code/docs/dependency test-only changes are authorized; no commit, remote write, deploy, destructive action, or production import integration. Tooling owner alone changes relevant manifests/lockfile.
- **Required verification:** separate fresh geo focused tests/typecheck/lint and the browser probe with all non-loopback requests blocked; independent review must map every P0 checkbox to actual evidence and call PASS/FAIL/PENDING.
- **Expected evidence:** changed-file list, pinned versions/licenses, commands and exit codes, accuracy table, network/worker/cancellation output, security limitations, and independent review result.
- **Stop conditions:** do not implement product exports/UI/API/DB or bypass the gate; stop and retain `FAIL/PENDING` if unsupported profile semantics, licensed fixtures, coordinate accuracy, or local browser-worker safety cannot be proved.

### GEO-G0.3-ARAGUAINA-REUSE-04 — supplied PDF diagnosis and model-reuse survey (2026-09-30)

- **Role:** root task owner with independent metadata/security and plan reviewers; source-reuse researcher is read-only.
- **Objective:** test the user-supplied Araguaína GeoPDF locally and identify the maximum useful, license-compatible reuse from `REPOSITORIOS MODELOS` without violating GeoNexo's architecture or G0.3 gate.
- **Scope:** metadata-only PDF inspection, local PDF.js worker render, candidate parser rejection, current GeoPDF plan/contracts, and bounded model-repository source/license inspection. The original PDF is not copied, edited, staged or committed. No model code is copied during this P0 task.
- **Acceptance:** record sample SHA-256/size, page/profile/CRS/axis metadata, bounds/residual status, local open/render result, external-request and worker teardown evidence; explain unsupported metadata without inference; classify each reusable model unit with license/provenance; retain `FAIL/PENDING` until independent G0.3 review.
- **Real sample:** `geopdf de araguaina.pdf`, `16,634,115` bytes, SHA-256 `B83914BE45385B71ED9667D4381991952B60DCC8C3504294E969CDA3723CA1E1`. It is one page with one `/VP` `Layer`, `/Measure /GEO`, `/GCS /PROJCS /EPSG 3857` and Web Mercator WKT. Its raw `/GPTS` pairs have values near `[-7.2, -48.2]`; ISO projected coordinates must be easting/northing, so these values cannot be reinterpreted as latitude/longitude. The experimental adapter returned `Unsupported CRS`; geographic bounds and residual are unavailable until the source metadata is corrected or explicit manual controls are supplied.
- **Render evidence:** PDF.js `6.3.289` loaded through a local Chromium worker and rendered `1684 x 1191` (`2,005,644` pixels). The latest local run recorded document open `103.3 ms`, render `191.4 ms`, zero external requests/page errors, 10 workers started and zero live at teardown. Main-frame heap delta was not usable; only a raw-input-plus-RGBA-canvas estimate is recorded in `docs/maps/geopdf-feasibility.md`.
- **Accuracy evidence:** a generated projected UTM20N fixture with GPTS in metres now compares against pinned `pyproj 3.8.0` / `PROJ 9.8.1` control coordinates; maximum observed error is `0.00153 m`. Metadata resolution (`0.001 m`) and expected 200-DPI image half-pixel displacement (`0.20125 m`) are recorded separately. The prior Adobe-fixture `0.496 m` comparison is excluded because it treated degree-like GPTS values as degrees despite `/GCS /PROJCS` UTM metadata.
- **Harness limits:** generated probes confirmed rejection of a 26 MiB input, a 25 MP page before canvas creation, and a 101-page document. The page-count rejection occurs after PDF.js document parsing; this remains disposable-harness evidence, not product resource isolation.
- **Reuse result:** TacMap is `PORT`/`ADAPT` for bounded parser/calibration algorithms under a verified local MIT license, but its extracted tree has no Git origin/commit metadata; any future port must preserve attribution and add independent tests. PDF.js (Apache-2.0), pdf-lib (MIT) and existing proj4 are dependency reuse; do not vendor their source. `kerilla-map` remains `REFERENCE_ONLY` because no code license was found and its regex parser lacks required safety/CRS checks. No model source was copied in this task.
- **Changed evidence/tooling:** `apps/admin/e2e/geopdf-worker-harness.cjs` accepts an optional local PDF path and reports open/render timing and available renderer heap delta without copying the source file. Fixtures README and `docs/maps/geopdf-feasibility.md` now record the sample and reuse matrix.
- **Review complete:** independent plan, implementation and security reviews accepted the corrected accuracy report, model-reuse record and current P0 evidence. Product worker, hard byte/page/pixel/deadline/memory limits, manual calibration and overlay integration remain unimplemented and gated by the remaining PRD feasibility/specification gates.
- **Independent review results:** plan review PASS for all bounded G0.3 feasibility criteria; implementation review PASS for the generated UTM fixture and sub-metre control claim; security review PASS for harness-only limits and correct P0/P1 separation. The measured maximum is persisted as a `<0.002 m` regression assertion. Product/release readiness remains out of scope for this gate.
- **Stop condition:** never auto-position this Araguaína file while its declared EPSG:3857 conflicts with the raw GPTS values; do not substitute TacMap's parser or infer EPSG:4326 from the city/name/value magnitudes.

## MapLibre Vite worker repair (2026-09-30)

- **Task ID / role:** `GEO-FIX-MAP-11`, frontend specialist; implement the MapLibre v6 worker URL integration in `packages/maps/src/maplibre.ts` only (add a Vite type declaration only if required by typecheck).
- **Objective / scope:** make the worker a production-bundled Vite worker so existing local feature sources reach `style.load` and E2E map readiness when external basemap requests are blocked. Preserve existing GPS control inputs; do not alter E2E-owned tests, dependency versions, or remote/network policy.
- **Acceptance:** use the documented MapLibre 6 + Vite `?worker&url` integration and call `setWorkerUrl` before map creation; preserve the pre-existing `showUserHeading` value as a typed legacy option if MapLibre 6 public types omit it (do not claim it renders a heading); `pnpm --filter @geonexo/maps typecheck` and `pnpm build` pass; fresh targeted Chromium E2E proves both existing map flows become ready with external requests blocked and no worker load error.
- **Evidence / risk:** current built app preview returned HTTP 200 but map stayed `data-map-ready=false`; blocked `https://tiles.openfreemap.org/styles/liberty` and browser console reported `Worker failed to load. Check that the worker URL is correct.` The built assets contained no emitted MapLibre worker. Official MapLibre v6 docs require importing `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url` under Vite and calling `setWorkerUrl` (see <https://maplibre.org/maplibre-gl-js/docs/> ESM/Vite guidance). This failure explains the map readiness hang; the missing external basemap independently requires offline fallback/package behavior and is not solved by worker bundling.
- **Permissions / dependencies:** local source edit and local build/typecheck only; no package install, remote write, commit, deploy, or file cleanup. Stop if Vite/TypeScript requires unrelated dependency changes or if the proposed import cannot be kept within the owned module.
- **Independent review repair:** final read-only review found that an earlier GPS typing cleanup also removed pre-existing `showUserHeading: true`. Official MapLibre v6 `GeolocateControlOptions` does not document that field. Restore the exact legacy option with an explicit typed compatibility extension and a comment that the public v6 API/runtime does not prove a heading indicator; rerun typecheck/build and request review again.

## Final PRD execution and quality snapshot (2026-09-30)

- **Gates:** G0.2 contract/design PASS after final independent `@2x` asset-path review; G0.3 GeoPDF PASS for feasibility only; G0.4 local PostGIS PASS and Neon production schema/runtime BLOCKED/PENDING; G0.5 source feasibility PASS after independent report review (the product package installer/protocol remains absent); G0.6 PWA review complete, product acceptance FAIL/PENDING.
- **Worker repair:** `GEO-FIX-MAP-11` configured MapLibre v6's Vite worker URL. Fresh production Chromium reproduced and then cleared worker-load failure: the 2 focused map flows passed; full Playwright suite passed 37 with 2 intentional non-Chromium GLB skips across Chromium/Firefox/WebKit. After restoring the legacy typed `showUserHeading` option, a fresh focused rerun passed 6/6 across all three browsers. Independent code review: PASS; heading rendering itself remains unproved. Existing 10 quality screenshots were restored and SHA-256 compared.
- **Root forced checks:** lint 7/7 (24 existing `any` warnings); typecheck 7/7; unit/test graph 12/12 with 296 passed and 16 DB integration cases skipped in that environment; build 7/7 and emits `maplibre-gl-worker-*.js` (510.62 kB). Bundle-size and Turbo UI-output warnings remain. `pnpm audit --audit-level=moderate` reported no known vulnerabilities.
- **Database:** fresh `pnpm --filter @geonexo/db exec vitest run tests/integration/postgis.test.ts --maxWorkers=1` passed 16/16 against only the disposable loopback `geonexo_localfirst_test` database; the suite applied the existing migration from zero and truncated/seeded only that target. No Neon mutation or migration occurred.
- **Offline map proof:** official PMTiles + local style/glyph/sprite manifest (including `@2x`) validated and rendered DPR 1/2 with external requests blocked; archive/style assets are still only in temp. Independent read-only review passed after clarifying chronology and scope in the report. See [source feasibility report](../../maps/offline-package-source.md).
- **W0/W1/L6 final code reviews (2026-09-30):** W0 is PASS-limited to source/temporary render evidence and the structural validator; it does not represent an installed product package. W1 repaired code passed its independent tests/build review, while real cold-offline deep-link acceptance and root integration remain pending. L6 passed independent review after monotonic acknowledgement/blob repairs and a Chromium reload/outbox smoke. D2 remains in repair and W2 package/protocol implementation is active under its standalone task brief.
- **W2 dependency gate (2026-09-30):** `pmtiles@4.5.0` was added exactly to `packages/maps`; `pnpm install --frozen-lockfile --ignore-scripts --filter @geonexo/maps` passed without lockfile regeneration. Registry integrity and BSD-3 license provenance are recorded in `pnpm-lock.yaml` and `THIRD_PARTY_NOTICES.md`. This narrow frozen dependency proof does not resolve attribution of the pre-existing broad dirty lockfile delta for P1 PDF.js.
- **Outcome:** PRD remains **NÃO PRONTO**. Anonymous workspace/authenticated sync/outbox/domain stores, Neon round trip, package install/selection, cold offline PWA/update lifecycle, physical-device acceptance, production GeoPDF/LGIDict/manual calibration, third-party product notices and mobile performance gates are not completed. Exact section §52 handoff is [prd-execution-handoff.md](../../quality/prd-execution-handoff.md). No commit, push, remote database write/migration, deploy or production change occurred.

### P1-PDF-RUNTIME dependency update (2026-09-30)

- Exact runtime dependencies are now present: `pdf-lib@1.17.1` and `proj4@2.22.0` in `packages/geo`; `pdfjs-dist@6.3.289` in `apps/admin`. `THIRD_PARTY_NOTICES.md` records MIT/Apache-2.0 notices and TacMap MIT attribution. No Vite worker configuration was needed yet; it belongs to the later worker task.
- `pnpm install --lockfile-only --ignore-scripts` and `pnpm install --frozen-lockfile --ignore-scripts` both exited 0; installed package metadata reports the exact versions/licenses. Lockfile integrity values are in the P1 spec.
- **Review pending:** `pnpm-lock.yaml` was already modified before this dependency task. Frozen resolution succeeded after regeneration, but the current diff versus `HEAD` is broad (3,310 lines changed) and also reflects existing dirty workspace manifests such as Vite/Vitest, Playwright, Three.js and workspace peer-resolution changes. We preserved the regenerated file; an independent review must assess the full dirty manifest/lockfile snapshot before this runtime subgate is closed. No previous dirty lockfile snapshot was available for a precise per-turn delta.
