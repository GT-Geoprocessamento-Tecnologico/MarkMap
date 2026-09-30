# Offline package structural fixture

`manifest.json` is a small structural fixture for validation tests. It is not
a distributable package: `package.pmtiles` and the regional fonts/sprites are
intentionally absent from this directory.

The archive SHA-256 records the temporary W0 regional extract. Glyph and sprite
SHA-256 values are placeholders used only to satisfy the canonical contract;
they are not hashes of committed asset bytes and must be replaced during a
real W2 package build before activation.
