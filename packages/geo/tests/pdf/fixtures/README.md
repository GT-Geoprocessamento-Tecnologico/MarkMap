# GeoPDF feasibility fixtures

These fixtures are generated in memory by `geopdf-feasibility.test.ts`; no
third-party or project PDF is copied into the repository. The generated PDF is
minimal PDF 1.7 syntax containing four `/LPTS` page points, four `/GPTS`
latitude/longitude pairs, `/VP` + `/Measure` + `/GCS`, and `/LGIDict`.

The fixture intentionally includes a rotated page, a `CropBox`, and an inset
between the page and the geospatial points. It is lawful test data authored for
this spike and is not evidence that every producer's PDF encoding is supported.

On 2026-09-30 the user supplied `geopdf de araguaina.pdf` at the workspace
root for local testing. Its SHA-256, GeoPDF dictionary metadata, fail-closed
CRS result and PDF.js render evidence are recorded in
`docs/maps/geopdf-feasibility.md`. The original file remains in place and is
not copied into test fixtures or committed.

## Candidate worker harness

The repeatable browser safety probe is checked in at
`apps/admin/e2e/geopdf-worker-harness.cjs`. It intentionally takes candidate
packages and upstream fixtures from disposable directories so no PDF or parser
dependency is copied into the product checkout:

```text
node apps/admin/e2e/geopdf-worker-harness.cjs <gdal-fixture-dir> <pdfjs-package-dir> <candidate-deps-dir> [project-pdf-path]
```

The recorded run used `pdfjs-dist@6.3.289` (Apache-2.0), `pdf-lib@1.17.1`
(MIT), and `pdfkit@0.20.2` (MIT) in an OS temporary directory. The GDAL
fixtures were fetched from the official GDAL autotest data directory and are
identified by SHA-256 in `docs/maps/geopdf-feasibility.md`:

```text
test_iso32000.pdf            C57B35F6820DCB7D08AE273ED39E935F91AF1C9594F99BFB3B3DA05ED0197DA1
test_ogc_bp.pdf              EC2A34F853A4D5BF86CCF6A7170439B5C89E9A6A674DB965BA7D762CBEA3A93B
adobe_style_geospatial.pdf   8492C975C7DD68977566D95B0C1F0DB2A24D464BF2105612E20799B04485766B
```

The harness requires a real PDF.js worker, blocks every request whose origin
is not its exact loopback server, and checks render, near-cap pixel count,
loading/render cancellation, worker teardown, corrupt/password errors, and
PDF JavaScript/URI behavior. When `project-pdf-path` is supplied, the harness
reads that file without copying it into the fixture directory, serves it from
the same loopback origin, renders its first page and reports open/render time
plus the main-frame JavaScript heap delta when Chromium exposes that metric.
These checks are candidate feasibility evidence; they do not make the
experimental adapter a production import path or measure total worker/GPU
memory.
