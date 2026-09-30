# Functional GeoPDF import and local preview

**Task ID:** GEO-PDF-PREVIEW-2026-09-30  
**Role:** frontend/PDF integration builder  
**Status:** ready; exact PDF.js/runtime pins and notices passed independent dependency review  
**References:** [P1 implementation specification](../specs/2026-09-30-geopdf-p1-implementation.md), [GeoPDF core task brief](2026-09-29-geonexo-localfirst-geopdf.md), [PDF source feasibility](../../maps/geopdf-feasibility.md)

## Objective

Make the existing Imports screen accept a PDF, persist the original in local IndexedDB, reopen it after reload, and render its first page with the locally bundled PDF.js worker. Show the parser's georeferencing result clearly. Unsupported or contradictory metadata must not prevent viewing the PDF, and must never cause automatic placement.

## Scope

Builder may edit:

- `apps/admin/src/pages/imports/ImportsPage.tsx`
- new `apps/admin/src/lib/pdf/**`
- `apps/admin/src/lib/local-repositories/index.ts` and focused tests only to list persisted PDF originals for reload
- focused component/unit tests for the import flow

Do not edit package manifests/lockfile/notices, `packages/geo/src/pdf/**`, local-db schema/version, PWA service worker, offline-map storage/protocol, routing, database/API, or existing page layouts outside ImportsPage.

## Approved behavior and reuse

- Consume `inspectPdf` and the public P1 resolvers from `@geonexo/geo`; do not duplicate parsing or georeferencing algorithms.
- Use exact installed `pdfjs-dist@6.3.289` and its Vite-bundled worker. The local worker must appear as a hashed build asset and may not be fetched from a CDN.
- Persist originals via `LocalRepository.saveOriginal`; identify them by content hash so a duplicate upload is idempotent. Reopen from local IndexedDB after reload.
- Keep the 25 MiB file cap and page/render bounds. Do not copy the test PDF into fixtures or source.
- For `geopdf de araguaina.pdf`, render the page but show that the declared projected CRS conflicts with GPTS values. Do not add EPSG:3857 to the supported P1 parser, swap/reinterpret axes, or infer EPSG:4326. No overlay/position claim for this file.

## Acceptance criteria

1. Imports accepts `.pdf` and preserves the existing GeoJSON/GLB flows.
2. The original is stored locally with byte count, SHA-256 and content-derived ID; it appears after reload and can be reopened while offline.
3. First page renders through local PDF.js worker. Page bytes, pages and pixel budget are bounded; canvas state is cleaned up on selection change/unmount.
4. Supported GeoPDF profiles show their parsed status/bounds. Unsupported CRS, malformed metadata or ordinary PDF still render as a document and display a plain-language reason that it was not placed.
5. Focused tests cover upload, persistence/reopen, worker configuration/build output, unsupported CRS fallback, bounds and cleanup while existing import tests pass.
6. Fresh Chromium smoke imports the actual Araguaína PDF, sees its preview and explicit no-auto-position status, reloads/reopens it offline, and confirms no worker/document request goes to a remote host.

## Risk and stop conditions

- Main risk is a displayed map position based on contradictory metadata. Stop any automatic position on a parser/georeferencing error.
- Workspace edits and local tests only; no package install, remote write, database mutation, commit, deploy or cleanup.
- Stop if the installed dependency/runtime cannot bundle the worker locally, local storage needs a schema change, or an acceptance criterion requires editing root-owned map/page integration.
- Handoff must include task ID, status, summary, changed files, exact commands/results, real-PDF/browser evidence, risks and review requirement.
