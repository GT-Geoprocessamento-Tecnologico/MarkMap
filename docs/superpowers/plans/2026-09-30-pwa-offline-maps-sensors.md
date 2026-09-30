# PWA, Offline Maps and Sensors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development after master-plan review. Keep shell/maps/device modules and page integration under disjoint writers; independent QA runs the resulting application.

**Goal:** native-like touch presentation, durable offline relaunch and map packages, with GPS/orientation enabled safely from user actions.

**Architecture:** a versioned build-generated shell asset manifest and safe service worker; licensed regional PMTiles packages plus local style/glyph/sprite assets; sensor controller with explicit lifecycle. Correctness uses foreground/resume; background execution is optional.

**Tech Stack:** React/Vite/MapLibre, Service Worker/IndexedDB, candidate PMTiles FileSource protocol, Geolocation/DeviceOrientation, Vitest/Playwright.

**Spec:** [GeoNexo specification](../specs/2026-09-29-geonexo-localfirst-geopdf.md). **Depends on:** master written-plan review, G0.5 package proof, G0.6 PWA Executor review, local store ports, geo/PDF map transforms and approved shared manifests.

## Global Constraints

- Never cache arbitrary GET/API responses; maintain v2 API/reserved-route/cross-origin bypass rules and unrelated-cache retention.
- No silent eviction of originals, unsynced entities or operations. Proposed package ceiling 250 MiB; check available quota with reserve before writes, preserve old valid package during upgrade.
- Sensor permission from a gesture only; unavailable/denied sensor leaves map usable. A gyroscope is not a precise absolute compass by itself.
- Existing UI pages edited only by root, the sole frontend integrator. Tooling owner changes Vite/manifest dependencies, lockfile and build assets; map/sensor owners deliver exports and focused tests.
- Test red/green, inspect diff, provide independent evidence. No commit or remote provider collection/deployment without applicable authorization.

## Review Focus

Complete offline resource graph, quota/update interruption, package provenance, phone touch/safe areas, permission gestures and background lifecycle. An installed PWA can resemble a native app; platform permission/install UI remains controlled by the OS/browser.

---

## W0 — regional source and storage proof (G0.5)

**Create:** `docs/maps/offline-package-source.md`, lawful tiny test package and provenance under `packages/maps/tests/fixtures/offline/`; experimental adapter/tests for local archives. Consume the single `OfflineMapPackageManifest` contract frozen by the contracts owner in master G0.2; W0 must not define a second wire shape.

The authoritative `OfflineMapPackageManifest` schema and inferred type live only in `packages/contracts/src/offline-map.ts`, frozen in master G0.2. W0 fixtures, the experimental archive adapter, and later package installation all import this definition; no local wire-shaped copy is allowed.

- [ ] Choose an actual region/package producer and verify source license, required attribution, font/sprite license and download/service terms from primary sources; record dates/versions.
- [ ] Produce/import a small region from permitted data; measure bytes/zoom/extent and validate archive indexes/hash. No unverified crawling assumption or full-planet client download.
- [ ] Render geometry/labels/icons from local archive + local assets with network blocked. Pin supported PMTiles format/library, package limits and missing resource behavior.
- [ ] Test truncation/oversize/path traversal/style external URLs and checksum mismatch before committing local package activation.
- [ ] If resource/terms/data source cannot pass, stop with concrete gap and proposed source. PDFs/local features remain available on a neutral grid while package work is unresolved; that fallback does not pass full basemap acceptance.

**G0.5 source feasibility:** **PASS** in [`docs/maps/offline-package-source.md`](../../maps/offline-package-source.md). The official Protomaps `20260930.pmtiles` regional extract verified as PMTiles v3/MVT (4,300,633 bytes; z0–12; SHA-256 recorded). A matching local style, six glyph ranges and four sprites, including `@2x`, validated against G0.2 and rendered at DPR 1/2 with zero external requests. Source artifacts and screenshots remain in OS temp. This closes only the feasibility gate; no package fixture, installer, IndexedDB store, custom PMTiles protocol, product selection UI or package lifecycle tests are present in this workspace yet. The remaining W0 tests below are still open.

