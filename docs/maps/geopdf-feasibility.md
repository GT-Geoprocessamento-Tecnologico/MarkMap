# GEO-G0.3 — GeoPDF P0 feasibility gate

Status: **PASS — feasibility only. Production GeoPDF import remains PENDING.**

## Evidence

- Task: `GEO-G0.3-PDF-FEASIBILITY-01`.
- Generated fixtures prove offline byte parsing of minimal PDFs containing
  `/VP`, `/Measure`, `/Subtype /GEO`, `/GPTS`, `/LPTS`, `/GCS`, `/LGIDict`,
  `CropBox`, page rotation, and an inset. Separate generated variants exercise
  the VP/Measure profile and the OGC LGIDict profile. Four known page/ground
  points are compared in both directions with exact values in
  `packages/geo/tests/pdf/geopdf-feasibility.test.ts`.
- The adapter is intentionally experimental and unexported:
  `packages/geo/src/pdf/experimental/geopdf-spike.ts`.
- The user supplied a real project PDF for local testing; its hash, metadata
  mismatch and safe rejection are recorded below. The original was not copied
  into fixtures or committed.
- Product rasterization: `PENDING` in the repository because no PDF.js
  dependency or GeoNexo worker was added. A disposable external Chromium worker
  probe is recorded below.

## Disposable PDF.js render probe (2026-09-30)

The official `pdfjs-dist@6.3.289` tarball was fetched with `npm pack` into a
unique OS temporary directory only (`C:\Users\MATEUS\AppData\Local\Temp\geonexo-pdfjs-1afa112c56cf4b5fa8e70424785625de`); it was not installed in the workspace. `npm view` reported `Apache-2.0` and the Mozilla PDF.js repository. `@napi-rs/canvas@0.1.97` was installed in that same disposable directory to supply a real Node canvas.

With the generated fixture and PDF.js package loaded from local files, the
render probe ran with `disableWorker: true`, `isEvalSupported: false`, and
`useSystemFonts: false`. PDF.js opened one page and rendered a PNG canvas of
**100 x 200 pixels**, 3,379 bytes; the first pixel was
`[255,255,255,255]`. This proves local rasterization of the generated PDF, not
all producer PDFs or browser worker operation.

Cancellation called `loadingTask.destroy()` immediately after `getDocument`; the
pending promise rejected with `Error: Loading aborted` in 22 ms. This original
probe used the Node worker disabled. A later disposable Chromium worker probe
with local PDF.js assets is recorded below. Product-level byte/page/resource
limits remain unproved. No network request was used for parsing or rendering
after the tarball fetch.

## Project-supplied Araguaína GeoPDF (2026-09-30)

The user supplied this file in the workspace specifically for local testing:

- File: `geopdf de araguaina.pdf` at the workspace root.
- Size: `16,634,115` bytes; SHA-256:
  `B83914BE45385B71ED9667D4381991952B60DCC8C3504294E969CDA3723CA1E1`.
- Authorization: local diagnostic/render testing only. The original remains in
  place and has not been copied into fixtures or staged.
- Structure: one page; MediaBox/CropBox `[0, 0, 1684, 1191]`; rotation `0`;
  one ISO-style `/VP` viewport named `Layer`; `/Measure /Subtype /GEO`; no
  `/LGIDict`.
- `/GCS` declares `/Type /PROJCS`, `/EPSG 3857`, and WKT
  `WGS_1984_Web_Mercator_Auxiliary_Sphere`.
