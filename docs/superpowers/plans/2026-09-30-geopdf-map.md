# GeoPDF and PDF Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development under the approved master plan; keep parser/geo ownership separate from frontend integration and independent QA.

**Goal:** import a supported GeoPDF offline, verify embedded placement, and reference the original page, map and GPS through the same transform. Ordinary PDFs require explicit calibration.

**Architecture:** a bundled worker extracts geospatial dictionaries and renders selected pages from local bytes. Typed forward/inverse transforms preserve CRS, CropBox/rotation and neatlines. MapLibre uses an image only when its accuracy is proved; otherwise a local raster-tile protocol reprojects the document.

**Tech Stack:** TypeScript/proj4/MapLibre, candidate pdf-lib + PDF.js; Vitest fixture checks and real Playwright. Candidate dependencies are installed only for an approved feasibility spike after license review.

**Spec:** [GeoPDF P1 implementation specification](../specs/2026-09-30-geopdf-p1-implementation.md); broader product requirements remain in [GeoNexo specification](../specs/2026-09-29-geonexo-localfirst-geopdf.md). **Depends on:** independent P1-SPEC-REVIEW PASS, master written-plan review, G0.2 shared contracts, G0.3 proof, local repository/blob adapters.

## Global Constraints

- No server/network dependency for opening a newly selected supported file. Never infer location from filename/text or silently reinterpret unsupported CRS.
- Own `packages/geo/src/pdf/**`, `packages/maps/src/pdf/**` and dedicated frontend PDF components; root is the sole writer of existing application pages.
- Resource proposals: 25 MiB original, 100 pages, 512×512 output tile, one active render/eight queued requests, 64 MiB derived cache per import/250 MiB total, and 30-second worker deadline. A large logical viewport is tiled and never allocated as a full-page canvas. Reject over-budget input deterministically. Measure on representative devices; these are application ceilings, not a browser memory guarantee.
- Original bytes stay immutable and locally durable; GPS/page markers are app overlays. Any future edited PDF export must be an explicit copy.
- Every task uses the red/green/focused-check/diff-review sequence. No commit without authorization; no remote writes or unchecked external code copying.

## Review Focus

Profile/axis/CRS proof, forward/inverse accuracy, multiple insets, metadata uncertainty, worker limits, local originals and three-point calibration uncertainty. Fixture coordinate accuracy does not establish field survey accuracy or improve a device's GPS.

---

## Shared interfaces (contracts owner defines once)

`packages/contracts/src/pdf.ts` supplies JSON-only schemas/types:

```ts
type PagePoint = readonly [number, number]; // PDF user-space points; explicit CropBox/Rotate
type LonLat = readonly [number, number]; // longitude first, WGS84 API output
type ControlPoint = { page: PagePoint; ground: readonly [number, number] }; // canonical x/y in GeoReference.sourceCrs and its registry unit
type GeoReference = {
  profile: 'iso-measure-geo' | 'ogc-lgidict' | 'manual';
  sourceCrs: string;
  pageIndex: number;
  cropBox: readonly [number, number, number, number];
  rotation: 0 | 90 | 180 | 270;
  controls: readonly ControlPoint[];
  neatline: readonly PagePoint[];
  transform: { model: 'affine'; coefficients: readonly number[] };
  residual: { rmseMeters: number | null; maxMeters: number | null; independentCheck: boolean };
};
type BlobRef = { id: string; sha256: string; bytes: number; mediaType: string };
type ImportMetadata = {
  id: string; projectId: string; originalName: string; source: BlobRef;
  format: 'pdf'; state: 'queued' | 'processing' | 'needs-calibration' | 'ready' | 'failed';
  pageCount: number | null; geoReference: GeoReference | null; errorCode: string | null;
};

// Worker-only (never serialized in packages/contracts):
type PdfTileRequest = { scale: number; rect: { x: number; y: number; width: number; height: number } };
type RenderedPdfTile = { bitmap: ImageBitmap; pageIndex: number; rect: PdfTileRequest['rect']; viewportWidth: number; viewportHeight: number };
openPdfDocument(bytes: Uint8Array, limits: PdfLimits, signal: AbortSignal, onProgress: ProgressListener): Promise<PdfDocumentHandle>;
renderPdfTile(documentId: string, pageIndex: number, request: PdfTileRequest, signal: AbortSignal): Promise<RenderedPdfTile>;
closePdfDocument(documentId: string): Promise<void>;
```

