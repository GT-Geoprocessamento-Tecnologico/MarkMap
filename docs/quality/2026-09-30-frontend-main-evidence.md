# Frontend audit and main consolidation evidence

Status: independent technical review passed; final root verification in progress. Physical old-folder cleanup remains blocked by automatic policy review.

## Canonical source and consolidation

- Principal source: `D:/MATEUS/Documentos/GitHub/GeoNexo`, local `main`, HEAD `a80586a5f2e8aca8c21ff88a661e21e7f61c941e`.
- Transferred 113 tracked modifications + 17 untracked files from the former equal-HEAD worktree. All 130 source/target SHA256 hashes and full binary Git diffs matched before further frontend edits. Session TEMP manifest: `geonexo-consolidation-manifest-20260930.json`.
- Git removal completed: one registered worktree, one local branch `main`. No commit, push or deploy.
- Physical old directory cleanup remains pending: automatic policy review rejected guarded PowerShell recursive removal. Only generated remnants were found outside transferred source; private principal configuration was not read or moved.

## Findings and repairs under verification

| Area | Audited failure | Repair |
| --- | --- | --- |
| Mesh collection | Hidden project-only route, false demo terrain and save | Global/project collection, local GLB validation and atomic persistence of original bytes |
| Mesh rendering | No actual model loader, unwired camera/opacity/wireframe | Plain Three.js loader, aspect/FOV fit, contrasting wireframe overlay, restored view, cleanup/resize |
| Imports | Fake records/counts, simulated upload | Actual bounded GeoJSON/GLB import, original persistence, preview/export/delete |
| Dashboard | Fake metrics/images and no-op actions | Shared real project list, search/sort, actual navigation and responsive cards |
| Analytics | Random access counts, fabricated trends and mismatched labels | Actual consulted project/layer/type counts and escaped CSV of those layers |
| Settings | Persisted API/CRS/format/limit fields disconnected from behavior | Actual theme, installation event, GPS gesture and persistent storage actions |
| CRS | Unpersisted entries/favorites, duplicate success, silent quota failure | Validated catalog data, persistence, truthful duplicate/quota errors |
| Layout | Min-content overflow, clipped short-screen menu/forms | Dynamic viewport, min-width containment, scrollable navigation/dialogs, safe areas and touch focus |
| Storage | Save resolved on request success before transaction commit | Resolve only on transaction completion and reject abort/error |
| Project map | Names-only layer list, invalid API-to-GeoJSON conversion and inactive visibility | Actual paginated features, typed GeoJSON, effective filters/default visibility, safe bounds and style fallback/source restoration |
| Lists | Hidden pagination limit and potential repeated cursor cycle | Load-more for projects; deterministic cycle termination and explicit bounded Analytics/map summaries |
| Offline icons | Google-hosted font caused ligature text/overlap with network blocked | Self-hosted Material Symbols subset with source/license notice and bounded icon layout |

## Verification log