- Raw `/GPTS` pairs:

  ```text
  [-7.194196547645677, -48.23059105264499]
  [-7.194196547645677, -48.20836969095553]
  [-7.209601895273406, -48.23059105264499]
  [-7.209601895273406, -48.20836969095553]
  ```

  For a declared projected CRS, ISO 32000-2 requires `/GPTS` values to be
  easting/northing in the projected coordinate space. These values cannot be
  relabelled as latitude/longitude based on their apparent magnitude or the
  filename. Under the declared projected axis order, the raw first-coordinate
  range is `[-7.209602, -7.194197]` and the second-coordinate range is
  `[-48.230591, -48.208370]`; these do not establish Araguaína geographic
  bounds. The CRS/GPTS combination is therefore unsupported/inconsistent, and
  no geographic bounds or georeferencing residual is asserted. See
  [ISO 32000-2 clause 12.10.2 errata](https://pdf-issues.pdfa.org/32000-2-2020/clause12.html)
  and the [Adobe-hosted ISO 32000-2 FDIS](https://developer.adobe.com/document-services/docs/assets/5b15559b96303194340b99820d3a70fa/PDF_ISO_32000-2.pdf).
- The experimental adapter rejected it with `Unsupported CRS`, which is the
  required fail-closed outcome. No automatic placement was produced.
- The Chromium/PDF.js worker harness opened and rendered its first page from
local bytes at `1684 x 1191` (`2,005,644` pixels). The latest local run measured
  `103.3 ms` to PDF.js document-open and `191.4 ms` to render; timings are
  machine/run-specific. It observed `externalRequests: []`, `pageErrors: []`,
  `workerStarts: 10`, `liveWorkers: 0` after teardown.
- Peak memory was not measured. Chromium exposed no usable main-frame heap
  delta. Raw PDF bytes plus a four-byte RGBA canvas account for about `23.5 MiB`
  of payload/backing storage if both are retained concurrently; this excludes
  parser copies, decoded images, worker heaps and GPU/native buffers, so it is
  not a peak-memory estimate.
- This is a negative real-producer metadata case and a positive renderability
  case. It does not pass the accuracy check. A corrected source export or
  explicit manual control points/CRS are required before positioning it.

## External reference sample probe (USGS TNM, 2026-09-30)

This is an external lawful reference sample only. At the time it was tested,
the user had not yet supplied the Araguaína project PDF recorded above.

- Source PDF: [USGS TNM Frederick 1893 GeoPDF](https://prd-tnm.s3.amazonaws.com/StagedProducts/Maps/HistoricalTopo/PDF/MD/125000/MD_Frederick_257724_1893_125000_geo.pdf).
- Catalog source: [USGS ScienceBase item](https://www.sciencebase.gov/catalog/item/5a8a2e25e4b00f54eb3cec60). Its HTML page was Cloudflare-blocked, but the matching product and independent bounds were retrieved from the official TNM Access API below.
- Download was one bounded file to a unique OS temp directory; response `200`,
  `Content-Type: application/pdf`, `Content-Length: 7,883,543`, ETag
  `20c3bc73c70e86d8935f8a2e5759c034`, Last-Modified `2024-09-26`.
- SHA-256: `340857CC1D73E284D8CA1B5A948EEEC52EBD458AB54C2292B628FB3E20BECF33`.
- PDF.js `6.3.289` local metadata: PDF 1.6, one page, title `USGS 1:125000-scale Quadrangle for Frederick, MD 1893`, author `U.S. Geological Survey`, creator `Map2PDF for Raster 5.0.0`, producer `TerraGo Technologies, Inc.`.
- Byte scan found `/LGIDict` (four occurrences), `/CropBox`, `/MediaBox`, and
  `/Rotate`; no literal `/VP`, `/Measure`, `/GPTS`, `/LPTS`, or `/GCS` tokens.
- PDF.js local render with network unavailable after download succeeded at
  scale `0.1`: **115 x 143 pixels**, PNG **37,341 bytes**, first pixel
  `[254,249,213,255]`. A standard-font warning was emitted but rendering
  completed.
- The experimental adapter rejected the sample with `Missing /LPTS`. This is
  expected for its deliberately narrow generated-fixture contract and proves
  that the adapter must not guess placement from LGIDict data it does not
  understand.

## Independent TNM Access metadata (same sample)

The official TNM Access API returned an exact identifier match using:

`https://tnmaccess.nationalmap.gov/api/v1/products?datasets=Historical%20Topographic%20Maps&q=Frederick&max=100&outputFormat=JSON`

The matching record has `sourceId` `5a8a2e25e4b00f54eb3cec60`, the same
ScienceBase identifier and download URL, title `USGS 1:125000-scale Quadrangle
for Frederick, MD 1893`, format `GeoPDF, GeoTIFF`, and:

```text
boundingBox: minX=-77.5, maxX=-77.0, minY=39.0, maxY=39.5
extent: 30 x 30 minute
sizeInBytes: 7866186
publicationDate: 1893-01-01
lastUpdated: 2025-09-18T08:50:16.259-03:00
vendorMetaURL: https://thor-f5.er.usgs.gov/ngtoc/metadata/waf/maps/historicaltopo/pdf/MD/125000/MD_Frederick_257724_1893_125000_geo.xml
```

The API metadata is an authoritative independent extent and exact-product
identity. It cannot yet be compared numerically against the PDF's LGIDict
transform because the experimental adapter does not parse `/LGIDict` `CTM`,
projection/display parameters, and registration pairs. The API's advertised
`sizeInBytes` (7,866,186) also differs from the object downloaded from S3
(7,883,543 bytes), so size alone is not a valid integrity assertion; the
download hash and ETag remain the recorded byte evidence.

The OGC 08-139r3 profile reference is retained above. The sample's observed
`/LGIDict` structure demonstrates the missing implementation surface: nested
`/CTM`, `/Display` projection fields, and `/LGIT:Info` registration data rather
than the ISO `/VP` `/Measure` `/GPTS` `/LPTS` arrays. No production parser was
expanded during this read-only check.

This sample improves rasterization evidence and confirms a real OGC-style
LGIDict producer variant, but it does not prove the current adapter's LGIDict
mapping or a numerical match to independent TNM bounds. Browser worker
cancellation is covered by the later disposable Chromium probe; product-level
resource limits are still unproved. The P0 gate remains `FAIL/PENDING` pending
the independent gate review and unresolved candidate-integration evidence.

## GDAL upstream ISO/OGC fixtures and Chromium worker probe (2026-09-30)

Three small fixtures from the official GDAL autotest data directory were
downloaded to a unique OS temp directory only; none was copied into the
workspace. GDAL's autotest README says the team makes every effort for sample
and test data to be public and freely redistributable. The fixtures were used
as test inputs only, with upstream attribution retained here:

| Fixture | Bytes | SHA-256 | Observed profile |
| --- | ---: | --- | --- |
| `test_iso32000.pdf` | 1,625 | `C57B35F6820DCB7D08AE273ED39E935F91AF1C9594F99BFB3B3DA05ED0197DA1` | ISO `/VP` + `/Measure`, `/GPTS`, `/LPTS`, `/GCS` |
| `test_ogc_bp.pdf` | 1,367 | `EC2A34F853A4D5BF86CCF6A7170439B5C89E9A6A674DB965BA7D762CBEA3A93B` | OGC `/LGIDict`, `/CTM`, `/Projection`, `/Neatline` |
| `adobe_style_geospatial.pdf` | 57,553 | `8492C975C7DD68977566D95B0C1F0DB2A24D464BF2105612E20799B04485766B` | ISO viewports, projected CRS, two named viewports |

Sources: [GDAL autotest README](https://github.com/OSGeo/gdal/blob/master/autotest/README.md), [GDAL PDF tests and published expected values](https://github.com/OSGeo/gdal/blob/master/autotest/gdrivers/pdf.py), and [upstream Adobe-style PDF fixture](https://raw.githubusercontent.com/OSGeo/gdal/master/autotest/gdrivers/data/pdf/adobe_style_geospatial.pdf).
The fixtures were structurally inspected with a disposable `pdf-lib@1.17.1`
(`MIT`) install and rendered with `pdfjs-dist@6.3.289` (`Apache-2.0`); neither
dependency was added to a workspace manifest or lockfile. The Adobe sample has
`MediaBox` and `CropBox` `[0,0,612,792]`, `/Rotate 0`, and two `/VP` entries.
Its larger viewport has `/BBox [57,713,561,297]`, UTM zone 20N WKT, four GPTS
controls and four LPTS controls. The small OGC fixture parses as one page and
exposes `/CTM [0.05,0,0,0.05,2,48]`, WGS84 geographic projection and a four
corner neatline. This is structural parser feasibility evidence; the
experimental workspace adapter still does not resolve these real dictionaries.

### Independent projected-control check

The compliant projected fixture is generated locally with `/GCS /PROJCS`
`EPSG:32620` and `/GPTS` easting/northing values in metres. Its four controls
are encoded to **three decimal places** (1 mm numeric resolution; at most
0.0005 m rounding per axis). An independent
[`pyproj 3.8.0`](https://pypi.org/project/pyproj/3.8.0/) / `PROJ 9.8.1`
reference transforms those same controls to WGS84. The GeoNexo candidate is
compared against the four reference coordinates using a haversine distance;
observed errors are **0.0000000011 m, 0.0000000008 m, 0.0000000008 m, and
0.00153 m** (maximum **0.00153 m**, below the P0 1 m bound). The reference
coordinates are pinned in
`packages/geo/tests/pdf/geopdf-feasibility.test.ts`; the temporary pyproj
install stayed under the OS temp directory and was not added to the workspace.
This result covers the synthetic 100 m × 100 m fixture only. The candidate
currently converts projected controls to WGS84 before fitting its affine
transform; larger extents and other projected CRSs need separate proof. A
production implementation should fit in the declared projected units and
inverse-project queried points.

Image sampling error is recorded separately as an analytic expectation. At
200 DPI, the fixture's 200 pt
by 100 pt map viewport spans 100 m in each projected axis, giving expected
pixel vectors of **0.18 m/pixel** and **0.36 m/pixel**. The maximum center to
corner half-pixel displacement is therefore
`0.5 × sqrt(0.18² + 0.36²) = 0.20125 m`. This sampling bound is not added to the
coordinate-control residual and does not measure source survey accuracy.

The earlier Adobe fixture comparison is **superseded and excluded from the
accuracy gate**. Its `Layers` viewport declares `/GCS /PROJCS` UTM 20N, while
its `/GPTS` values are `44.20536, -65.02379, ...`, which resemble degrees.
The earlier probe reinterpreted those values as WGS84 before projecting and
reported a maximum residual of 0.496 m against GDAL. That contradicts the
declared projected coordinate space, so it is not valid evidence of a
conforming projected profile. Treat it as a legacy/inconsistent producer
sample and fail closed; do not infer degrees from numeric magnitude.

### Browser worker, safety and render budget

A disposable loopback-only Chromium probe loaded PDF.js and its worker from
local files. The page used a restrictive CSP without `unsafe-eval`, disabled
PDF.js eval support, and Playwright aborted requests to every non-loopback
origin. PDF bytes were local. Results:

- ISO, OGC and Adobe samples opened and rendered with **0 external requests**.
- The Adobe fixture rendered at 200 DPI to **1,700 x 2,200** (3.74 MP) in
  0.233 s. A near-cap render of **3,513 x 4,546** (15,970,098 pixels) completed
  in 0.583 s in this Chromium run; this is a local desktop measurement, not a
  mobile-device performance claim.
- `PDFDocumentLoadingTask.destroy()` aborted an in-flight load in 0.101 s. A
  canceled near-cap render rejected with `RenderingCancelledException` in
  0.031 s. Playwright observed 9 worker starts over the run and 0 live workers
  after all tasks were destroyed.
- An eight-byte corrupt input rejected as `InvalidPDFException`; a locally
  generated password-protected PDF rejected as `PasswordException` with
  `No password given`.
- A locally generated PDF with a document JavaScript action and an external URI
  annotation rendered with the execution sentinel still false; the URI was
  read as annotation metadata and produced no request. This checks PDF.js parse
  and render behavior, not a separate viewer scripting feature.
- The disposable harness rejects a stable project input over 25 MiB using
  `stat` before reading it, rechecks the byte length after the read, and
  rejects a 25 MP viewport before creating or sizing a canvas. Generated
  probes observed all three outcomes. A concurrent file-growth race between
  `stat` and `readFileSync` is not eliminated. A 101-page probe is rejected
  after `loading.promise` resolves, so the page-count check does not bound
  PDF.js parse work. No 30-second deadline or memory cap is implemented. These
  are harness-only checks; product worker/client limits still need to be
  implemented and independently verified.

The browser probe script and generated hostile fixtures also remain under the
same OS temp directory. Its local server was closed at the end of each run.
The workspace candidate now uses `pdf-lib@1.17.1` for dictionary/page-tree
traversal and persists the bounded generated-profile tests. It still does not
claim support for the real Frederick `/LGIDict` sample or every GDAL Adobe
variant: unsupported/missing semantics remain fail-closed. Product-level
budgets, adversarial memory behavior and product integration remain open. The
independent feasibility review accepted G0.3 as **PASS for the bounded P0
contract only**; this is not product or release approval.

The disposable candidate extraction script `probe-candidate-parser.cjs` is
historical evidence only. It reads the Adobe fixture dictionaries and applies
the OGC sample's `/CTM` to `/Neatline`, yielding
`[(2,49),(2,48),(3,48),(3,49)]`. Its Adobe degree reinterpretation and
sub-metre GDAL comparison are excluded from the accuracy gate, as described
above. It remains a temporary experiment, not a supported/exported GeoNexo
parser or a viewport-selection policy.

The same disposable proof generated a two-page PDF with page-tree inherited
`CropBox [10,20,210,120]` and `/Rotate 90`, plus indirect viewport/Measure
references. pdf-lib recovered both pages, the inherited box and rotation, and
the indirect viewports. A second page with two equal-area viewports triggered
an experiment-only ambiguity rule; the script confirmed that the named `Map B`
entry exists and the persisted candidate API executes the caller-provided
`viewportName` selection while rejecting the unqualified ambiguous page. This
checks candidate structural behavior; it does not prove an end-to-end rotated
page overlay or a production viewport-selection policy.

## Candidate profile contract and axis order

The P0 candidate was evaluated against this deliberately bounded contract;
passing feasibility is not a claim that the product currently supports these profiles. The
normative references are [ISO 32000-1](https://developer.adobe.com/document-services/docs/assets/35e4369068f86065372c18787171a17e/PDF_ISO_32000-1.pdf),
[OGC 08-139r3](https://docs.ogc.org/bp/08-139r3/08-139r3.pdf), and the
[GDAL PDF driver](https://gdal.org/en/stable/drivers/raster/pdf.html).

| Candidate subset | Source coordinates and order | Page-to-map rule | P0 selection/support rule |
| --- | --- | --- | --- |
| ISO `/VP` + `/Measure /Subtype /GEO`, geographic WGS84 | `/GPTS` pairs are `[latitude, longitude]`; normalize to GeoNexo `[longitude, latitude]`. `/LPTS` pairs correspond positionally and lie in the unit square. | Map each `/LPTS` pair into its selected viewport `/BBox` in PDF default user space. Resolve the effective inherited page boxes and rotation separately; the renderer's PDF.js viewport maps PDF page coordinates to raster pixels. | Require exactly one selected viewport or a caller-provided viewport name; reject unsupported/missing CRS and nonlinear/degenerate control geometry. |
| ISO `/VP` + `/Measure /Subtype /GEO`, verified projected UTM 20N | `/GPTS` pairs are `[easting, northing]` in the declared projected CRS; the tested WKT maps explicitly to EPSG:32620. Convert to WGS84 only through the declared proj4 definition. | Same positional `/LPTS` to `/BBox` mapping; no CRS inferred from title or file name. | Same explicit viewport rule; unsupported projected WKT is rejected. |
| OGC basic `/LGIDict` subset with `/CTM`, `/Projection /WGE /GEOGRAPHIC`, `/Neatline` | PDF matrix `[a,b,c,d,e,f]` maps `x'=a*x+c*y+e`, `y'=b*x+d*y+f`; for this geographic sample, x is longitude and y is latitude. | Apply `/CTM` to PDF default user-space page points; `/Neatline` delimits the map frame. Render pixels use the effective PDF.js page viewport. | Accept one supported map frame. Reject unsupported projection variants, multiple unresolved frames, `/Display` and `/LGIT:Info` variants not explicitly implemented. |

ISO geographic `GPTS` and OGC geographic `CTM` therefore have different axis
orders at their metadata boundaries. They must remain separate profile
adapters. The P0 generated tests and candidate API must exercise the conversion
and selection rules above before this contract can be considered feasible.

## Lawful dependencies and primary sources

The PRD names PDF.js and pdf-lib. PDF.js is Apache-2.0 according to its
[official project page](https://mozilla.github.io/pdf.js/); pdf-lib's upstream
project documents its JavaScript PDF manipulation API and MIT license in its
[official repository](https://github.com/Hopding/pdf-lib). The GeoPDF model is
grounded in ISO 32000-1 and OGC 08-139r3: [ISO standard record](https://www.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/05/15/51502.html?browse=tc),
[OGC profile](https://portal.ogc.org/files/?artifact_id=40537). The test-only
`pdf-lib@1.17.1` addition is pinned and MIT-licensed; product exports remain
untouched.

## Selective model-repository reuse audit (2026-09-30)

The directory `REPOSITORIOS MODELOS` contains local reference trees, but the
selected source trees have no `.git` metadata, so no origin, tag or commit SHA
can be attributed. Reuse is limited to material with verifiable local license
evidence and a clear fit with GeoNexo's TypeScript/browser boundary.

| Source | Classification | Reusable unit | Constraint |
| --- | --- | --- | --- |
| `TacMap-main/TacMap-main` | `PORT` / `ADAPT` | `GeoPdfParser.kt` profile/registration checks and `AffineTransform2D.swift` least-squares calibration concepts; local `LICENSE` is MIT, copyright Christian Brooker (2026). | Port only bounded algorithms needed by the approved GeoNexo contract, add MIT attribution/notices, and test independently. Do not copy the Android/iOS/PDFKit application or platform renderer. |
| `pdf-lib-master/pdf-lib-master` | `DEPENDENCY` | PDF object/page-tree traversal API; MIT license. | GeoNexo already pins `pdf-lib@1.17.1` for the isolated experiment; do not vendor library source. It remains a dev dependency until product integration is separately approved. |
| `pdf.js-master/pdf.js-master` | `DEPENDENCY` | PDF.js parser/renderer and worker; Apache-2.0. | Use the official package and worker with explicit limits; do not copy/vend the source tree. Current proof uses a disposable `pdfjs-dist@6.3.289` package only. |
| `proj4` in GeoNexo | `DEPENDENCY` | Existing CRS conversion library; MIT. | Reuse the existing runtime dependency behind a reviewed CRS registry; never infer a definition from a filename or coordinate magnitude. |
| `kerilla-map-main/kerilla-map-main` | `REFERENCE_ONLY` | A text-scanning GeoPDF POC. | No LICENSE/COPYING/NOTICE was found, and its regex parser has no resource, CRS or axis-order validation. Do not copy or adapt without verified permission. |
| GeoLibre, MapLibre GL JS, FlatGeobuf, GeoPackage JS | `REFERENCE_ONLY` | Map or data-format APIs. | No relevant GeoPDF parser unit; GeoNexo already owns MapLibre integration. Avoid unrelated dependency/source expansion. |

No TacMap/kerilla code has been copied into GeoNexo in this feasibility task.
TacMap's MIT algorithms are the strongest source for a future controlled
port of manual least-squares calibration and legacy registration handling,
after the G0.3 decision and a separate P1 implementation task. Any port must
retain the copyright/license notice and add independent fixtures. `TacMap`
also has an MIT notice for its vendored `mgrs-ios` dependency; that dependency
is not used by the proposed GeoNexo port.

## Commands and environment

Run from `D:\MATEUS\Documentos\GitHub\GeoNexo`:

```text
pnpm --filter @geonexo/geo exec vitest run tests/pdf/geopdf-feasibility.test.ts
pnpm --filter @geonexo/geo typecheck
pnpm --filter @geonexo/geo lint
node apps/admin/e2e/geopdf-worker-harness.cjs <gdal-fixture-dir> <pdfjs-package-dir> <candidate-deps-dir> [project-pdf-path]
```

These are the required repository and browser verification commands for this
spike. The browser harness must report zero external requests, worker starts
greater than zero, and zero live workers after teardown.
The generated-fixture tests need no network. The disposable PDF.js and USGS
probe required network only for the explicitly listed tarball and one candidate
PDF; parsing/rendering then used local bytes. No workspace package was
installed. `pdftoppm` and `gdalinfo` were checked and are missing.

## Gate decision and blockers

The generated fixtures pass the candidate profile, affine accuracy and browser
worker safety checks; the object-stream test exercises compressed structural
traversal. The supplied Araguaína PDF adds a real producer rejection case and
proves offline browser rendering, but its `/GCS` and `/GPTS` semantics do not
support automatic placement. Independent plan, implementation and security
reviews accept G0.3 as **PASS for feasibility only**. Product worker
integration and hard enforcement of byte/page/pixel/deadline/memory limits
remain P1 work and are not claimed as feasibility results.

Future PDF.js/pdf-lib product integration still requires independent review of
worker isolation, cancellation, page/byte/memory/deadline limits, encrypted
PDFs, and network isolation.