## W1 — production shell, deep links and controlled updates

**Create:** `apps/admin/scripts/generate-shell-manifest.mjs`, focused build-manifest tests, `src/components/pwa/UpdatePrompt.tsx`; **Modify:** `public/sw.js`, `public/manifest.json`, `src/index.tsx`, Vite/build wiring and existing `src/test/service-worker-policy.test.ts` under tooling/shell ownership.

- [ ] Add failing tests: generated manifest lists all emitted JS/CSS/lazy workers/fonts/icons required for initial app and routes; excludes maps/API/unapproved external resources.
- [ ] Generate immutable versioned asset list after Vite build; precache atomically and report failed install without activating a partial cache. Preserve explicit UI route fallback and v2 bypasses.
- [ ] Set stable manifest `id`, relative scoped `start_url`, standalone/icons and safe launch path. Request persistent storage when appropriate after interaction, handle refusal normally.
- [ ] New worker waits until app has durably saved edits/queues and user accepts update; handshake confirms store compatibility, then controlled activation/reload. Keep needed old shell cache until safe transition.
- [ ] Tooling owner configures the development `/api` proxy to the actual verified API loopback URL and production same-origin serving. Local-sync Task 8 owns only the client transport consumer, preventing duplicate service-worker/Vite writers.
- [ ] Test old/new worker lifecycle, interrupted precache, open tab compatibility, API no-cache and unknown asset no-HTML response. Real built-app browser offline launch is required; VM policy checks alone cannot pass.

## W2 — local offline map package repository/protocol

**Create:** `apps/admin/src/lib/storage/offline-map-store.ts`, `packages/maps/src/offline/{package,protocol,style}.ts` and focused tests. **Modify:** map provider selection/exports by the maps owner; root, as sole frontend integrator, owns settings package management.

```ts
installMapPackage(input: MapPackageInput, signal: AbortSignal): Promise<InstalledMapPackage>;
activateMapPackage(id: string): Promise<LocalMapResources>;
removeMapPackage(id: string): Promise<void>;
registerOfflineProtocol(maplibre: MapLibreAdapter, resources: LocalMapResources): () => void;
```

- [ ] Start failing tests for checksum, manifest/path/schema/zoom bounds, archive random access, unknown assets and current-package upgrade interruption.
- [ ] Store original archive Blob and complete assets in staging, verify then atomically activate metadata. Check quota reserve; do not assemble unbounded buffers repeatedly or silently remove user work.
- [ ] Custom protocol resolves local ranges/style/glyph/sprite URLs without network; define cancellation/cache disposal. PMTiles version and API selected by W0 source proof, not assumed method names.
- [ ] Select local package when usable; bound region/zoom visibly, retain attribution. Missing region shows local overlays/grid and recoverable download/import action, no endless remote fetch loop.
- [ ] E2E package offline render after context restart, labels/icons present, failed package unchanged, explicit remove affects only selected package and never PDF/outbox.

## W3 — native-like interaction and quiet sync

**Create:** `apps/admin/src/components/layout/MobileNavigation.tsx`, `src/components/pwa/InstallAction.tsx`, `src/components/sync/SyncStatus.tsx`; **Modify:** root alone owns existing layout/workspace/import/settings pages; the tooling owner alone owns global style/manifest build integration.

