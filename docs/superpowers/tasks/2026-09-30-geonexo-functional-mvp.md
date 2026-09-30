# GeoNexo functional local MVP

**Task ID:** GEO-FUNCTIONAL-MVP-2026-09-30  
**Status:** active; user explicitly reprioritized toward a working app now and later improvements  
**Objective:** make the current app usable as a local mapping workspace, keeping unfinished remote sync, hardware acceptance, and advanced georeferencing as later work.

## MVP acceptance

1. The admin app builds, starts on a verified loopback URL, and its main routes render without runtime errors.
2. A user can import local GeoJSON and see it on the map; the dataset remains after reload and is usable offline.
3. Creating and viewing a project works locally without requiring the remote Neon database. The operation remains in the local outbox for future sync; the UI does not claim it reached a server.
4. A licensed offline map package can be installed, selected, and rendered with local tiles, glyphs, sprites, and attribution after reload with external requests blocked.
5. A PDF can be saved and reopened locally and its page renders with the bundled worker. For Araguaína, show the page and explain the contradictory `/GCS EPSG:3857` and `/GPTS`; never position it automatically.
6. Focused fresh verification and a Chromium smoke cover the workflows above. Preserve the user's PDF and all pre-existing dirty changes.

## Deferred by the user's priority change

- Remote Neon provisioning, migration, writes, and end-to-end synchronization; still require a specifically approved isolated target.
- Android/iOS hardware, multi-browser parity, sensor polish, deep mobile performance, and exhaustive accessibility refinement.
- Automatic support for every GeoPDF/LGIDict variant and manual calibration UX. Unsupported or contradictory files stay viewable as documents and are never guessed onto the map.
- Visual refinements and secondary dashboards that do not prevent the core local workflow.

## Safety and evidence

- No remote database write, deployment, publish, commit, push, destructive cleanup, or process termination.
- Do not infer a CRS or silently discard a PDF, package, outbox operation, or existing workspace data.
- Keep implementation and independent review in separate agent runs. Record exact commands and live browser evidence.
- The full PRD remains `NÃO PRONTO` until its separate deferred gates pass; MVP status may only be reported as usable after every acceptance criterion above has fresh evidence.
