# GeoNexo local-first, GeoPDF and native-like PWA

**Date:** 2026-09-29  
**Task:** GEO-LOCALFIRST-2026-09-29  
**Status:** advanced to implementation planning following the user's `continua` on 2026-09-30; written implementation plan still requires review  
**Repository base:** `a80586a5f2e8aca8c21ff88a661e21e7f61c941e` (`main`)  
**Current implementation checkout:** `D:/MATEUS/Documentos/GitHub/GeoNexo`, branch `main`, following the user's explicit consolidation instruction on 2026-09-30. Prior isolated-checkout references in historical evidence are historical only.

## 1. Product intent

Build GeoNexo as an installable, mobile-first mapping application that feels native during normal use. There is no login screen. The user can work with locally saved maps/data and PDFs without internet; when a network is available, the app quietly synchronizes changes through its API to Neon/PostGIS. A GeoPDF can be placed automatically from its embedded georeferencing and displayed as a layer over the map. A PDF without georeferencing must be manually calibrated.

The app must not claim exact placement unless it can identify a supported geospatial profile, CRS and page transform and verify the resulting coordinates. If that information is absent or unsupported, the app asks for control points or reports the unsupported case.

## 2. Existing system and observed gaps

The repository is a pnpm monorepo with a Vite/React admin PWA, MapLibre maps, Hono API and Drizzle/Postgres packages. At the original baseline, the worker cached all GET requests, live API/client prefixes disagreed, project reads were stubbed, and tooling gates failed. Subsequent baseline repairs changed the DB adapter to postgres-js, aligned existing CRUD prefixes, bounded the service-worker cache policy, repaired tooling and added regression checks. Offline persistence still covers mainly settings, import remains simulated, and GeoPDF/sync routes remain absent. The task brief and quality evidence distinguish repaired defects from pending features.

Current basemaps are OpenFreeMap styles. Keep MapLibre as the renderer; solve downloaded/offline base-map areas through an explicit, bounded package/source strategy with verified terms, rather than assuming every remote provider permits caching.

## 3. Architecture decisions

### 3.1 No login, anonymous installation workspace

- Do not add a login/sign-up screen, login route or redirect.
- On first use, generate an installation ID and obtain a random workspace capability from the API without asking the user for credentials. Store the capability in IndexedDB, not localStorage or URL logs. Support revocation/reset in local settings.
- API routes validate the capability and scope every read/write to one workspace. Neon credentials remain only in server runtime secrets.
- This creates an anonymous installation identity, not a person's identity. By default, records belong to that installation. Cross-device sharing needs an explicit share-capability design and must be treated as bearer access; do not imply private per-user collaboration. Do not make the database anonymously writable.
- Preserve local-only use if first-run provisioning cannot reach the server. Provisioning and sync are queued for later; local data remains available.

### 3.2 Local-first store and synchronization

Use IndexedDB with versioned stores for `workspace`, `projects`, `layers`, `features`, `imports`, `blobs`, `outbox`, `tombstones`, `syncState` and `conflicts`. Persist an entity change and its outbox operation atomically. Persist PDF originals/blobs separately from JSON metadata. Bound storage by file size, page count and user-visible quota handling; never silently evict unsynced work.

An outbox operation contains an immutable `operationId`, workspace ID, entity/type/ID, operation (`upsert`/`delete`), payload, `baseVersion`, and creation time. The API accepts push batches idempotently, returns accepted operations or typed conflicts, and supports cursor-based pull. Server versions and deletion tombstones are durable. Client keeps local edits when a conflict occurs and exposes a resolution action; no silent last-write-wins.

The sync engine retries with bounded exponential backoff on `online`, app foreground/resume, and a modest foreground interval. Background Sync is optional only. Use a single-writer lock/lease across tabs. Connectivity is an implementation detail during normal use; show a restrained pending count or conflict/error state only when action is needed to protect data.

### 3.3 API and Neon/PostGIS boundary

All database access is server-side: Vite client → Hono `/api/v1` → Drizzle/Neon. No browser Neon driver, connection string, service key or database password. Align API prefix, shared Zod contracts, pagination, errors and version semantics before enabling production mode. Add project/layer/feature CRUD, sync push/pull, workspace provisioning and import metadata routes. Health reports dependency state without returning raw SQL/provider errors.

