# GeoNexo third-party notices

This file records the PDF/GIS runtime dependencies used by the local GeoPDF
path. Versions are pinned in the owning package manifests and lockfile.

## pdf-lib 1.17.1

MIT License. Copyright (c) 2019 Andrew Dillon.

Upstream: <https://github.com/Hopding/pdf-lib>

The complete license text is distributed by the `pdf-lib` package in
`LICENSE.md`.

## proj4 2.22.0

MIT License. Copyright (c) the proj4js contributors.

Upstream: <https://github.com/proj4js/proj4js>

The complete license text is distributed by the `proj4` package in its
license file.

## PDF.js / pdfjs-dist 6.3.289

Apache License 2.0. Copyright Mozilla contributors.

Upstream: <https://github.com/mozilla/pdf.js>

The complete license and bundled notices are distributed by the `pdfjs-dist`
package. GeoNexo uses the package's local worker; it does not fetch a worker
or document over the network.

## PMTiles 4.5.0

BSD 3-Clause License. Copyright 2021 Protomaps LLC.

Upstream package: <https://github.com/protomaps/PMTiles/tree/main/js>
License: <https://github.com/protomaps/PMTiles/blob/main/LICENSE>
Registry integrity: `sha512-CBeD4SoUluFziGdy/8k7FOjQxQy486n+929W/tWophauvMICpkZ26vGBWhDt/6b1FZQWNaf4jFdT/5+q0Wii5w==`

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.

## TacMap algorithm reference

The bounded affine and GeoPDF algorithm concepts reviewed for this feature
come from TacMap under its MIT license, copyright Christian Brooker (2026):
<https://github.com/JediBrooker/TacMap>

GeoNexo may port only the reviewed, bounded algorithm portions with independent
tests. It must retain this attribution and must not copy the native application,
PDFKit/Android renderer, storage, or unrelated source tree.

The inspected local license source is:

- Path: `REPOSITORIOS MODELOS/TacMap-main/TacMap-main/LICENSE`
- SHA-256: `0F8AC4F0B88C8025AD9D10300D6347B7EDC44D1DBF4463D7D2E38B493C3CD4B8`
- Commit/tag: `commit unavailable` (the supplied model tree has no `.git` metadata)

Complete license text from that local source:

MIT License

Copyright (c) 2026 Christian Brooker

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Third-party notices

This repository vendors the NGA `mgrs-ios` library under `ios/Vendor/mgrs-ios`,
with a small patch to the UTM Snyder series for Xcode 26 compatibility. The
NGA library is also under the MIT License. See
`ios/Vendor/mgrs-ios/LICENSE` for the full text and copyright notice.


---

## Maps Engine v2 offline — data sources and code origin

This section covers the offline maps initiative on branch
`feat/maps-engine-v2-offline`. It records data provenance and the origin of
inspired (not copied) code.

### OpenStreetMap

Regional extracts used to build vector tiles, the routing graph and the search
index are derived from OpenStreetMap data.

- License: Open Database License (ODbL) 1.0
- Upstream: <https://www.openstreetmap.org/copyright>
- Required attribution: `(c) OpenStreetMap contributors`
- The attribution is emitted per region in the package manifest
  (`sources.attributions`, `attribution`) and surfaced in the region manager UI.

### Digital Elevation Model (DEM)

Elevation sampling, elevation profiles and contour generation use whichever DEM
is bundled for a region. The DEM source, resolution, vertical datum and license
are recorded in `demMetadataSchema` (`packages/contracts/src/elevation.ts`).

- Supported sources declared by the schema: SRTM, Copernicus DEM, ALOS DEM
- Each source keeps its own upstream license and attribution; the pipeline must
  populate `license` and `attribution` before a region is published.
- No DEM is redistributed by this repository; it is packaged per region at
  build time by `scripts/region-pipeline.mjs`.

### Wikipedia / Wikidata extracts

Offline place sheets may bundle short article extracts.

- License: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)
- Upstream: <https://en.wikipedia.org/Wikipedia:Copyrights>
- Only permitted short extracts are bundled, never full articles.
- Per-article `attribution` and `language` are carried in
  `wikipediaArticleSchema` and rendered with the place sheet.
- Extract HTML is sanitized at runtime (`sanitizeWikipediaHtml`) before render.

### Transit data

Station/line overlays are packaged per region from open transit feeds.

- License depends on the feed used for the region (typically public domain or
  CC BY 3.0 for GTFS feeds); the feed license is recorded in the network's
  `attribution`.
- No transit feed is vendored in this repository.

### Inspired code — concepts only, no code copied

The following projects were reviewed for **concepts only**. No source file was
copied. Anything reimplemented was rewritten from scratch under this
repository's license and covered by independent tests.

| Project | License | What was taken | Where documented |
| --- | --- | --- | --- |
| `openstreetmap-website` | GPL-2.0 | concepts only | `docs/MM-MAP-010-proveniencia-licencas.md` |
| Organic Maps | GPL-3.0 | concepts only; no `.mwm`/`.bin` data files redistributed | `docs/MM-MAP-010-proveniencia-licencas.md`, `docs/MM-MAP-600..640` |
| Organic Maps generator (`srtm_parser`, `isolines_generator`, `descriptions_section_builder`, `wiki_url_dumper`) | GPL-3.0 | pipeline stage concepts | `docs/MM-MAP-500`, `docs/MM-MAP-700` |
| Organic Maps routing libs (`libs/routing/`, `turns_tts_text.cpp`) | GPL-3.0 | maneuver/TTS concepts | `docs/MM-MAP-600..640` |
| Organic Maps transit (`libs/transit/`) | GPL-3.0 | station/line model concepts | `docs/MM-MAP-710` |

Hard rules enforced for this initiative:

- **No GPL-2.0/GPL-3.0 code from `openstreetmap-website` or Organic Maps is
  incorporated** into this repository.
- **No Organic Maps data files (`.mwm`, `.bin`) are redistributed.**
- Each `docs/MM-MAP-*.md` deliverable names its inspiration in a
  "Fontes de Inspiracao (conceitos, nao codigo copiado)" section.