The affine six-coefficient model maps PDF page coordinates into the native x/y coordinates of `sourceCrs`; it must be fitted before projection. `pageToLonLat` and `lonLatToPage` expose WGS84 `[longitude,latitude]` and use the exact local CRS allowlist. Unsupported non-affine metadata requires a separate reviewed model or manual calibration. Domain types may use branded IDs; wire representations remain strings. No class instances/functions/Blobs in metadata or sync payloads. `ImageBitmap` is confined to the worker-client boundary and never enters `packages/contracts`. Blob bytes use the local/blob transport adapter.

## P0 — feasibility spike and standards proof (G0.3)

**Status:** PASS for the bounded feasibility contract only; production GeoPDF integration remains in P1 and is not approved by this status.

**Create:** `packages/geo/tests/pdf/fixtures/README.md`, fixture generator/input documents and `geopdf-feasibility.test.ts`; `docs/maps/geopdf-feasibility.md`; temporary candidate adapter under `packages/geo/src/pdf/experimental/`. Tooling owner alone changes geo/admin manifests/lockfile.

- [x] Review pinned primary ISO/OGC/GDAL interpretation, dependency versions/licenses and fixture provenance. Search only supplied/project workspace roots for a real project PDF and record whether one is available. Create own small ISO and OGC examples or retain verified compatible fixture attribution; do not copy uncertain datasets.
- [x] Persist fixture tests for dictionary indirection, inherited CropBox/rotation, WGS84, verified projected CRS, multiple pages, one inset and multiple ambiguous insets. Current focused suite passes 8/8.
- [x] Parse/rasterize with all network blocked. Compare known page/ground points against an independent GDAL/PROJ reference, not a second call to the implementation under test.
- [x] Require at most 1 metre coordinate error on declared control/check points for supported fixtures. Record input metadata precision and expected image half-pixel sampling error separately. No universal geographic guarantee.
- [x] Inspect the authorized real project PDF locally and record its detected profile, CRS, unavailable bounds/residual, open time and memory limitations; do not commit/copy it.
- [x] Measure time, worker termination and render budgets; inspect worker/network output for remote fonts/scripts. Assert that no PDF JavaScript runs, no `eval` path is used, and no embedded URI/font/script causes an automatic network fetch. Test corrupt/password-protected/unsupported metadata and cancellation without app crash.
- [x] Record the bounded supported profiles/CRS/axis order and bytes-to-page transform; independent plan and implementation reviews accept the candidate for feasibility. Keep it experimental and fail closed for unsupported producer metadata.
- [x] Unsupported or inconsistent metadata has a concrete fail-closed result (including Araguaína); no server-only automatic-placement fallback is proposed.

## P1 — production parser/renderer and CRS adapter

**Create:** `packages/geo/src/pdf/{metadata,iso-measure,ogc-lgidict,crs-registry,errors,types,transform,index}.ts`; `apps/admin/src/workers/pdf.worker.ts`, `apps/admin/src/lib/pdf/{worker-client,renderer,tile-cache}.ts`; tests under `packages/geo/tests/pdf/` and `apps/admin/src/test/pdf-worker.test.ts`. **Modify:** geo exports, Vite worker configuration under coordinated tooling owner.

Interfaces:

```ts
inspectPdf(bytes: Uint8Array, limits: PdfLimits): Promise<PdfInspection>;
resolveGeoReference(page: PdfPageMetadata, selection?: InsetSelection): GeoReference;
pageToLonLat(ref: GeoReference, point: PagePoint): LonLat;
lonLatToPage(ref: GeoReference, point: LonLat): PagePoint | null;
renderPdfTile(documentId: string, pageIndex: number, request: PdfTileRequest, signal: AbortSignal): Promise<RenderedPdfTile>;
```