Use a separately named disposable PostGIS test target for migrations/integration tests. Gate test writes by explicit test configuration and database-name/host checks. Do not infer that an existing `.env` database is safe. No production migration is part of this task.

### 3.4 GeoPDF import and map overlay

#### Hard feasibility gate

Exact **offline** placement of a newly selected GeoPDF requires a reader/rasterizer already packaged in the installed app. Research found GDAL can read geospatial PDFs, extract georeferencing and rasterize, but the current published `gdal3.js` README lists PDF as write-only. Therefore the implementation must first compare a bundled WebAssembly parser/rasterizer (with a legally compatible PDF backend) against a dedicated client parser and representative fixtures. Select only after proof of local parsing, supported CRS transforms, page/inset behavior, runtime/memory limits and licensing. Backend GDAL may validate/derive files online, but it cannot be the only implementation for the offline requirement.

If no candidate passes the fixture/accuracy gate, stop and present the measured gap for a product decision. Do not ship a nominal GeoPDF upload that only works online or claims an inaccurate placement.

Primary-source follow-up found a practical candidate: `pdf-lib` exposes page dictionaries, arrays, indirect-reference lookup and inherited page attributes; PDF.js accepts local bytes and renders page viewports; the workspace already includes proj4. This combination can be evaluated for ISO `/VP` + `/Measure /GEO` and OGC `/LGIDict` profiles without network access. Feasibility is inferred from these APIs; no sample has yet been parsed/rendered by GeoNexo. Verify point ordering, CRS semantics, CropBox/rotation and insets against standards/GDAL before treating the candidate as supported. Do not claim a complete offline reader from API documentation alone.

#### Import flow

1. Validate file signature and declared extension; enforce configured byte/page/pixel/time limits; store original bytes in IndexedDB before processing.
2. In a worker, inspect pages and supported geospatial metadata locally. Identify profile, CRS, page transform, neatline/inset and georeference confidence; do not trust MIME alone.
3. Normalize georeference data and coordinates into shared geo/contracts types. Preserve source CRS and original metadata. Fail explicitly for unknown CRS, unsupported profiles, password protection, corruption or ambiguous multiple insets.
4. Render the selected page with a bundled PDF renderer. Keep the original PDF as the source record and the render/transform as derived local data.
5. Overlay the page on MapLibre. For simple four-corner transforms, use an image source; for projected/warped content, generate a locally reprojected raster/tiles before overlay. Never stretch a projected page by guessed bounds. Provide page selection, opacity, visibility, fit-to-extent and source-document reference. Use the same forward/inverse transform to show map selections and the GPS position within the PDF viewer, when inside the selected page/neatline; retain the original bytes without silently modifying the document.
6. Queue import metadata/blob for sync. Use object storage only behind API-created, scoped upload/download capabilities; never arbitrary client-chosen storage keys. Resume upload after reconnection.

#### Ordinary PDF fallback

Render locally, then require at least three non-collinear control points (prefer four or more for residual checking) linking page coordinates to map coordinates. Require explicit CRS and show transform type/RMSE/error estimate before confirmation. Store control points and transform; allow later correction. Never auto-locate from document text or filename.

### 3.5 PWA, offline maps and device sensors

- Keep Vite PWA delivery. Precache the versioned app shell and content-hashed assets; provide navigation/deep-link fallback and safe update handling.
- Remove blanket GET caching. Never cache mutable API writes or arbitrary cross-origin data. Add an explicit, capped cache policy for approved map assets and expose storage management.
- Offline base maps are bounded regional downloads from a source whose license and service terms permit offline storage, or a self-hosted/open package format selected after evaluation. Cache styles, glyphs, sprites, metadata and tiles together. If no legally approved base map is available offline, show the user's PDFs and saved data on a neutral grid/last available basemap without losing overlays.
- The researched candidate is a versioned regional PMTiles archive plus local style/glyph/sprite assets. The official browser library exposes a MapLibre custom protocol; source-level `FileSource` reads browser files. Persist archive bytes and package metadata/checksum locally, then resolve map resources without network requests. This is a documented integration candidate, not an executed proof. A regional package producer/source and practical byte/zoom budgets still require the G0.5 evidence gate. OpenFreeMap's official site permits self-hosting, offers planet downloads and describes unlimited public requests; this research has not verified any separate automated-collection prohibition, and does not assume one.
- Manifest should have stable `id`/`start_url`, standalone display and full icon set; add safe-area support, mobile navigation, install/update affordances and touch sizing. Do not present browser implementation details during normal app use.
- GPS and orientation start only after a user action. Ask for permission when the platform requires it, update only while active, and clean up `watchPosition`, orientation events and wake locks when hidden/stopped. Denial or missing support must not block maps. Test mobile browser differences explicitly.

