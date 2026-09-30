# PWA Executor Review — GeoNexo Vite

**Task:** GEO-LOCALFIRST-2026-09-29  
**Date:** 2026-09-30  
**Skill applied:** `pwa-executor` at `C:/Users/MATEUS/.codex/skills/pwa-executor/SKILL.md`  
**Review role:** frontend/PWA, independent read-only audit  
**Status:** audit complete; PWA acceptance remains **FAIL/PENDING**.

## Adaptation

The skill contains Next.js, `next-pwa`, and Capacitor examples. GeoNexo is Vite + React. Following the PRD, this review keeps the existing stack and evaluates Vite + `vite-plugin-pwa` + Workbox principles. No Next.js conversion, `next-pwa`, Capacitor, or push notification work is in scope. Reading the skill does not count as implementation or device acceptance.

## Findings

| Requirement | Current evidence | Result |
|---|---|---|
| PWA build integration and one controlled source of the worker | `apps/admin/public/sw.js` is the only worker, but there is no `vite-plugin-pwa`, `injectManifest`, Workbox configuration, or generated build asset list in `apps/admin/package.json` / `apps/admin/vite.config.ts`. | FAIL |
| Manifest | Standalone mode, scope, language, theme colors, four icon declarations, and shortcuts exist. Stable `id` is absent; `start_url` includes query parameters. HTTP/MIME, shortcut destinations, image dimensions, and maskable safe areas are not verified. | PARTIAL / PENDING |
| Cold offline launch | Worker precaches `/`, `index.html`, manifest and two icons. Hashed JS/CSS and lazy assets are added only after successful online requests. Existing evidence proves warm cached deep links, not a first offline launch. | FAIL |
| Cache boundaries | Current worker bypasses API and non-GET requests and does not return HTML for an unknown asset. The complete versioned app shell and local map package strategy are absent. | PARTIAL |
| Offline fonts | Material Symbols are self-hosted under `apps/admin/public/fonts` and preloaded in `index.html`; the current worker does not precache that font before the first offline launch. | PARTIAL |
| Install experience | Settings handles `beforeinstallprompt` and standalone detection. No iOS Add-to-Home-Screen guidance or physical Android/iOS installation evidence exists. | FAIL / PENDING |
| Update safety | The worker calls `skipWaiting()` on install and accepts `SKIP_WAITING`. No user-confirmed update prompt, dirty-work/outbox check, or IndexedDB compatibility handshake exists. | FAIL |
| Offline domain data | `offline-db.ts` is a generic IndexedDB object store. Projects/layers/features/outbox/sync state are not durably stored as one local-first data model; server CRUD hooks remain online API consumers. | FAIL |
| Touch/mobile layout | Safe-area viewport, focus styles, 44px minimum controls and mobile navigation exist in source. Device screenshots, gesture conflict checks, and actual device acceptance are absent. | PARTIAL |
| GPS/orientation | A user-triggered MapLibre geolocate control exists. The separate location hook is not wired into the workspace; orientation and physical sensor lifecycle are unverified. | PARTIAL / PENDING |
| Performance/accessibility | No measured mobile pan/pinch, long-task, memory, PDF worker, or virtualized-list evidence. Full contrast, reduced-motion, accessible-dialog and zoom review is pending. | PENDING |

## Verification evidence

The independent reviewer ran:

```text
pnpm --filter admin exec vitest run src/test/service-worker-policy.test.ts src/test/offline-db.test.ts
Test Files: 2 passed
Tests: 7 passed
```

These tests cover worker routing/cache isolation and IndexedDB transaction completion only. They do not prove installation, cold offline launch, safe updates, domain sync, GeoPDF, or physical devices.

During the root audit, the dev app also returned HTTP 200 at the actual loopback URL `https://127.0.0.1:5173/`; Vite used its development SSL certificate. This is launch evidence only, not valid mobile installation evidence.

## Required follow-up

Implement and test the missing build-generated shell/update lifecycle, iOS guidance, local-first domain stores and synchronization, approved regional map packages, and user-triggered sensor lifecycle under the reviewed plans. Verify manifest/icon resources and cold offline behavior in a built browser. Record real-device results separately; do not infer them from desktop emulation.