- [ ] Add tests for finite coordinates, valid array lengths, unit/axis semantics, pole/dateline behavior, singular transforms, unknown CRS and neatline clipping; declare dateline cases unsupported until explicitly proved.
- [ ] Implement only P0 profiles, bounded dictionary traversal, the pinned GeoPDF registry (`EPSG:4326`, the verified exact `EPSG:32620` WKT and OGC `/GEOGRAPHIC /WGE`→`EPSG:4326`) and nominal errors from the implementation specification. `EPSG:4674` may remain in general GeoNexo GIS tools but is not accepted by this GeoPDF gate. No runtime CRS lookup required offline.
- [ ] Fit the affine in the declared native CRS units; convert only at WGS84 API edges. Verify four-point and withheld-point residuals independently in metres. Reject automatic acceptance when an independent check exceeds 1 m; three controls set `independentCheck=false` and do not claim measured accuracy.
- [ ] For EPSG:32620, reject controls/sample points outside EPSG area of use (66°W–60°W, 0°–84°N). Measure document extent as the bounding box of Neatline vertices transformed to native CRS; require width and height each ≤100 m until the multiscale PROJ reference fixtures pass. Add independent fixtures at 100 m, 1 km, 10 km and 100 km plus near-area-boundary samples. For N≥4 controls, leave one point out per fold, fit the other N−1 and measure the omitted point; with four controls, each fold uses three and validates the fourth. Set `independentCheck=true` only for this withheld check; three-control fits set it false and do not claim measured accuracy.
- [ ] Keep normalized document coordinates independent of renderer CSS zoom/device pixel ratio. Test forward/inverse round trips for 0/90/180/270 rotation and nonzero CropBox.
- [ ] Open the PDF once per worker session, render only visible ≤512×512 tiles, maintain bounded local tile cache, expose initial-processing progress, pause invisible work, and terminate/recreate worker on abort/deadline. Release transferred canvases/ImageBitmaps/object URLs on cancellation/unmount. Reject encrypted/ambiguous documents with useful action.
- [ ] Tooling pins `proj4@2.22.0` exactly with the existing lockfile integrity, moves `pdf-lib@1.17.1` to runtime, adds the P0-validated `pdfjs-dist@6.3.289`, updates license notices and passes `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm --filter @geonexo/geo test`, `typecheck` and `lint` as separate commands, focused worker tests, then independent accuracy review.

## P2 — durable import transaction

**Create:** `apps/admin/src/lib/pdf/import-pdf.ts`, tests `src/test/pdf-import.test.ts`; integrate repository ports supplied by the local-sync plan. **Modify:** `packages/contracts/src/import.ts` by the sole contracts owner; root, as sole frontend integrator, updates `pages/imports/ImportsPage.tsx`.

```ts
importPdf(input: { projectId: string; file: File }, signal: AbortSignal): Promise<ImportMetadata>;
resumePdfImport(importId: string, signal: AbortSignal): Promise<ImportMetadata>;
```

- [ ] Add tests: valid signature/MIME mismatch, oversize input, IDB quota failure, worker interruption and reload after original is stored.
- [ ] Atomically store BlobRef + original bytes + queued metadata before processing; failure must not report success or discard unsynced originals.
- [ ] Persist processing state/error and page choices; reuse SHA256 metadata but keep blob authorization separate from public hashes. Resume interrupted jobs once, never duplicate outbox operations.
- [ ] Ready imports create typed raster/document layers; ordinary PDF creates `needs-calibration`, never guessed bounds. Outbox metadata and blob dependencies preserve upload/push ordering.
- [ ] Focused import tests green; integration reviewer verifies atomicity and retry durability.

## P3 — manual calibration

**Create:** `packages/geo/src/pdf/calibration.ts`, `tests/pdf/calibration.test.ts`; `apps/admin/src/components/pdf/{CalibrationDialog,ControlPointEditor}.tsx` plus focused component tests.

```ts
fitCalibration(points: readonly ControlPoint[], sourceCrs: string): CalibrationResult;
validateCalibration(result: CalibrationResult): CalibrationDecision;
```