## 4. Shared contracts/data changes

The implementation-ready plan should add Zod/types for:

- `WorkspaceCapability` provisioning/revocation (secret hashes only server-side), `SyncOperation`, push/pull envelopes, cursor, server version, conflicts and tombstones.
- Import state/format, source page, geospatial profile, CRS, extent, transform/control points, residual metadata, blob reference and processing error.
- Geometry discriminated unions with bounded coordinates/properties; no `z.any()` for geometry or sync payload.

DB additions are migration-backed workspace scope, idempotency keys, server change cursor/versioning, tombstones, import records and blob/object references. Index by workspace and cursor. Add retention/cleanup that never removes pending local data. Migration SQL must be forward-only and tested on disposable PostGIS.

## 5. Dependency-safe task graph

### Wave 0 — baseline and contract gates

`G0.1` Repair baseline TypeScript and ESLint dependency/config failures; add missing E2E workspace script/dependency coherently.  
`G0.2` Finalize anonymous installation capability and data scope; document threat boundary.  
`G0.3` Run the GeoPDF parser feasibility spike with lawful ISO 32000/OGC fixtures; choose/record parser, supported profile list, accuracy bound, and license.  
`G0.4` Establish isolated disposable PostGIS/Neon test environment and CI integration service.  
`G0.5` Select offline map package/provider after terms, attribution, and storage cost review.

**Gate:** no feature implementation until G0.2–G0.5 have evidence and contracts freeze. If G0.3 or G0.5 fails, bring back a concrete alternative/limitation for approval.

### Wave 1 — persistence and API (backend ownership)

`D1.1` Migration/schema for workspace scope, versions, tombstones, idempotency, sync cursor and import/blob metadata.  
`D1.2` Transactional repositories and migration tests against disposable PostGIS.  
`A1.1` Capability provisioning/revocation and workspace-scoped routes.  
`A1.2` Align `/api/v1` and implement projects/layers/features CRUD using shared bounded contracts.  
`A1.3` Push/pull sync protocol; conflict and idempotency behavior.  
`A1.4` Import metadata/blob API with strict upload bounds and safe object keys.

**Gate:** contract tests and real PostGIS integration prove scoping, retry safety, conflicts, cursors, tombstones and validation.

### Wave 2 — client local store and sync (frontend ownership)

`F2.1` IndexedDB versioned stores/migrations and atomic entity+outbox writes.  
`F2.2` Local-first repositories and replace mock-default product paths.  
`F2.3` Sync engine with idempotent push, cursor pull, retry/lock, conflict preservation and revocation handling.  
`F2.4` Quiet connectivity UI with actionable pending/conflict state.

**Gate:** browser can create/edit/delete offline, reload, reconnect, replay safely and verify server round trip to test DB.

### Wave 3 — GeoPDF/PDF and maps (geo + frontend, after G0.3)

`P3.1` Build parser/renderer adapter in a dedicated package/worker using only the selected proven implementation.  
`P3.2` GeoPDF supported profiles/CRS transforms/fixtures/accuracy reporting.  
`P3.3` Ordinary PDF control-point flow and residual validation.  
`P3.4` MapLibre page overlay, visibility/opacity/page selection and offline retention.  
`P3.5` Durable import and resumable Neon/object-storage sync.

**Gate:** automated offline fixture test shows expected map extent and error bound; unsupported sample fails safely; ordinary PDF requires manual control points.

### Wave 4 — PWA, basemaps and sensors

`W4.1` Safe app-shell service worker, deep links and controlled updates.  
`W4.2` Regional offline base-map packages, attribution and bounded storage.  
`W4.3` Native-like safe-area/mobile interaction and install flow.  
`W4.4` GPS/orientation gesture permissions and lifecycle cleanup.

**Gate:** install and relaunch offline, preserve local features/PDFs, render downloaded map region, and exercise allow/deny permission paths.

### Wave 5 — independent QA, security and delivery evidence