- Independent technical review GEO-FRONT-FINAL-47 FINAL: PASS WITH RESIDUALS, including map-data, CommandCenter and MeshCanvas. Earlier REQUEST CHANGES findings were repaired and rereviewed.
- Earlier complete root checks: 14/14 lint/type tasks; 12/12 unit/dependency-build tasks; 7/7 builds, all uncached. Final rerun after the last pagination/mesh fixes is recorded below when complete.
- Real isolated PostGIS on principal main: 15/15 passed, exit 0. Log `geonexo-main-final-postgis-20260930.log`; container `geonexo-localfirst-test-20260929`, loopback port 52435, database `geonexo_localfirst_test`. The user's original database/container was not changed.
- Dependency audit: exit 0, zero vulnerabilities in all severities. Log `geonexo-main-final-audit-20260930.json`.
- Cursor regression: original implementation FAILED the cycle assertion; final deterministic implementation PASSED 2/2, including normal completed-page refetch. Command `pnpm --filter admin exec vitest run src/test/project-pagination.test.tsx --maxWorkers=1`.
- Browser repairs found real failures: stale opacity writes, theme initialization race, mobile menu interception, unsupported WebKit File/Blob IndexedDB preparation, icon font layout dependency, startup/style/data readiness and missing accessible labels. New storage uses ArrayBuffer and reconstructs original Blobs, retaining read compatibility with older stored Blob records.
- Browser failure history remains in session TEMP logs. One fixture incorrectly used `description:null` against the canonical project contract; corrected to a string. Windows text-encoding corruption was detected by heading assertions and repaired. No failing assertion was silently suppressed.
- Final browser rerun is serial after compiler/build work, with bounded 15-second expectations and 10-second actions. Rendered GLB acceptance is explicitly Chromium only; Firefox/WebKit retain viewport, dataset, project-map, settings and transaction coverage.
- The first final browser run passed 18 cases, skipped the two explicitly unsupported GLB engine cases, and failed WebKit's combined viewport sequence. A trace of the focused sequence showed no JavaScript errors and reached the overall 180-second deadline during menu animation; repeated cold development navigation took approximately three seconds per route. Each of the seven sizes is now a separate bounded 90-second test with the same eight exact headings, overflow/menu checks and page-error assertion. GEO-FRONT-QA-48 independent read-only harness review passed; no runtime assertion was removed. Final 39-case rerun is recorded below when complete.
- Split full suite passed 37/39, with only the two documented GLB engine skips. Subsequent visual inspection found the loaded mesh center below the initial 320x568 viewport. The new Chromium regression FAILED with center y=587.5 against viewport height 568; after moving the mobile canvas before the collection and reserving a 360px row, it PASSED. Desktop ordering/columns remain intact. Root inspected the actual visible triangle screenshot; GEO-FRONT-MOBILE-MESH-49R independent rereview passed. Logs: `geonexo-main-gates-browser-split-20260930.log`, `geonexo-mobile-mesh-red-20260930.log`, `geonexo-mobile-mesh-green-20260930.log`. Post-repair final rerun follows.
- A later dev-server rerun reproduced intermittent WebKit blank-navigation timeouts without page errors. The final harness now builds and serves the actual production bundle, with identical assertions. Production HTTPS diagnostic exposed a local certificate failure loading MapLibre's worker (`Worker failed to load`, actual source readiness false), despite page-level ignoreHTTPSErrors. The local preview is now HTTP bound to 127.0.0.1, with no certificate bypass in Playwright and unchanged dev HTTPS. This does not weaken a remote deployment: the preview is loopback-only, and [loopback origins are potentially trustworthy secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). GEO-FRONT-FINAL-51 independently approved production-bundle testing and true htmlFor/id associations for mandatory project/layer name fields; final HTTP runtime results follow.
- Live API preparation discovered documented project detail and nested layer/feature routes missing from the running API. GEO-FRONT-LIVE-52 is the bounded existing integration repair, specified in the frontend implementation plan. Actual local API/browser acceptance must pass before declaring those actions functional in live mode.

## Screenshot and external asset evidence

- Screenshots under `docs/quality/screenshots`: solid GLB, restored wireframe/view controls, loaded model at 320px, and seven viewport snapshots.
- Root inspected actual solid/wireframe geometry and the 320px navigation screenshot; these are rendered user-file fixture geometry, not a simulated map/mesh image.
- Google Material Symbols Outlined local subset: 46 glyphs, 5840 bytes, SHA256 `f927ff4b269dff9caa50ad355214d1de83ba8088dcb0475c6fe118479d4fd609`. Source/subset URL and Apache-2.0 license are retained in `apps/admin/public/fonts/NOTICE-material-symbols.md` and `LICENSE-material-symbols.txt`.
- Browser QA blocks external network requests; same-origin application assets and actual IndexedDB/WebGL remain active. Forced transaction abort is a controlled failure injection, not proof of physical-device quota exhaustion.

## Final root gates on principal main

| Check | Exact command | Fresh result |
| --- | --- | --- |
| Lint and types | `pnpm exec turbo run lint typecheck --force` | exit 0; 14/14 tasks, zero cached; zero errors, 24 existing any-type warnings outside admin |
| Unit/dependency builds | `pnpm exec turbo run test --force --concurrency=1` | exit 0; 12/12 tasks, zero cached; 279 tests passed; isolated PostGIS 15 separately passed |
| Production build | `pnpm exec turbo run build --force --concurrency=1` | exit 0; 7/7 tasks, zero cached; Vite bundle-size advisory remains |
| Dependency audit | `pnpm audit --json` | exit 0; zero info/low/moderate/high/critical vulnerabilities |
| Whitespace diff | `git -c core.safecrlf=false diff --check` | exit 0 |
| Git inventory | `git branch --format='%(refname:short)'`; `git worktree list --porcelain` | only main; one registered principal worktree; HEAD unchanged; nothing committed/pushed/deployed |

Session TEMP logs: `geonexo-main-gates-static-20260930.log`, `geonexo-main-gates-tests-20260930.log`, `geonexo-main-gates-build-20260930.log`. Browser results and persistent preview readiness are appended after the active run finishes.

## Practical limits

- Browser viewport emulation does not prove every physical device. GPS permissions, sensors, OS installation and WebGL device limits require physical-device evidence.
- GLB support is deliberately bounded: self-contained uncompressed geometry; unsupported textures/external/sparse/compressed resources fail explicitly.
- This repair does not complete the previously gated GeoPDF automatic/manual georeferencing, offline basemap packaging or Neon synchronization architecture.
- API mock mode is selected explicitly for browser acceptance; local persistence tests do not prove Neon connectivity.

## Primary API references

- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)