- [ ] Start failing tests for fewer than three points, duplicate/collinear points, singular/ill-conditioned solve, missing CRS and nonfinite ground coordinates.
- [ ] Fit affine transform in explicit source units and report geographic residuals. Three points can interpolate exactly: show `independentCheck=false` and no measured independent accuracy. Four or more enable residual/withheld-point checks.
- [ ] UI pairs page/map clicks, edits/removes points, requires explicit CRS and confirmation, displays residual/uncertainty and retains original controls for later correction.
- [ ] Test coordinate zoom/rotation invariance, cancel/reload retention and bad-fit confirmation guard. Never silently turn an ordinary PDF into an automatic GeoPDF.

## P4 — document overlay, PDF viewer and position reference

**Create:** `packages/maps/src/pdf/{overlay,raster-protocol,tile-cache}.ts`, tests under `packages/maps/tests/pdf/`; `apps/admin/src/components/pdf/{DocumentViewer,DocumentControls,PositionMarker}.tsx`. **Modify:** maps exports by the maps owner; root, as sole frontend integrator, modifies the existing workspace page.

```ts
attachPdfOverlay(map: MapAdapter, source: PdfOverlaySource): PdfOverlayHandle;
// handle.setOpacity(number), setVisible(boolean), selectPage(number), fit(), dispose()
buildReprojectedTile(source: PdfRasterSource, tile: TileId, signal: AbortSignal): Promise<Blob>;
```

- [ ] Add failing tests that four-corner overlays are accepted only when sampled transform error meets the declared bound. Projected pages that fail go through inverse sampling in EPSG:3857 tiles, not stretched corners.
- [ ] Implement bounded, cancellable raster tiles with neatline masking, 512×512 tile cap, cache budgets (64 MiB/import, 250 MiB total), cache keys including source/hash/page/transform/version and cleanup. Validate at multiple interior points, not just corners. Never retain a page-sized bitmap.
- [ ] Add page/inset selection, opacity/visibility, extent fit and original-document opening; restore these after offline reload.
- [ ] Use `pageToLonLat`/`lonLatToPage` for map selection and GPS marker in PDF viewer. Outside page/neatline yields no page marker; accuracy ring reflects reported sensor accuracy. Original bytes remain unchanged.
- [ ] Test zoom/rotation and page changes, stale tile disposal, offline re-render, map+page GPS consistency and popup/text safety. Independent reviewer inspects reprojection resource limits.
- [ ] Profile pan/pinch and long-task behavior at a real mobile viewport and physical device when available, with representative PDF dimensions and feature/list counts. Run a 5-minute interaction and 20 open/close/render/cancel cycles; record browser/device/OS/DPR/GPU, memory before/after and its measurement limits. Any PDF-caused long task ≥50 ms during pan/pinch, retained whole-page bitmap, or worker/canvas/bitmap leak fails the gate. If physical-device or memory measurement is unavailable, report PENDING; do not claim responsiveness or stable memory from unit tests alone.

## P5 — end-to-end gate and upload integration

**Create:** PDF-specific Playwright fixtures/tests listed in master Q5. **Modify:** import UI only through frontend integration owner; use scoped blob APIs from local-sync plan.

- [ ] Import/position ISO and OGC fixtures with network off, reload, inspect original document and map placement against expected reference points.
- [ ] Ordinary PDF calibration required; corrupt/encrypted/unknown CRS/ambiguous inset cases fail safely with local recovery.
- [ ] Reconnect and resume bounded blob transfer; simulate lost finalize response, retry without duplicate objects/imports and deny other-workspace blob access. Real DB/object adapter evidence required.
- [ ] Record supported profile table, fixture provenance, accuracy/resource results and independent review. Never mark untested field/device/CRS cases supported.

## Risk-input self-review

| Input | Owning evidence |
| --- | --- |
| Corrupt/encrypted/huge document | P0/P1 worker deadline/limits fixtures |
| Axis/CRS/inherited boxes/insets | P0 independent reference; P1 transforms |
| Singular/poor calibration | P3 fit/rejection/component tests |
| Projected page/nonlinear display | P4 interior raster accuracy tests |
| Quota/interrupted upload/reload | P2 atomic import; P5 real reconnect E2E |