`Q5.1` Real Playwright flows for no-login, offline edits/reload/reconnect, GeoPDF, manual PDF calibration, map offline package and sensors.  
`S5.1` Independent security review of capabilities, API scope, upload/parser, XSS, external requests, service worker, secrets and migrations.  
`Q5.2` Fix findings and rerun complete quality suite with explicit evidence.  
`Q5.3` Start only verified local services, confirm loopback readiness, open the local preview for user review.

**Completion gate:** lint/typecheck/unit+integration/E2E/build pass; independent review has no unresolved release-blocking issue; no production mutation/deployment.

## 6. Verification requirements

- Test offline persistence across reload and browser restart, including PDF Blob and unsubmitted changes.
- Test duplicate outbox delivery, network interruption between request/response, cursor pagination, tombstone retention, and concurrent edit conflict.
- Test corrupt, oversized, password-protected, multipage, inset and unknown-CRS PDFs; document supported ISO/OGC profile coverage using real fixtures.
- Run Playwright against a real local API and isolated database, never a mocked API for sync assertions. Include Chromium mobile viewport; run additional engines where the CI/browser install supports them.
- Validate the service worker does not cache APIs or unapproved hosts and that navigation works after a clean offline launch.
- Verify GPS/orientation prompts originate from user action and listeners are removed on stop/hide/unmount.
- Never run destructive DB commands or apply migrations to any database not positively identified as disposable.

## 7. Risks and unresolved product boundary

The no-login UX and secure identity are separate concerns. This proposal silently provisions one anonymous workspace per installation, which enables local and remote sync without a login form but does not automatically share data across devices. Sharing needs a scoped share capability. If the desired use is one shared dataset across all users/devices without any login or share step, that is a public bearer-access model and needs explicit acceptance plus rate limits, abuse controls and public-data assumptions before implementation.

Browser offline storage can be evicted or quota-limited; the app must detect quota failure and preserve user-visible export/recovery options. PWA/browser background execution varies, so foreground reconnect/resume is the correctness path. A service worker cannot make a remote basemap available offline unless all licensed resources have been downloaded ahead of time.

GeoPDF formats differ in CRS, neatlines, pages, and datum support. Accuracy claims must be tied to tested profiles and fixtures; any uncertain transform must fail closed or require manual calibration.

## 8. Technical research references

- [GDAL PDF driver](https://gdal.org/en/stable/drivers/raster/pdf.html): reads geospatial PDF metadata and rasterizes pages; documents multipage handling, datum limitations and inset selection. Use as a server-side reference/validator, not as the only processor for the offline import requirement.
- [gdal3.js repository](https://github.com/bugra9/gdal3.js): its published README currently lists PDF under **Write Only** and identifies LGPL-2.1-or-later licensing. Do not adopt it for PDF reading without a new build and fixture/license proof.
- [Mozilla PDF.js](https://github.com/mozilla/pdf.js): general PDF parsing/rendering library suitable as a local page renderer; this research did not establish GeoPDF georeferencing support in PDF.js.
- [pdf-lib PDFPage](https://github.com/Hopding/pdf-lib/blob/master/src/api/PDFPage.ts) and [PDFPageLeaf](https://github.com/Hopding/pdf-lib/blob/master/src/core/structures/PDFPageLeaf.ts): source APIs for page dictionaries and inherited boxes/rotation; candidate for local geospatial dictionary extraction, subject to fixture validation.
- [MapLibre style specification: image source](https://maplibre.org/maplibre-style-spec/sources/#image): supports an image source positioned by four geographic corners. More complex projected/warped pages need reprojection before display.
- [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API): browser-local structured storage foundation for records and blobs; app still needs explicit schema versioning and quota/error handling.
- [MDN DeviceOrientationEvent permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static): permission is limited-availability and requires transient user activation on platforms that implement this API.
- [Neon connection guide](https://github.com/neondatabase/website/blob/main/content/docs/get-started/connect-neon.md): server application uses a connection string; keep it in the server environment and outside the browser bundle.
- [PMTiles browser README](https://github.com/protomaps/PMTiles/blob/main/js/README.md): MapLibre protocol integration for archive-backed sources; local package/style asset handling still needs app implementation and offline execution evidence.
- [OpenFreeMap](https://openfreemap.org/) and [official repository](https://github.com/hyperknot/openfreemap): self-hosting/public instance, full-planet downloads, required attribution and operational limitations. Regional offline packages need a measured preparation/storage strategy.