- [ ] Add component/E2E checks for 44 CSS-pixel touch targets, accessible names for icon controls, focus/keyboard/Escape and dialogs, safe-area inset, small viewport/landscape, bottom-sheet scroll and map gesture interaction.
- [ ] Verify non-color status communication, contrast, `prefers-reduced-motion`, and ordinary browser zoom at mobile and desktop breakpoints; record automated/manual evidence and residual issues.
- [ ] Reuse design system; keep primary map and PDF actions reachable, mobile bottom navigation and desktop layout coherent. Remove developer mock/API/provider labels from normal product choices once local repository is the default.
- [ ] Routine online/offline transitions do not trigger banners/toasts. Pending count and actionable conflict/storage/revoked-sync errors preserve user awareness of unsent work; details in settings.
- [ ] Install action respects `beforeinstallprompt`/standalone checks; platform instructions appear only when needed. Avoid claims that installation/permissions are already granted.
- [ ] Run mobile Chromium/WebKit user flow and independent visual review on actual screenshots; document OS installation check separately.

## W4 — GPS, orientation and optional device resources

**Modify:** `packages/maps/src/device-location.ts` (currently empty), maps exports; **Create:** `packages/maps/tests/device-location.test.ts`, `apps/admin/src/components/maps/LocationControls.tsx`; integration owner connects workspace/page viewer.

```ts
type DevicePose = {
  longitude: number; latitude: number; accuracyMeters: number; timestamp: number;
  headingDegrees: number | null; headingSource: 'gps-course' | 'absolute-orientation' | null;
};
createDeviceLocation(options: DeviceLocationOptions): {
  startFromGesture(): Promise<void>; stop(): void; subscribe(listener: (pose: DevicePose) => void): () => void;
  dispose(): void;
};
```

- [ ] Add failing tests for missing APIs, denied permission, invalid/stale coordinates, repeated start, stop/hide/unmount, orientation unavailable/NaN and visibility resume.
- [ ] Request location/orientation only inside actual user gesture; show accuracy ring, follow mode and optional heading from validated GPS course/absolute orientation. Relative gyro output must not be labeled true north without a proved reference.
- [ ] Watchers/listeners stop on hidden/dispose; resume only opted-in session, retry denied permission only from another gesture. Throttle rendering and battery use; explicit high-accuracy mode when desired.
- [ ] Optional wake lock only for active navigation after action; release on hide/stop, missing support normal. No unrelated hardware permissions.
- [ ] Feed one pose to map and PDF inverse transform. No location collection/upload unless a user explicitly records a local track; local track then follows the normal sync contract.
- [ ] Unit + browser emulation green; physically verify Android/iOS GPS/orientation gestures/standalone behavior and record unavailable device checks as pending, never passed by mocks.

## W5 — storage recovery and browser acceptance

**Create:** `apps/admin/src/lib/storage/quota.ts`, `src/components/storage/StorageRecovery.tsx`, named PWA/maps/sensor E2E in master Q5. **Modify:** local store and settings by their owners only.

- [ ] Test quota failure inside entity/outbox transaction, Blob staging and package install; ensure no partial state says success and originals/unsent operations remain exportable.
- [ ] Export recovery bundle using a versioned manifest and local originals/records, excluding remote bearer credentials by default; import validates schema/hash/bounds before activation. Recovery import/export is explicit user action.
- [ ] Verify production install/update/offline deep links in real browser engines, pending queue durability, downloaded region and retained PDF, sensor deny/allow and cleanup.
- [ ] At a real mobile viewport, capture pan/pinch behavior, long tasks, offline-map label/list scrolling and memory sampling with identified browser/device and dataset; keep physical Android/iOS installation/sensor evidence separate from emulation.
- [ ] Record actual device/browser support and all missing physical/remote proofs in `docs/quality/localfirst-acceptance.md`. Full product completion remains blocked by unpassed master gates.

## Risk-input self-review

| Input | Owning evidence |
| --- | --- |
| Malicious/truncated/offsite package | W0/W2 schema/hash/resource tests |
| Interrupted shell upgrade | W1 real worker lifecycle tests |
| Storage exhaustion/eviction | W2/W5 atomic recovery checks |
| Missing/denied/stale sensor | W4 lifecycle/unit/browser/device checks |
| Small-screen gestures/conflicting edits | W3 visual/E2E; master real sync tests |
