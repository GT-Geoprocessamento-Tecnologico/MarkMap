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
