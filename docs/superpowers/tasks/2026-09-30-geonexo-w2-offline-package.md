# W2 offline map package repository and protocol

**Task ID:** GEO-W2-OFFLINE-PACKAGE-2026-09-30  
**Role:** maps implementation builder  
**Status:** implementation/review active; W0 source/validator gate PASS-limited, W1 code gate PASS, C1 canonical contract gate PASS  
**Spec:** [remaining implementation specification](../specs/2026-09-30-localfirst-pwa-remaining-implementation.md#w2--offline-package-repositoryprotocol)

## Objective

Implement a local offline map package repository and PMTiles/style protocol that stages, verifies, and activates licensed package data, can read it through bounded cancellable ranges, and renders it after reload without external requests.

## Scope

Builder may edit only:

- `apps/admin/src/lib/storage/offline-map-store.ts`
- `packages/maps/src/offline/package.ts`
- `packages/maps/src/offline/protocol.ts`
- `packages/maps/src/offline/style.ts`
- focused tests under `packages/maps/tests/` and `apps/admin/src/lib/storage/`

Root owns package-management page integration. Do not edit `apps/admin/src/index.tsx`, pages, `App.tsx`, package manifests, contracts, local-db schema/repositories, PWA shell/worker, PDF code, DB/API, or dependency lockfiles.

## Approved references and reuse

- Use canonical `OfflineMapPackageManifest` from `@geonexo/contracts`; do not create a duplicate public manifest.
- W0 structural validator and docs: `packages/maps/src/experimental/offline-package-validator.ts`, `packages/maps/tests/fixtures/offline/`, `docs/maps/offline-package-source.md`.
- Use the installed exact `pmtiles@4.5.0` package through its public `PMTiles`, `FileSource`, and `Source.getBytes(offset, length, signal)` APIs. Version/integrity/license are recorded in `packages/maps/package.json`, `pnpm-lock.yaml`, and `THIRD_PARTY_NOTICES.md`. Do not copy PMTiles source.
- Licensed G0.5 archive/assets are available only in temporary storage at `C:\Users\MATEUS\AppData\Local\Temp\geonexo-g05-b5af6f8a6cab4b4cbde973301ed06453`; use for local verification without copying these assets into the repository.
- The temporary source style points to a loopback URL inside `pmtiles://`; rewrite it to the package-local archive and rewrite glyph/sprite paths to validated local assets. Never perform a remote retry.
- Copy only narrowly bounded, license-cleared algorithms from model repositories when the project API has no equivalent; retain provenance and tests. Do not copy whole repositories or unrelated code.

## Acceptance criteria

1. Archive, styles, glyphs, and sprites are staged and validated against the canonical manifest: schema, safe paths, size/quota budget, zoom/extent, PMTiles version, byte lengths, SHA-256, and local-only style references.
2. Installation reserves quota, writes to a staging generation, verifies durable bytes, and activates atomically; interruption preserves the previous active package.
3. Selecting/removing one package affects only that package. PDF originals, local edits, and sync outbox are never cleared by package replacement/removal.
4. PMTiles protocol serves byte ranges no larger than 4 MiB through `FileSource`, rejects/discards a request promptly when its `AbortSignal` fires, and uses bounded reads. No whole archive buffering or arbitrary network fallback. Interrupting the browser's in-progress local Blob read is deferred; each such read is already capped at 4 MiB and never uses the network.
5. Style adapter resolves PMTiles, glyph, sprite, and `@2x` resources only to validated package-local paths and preserves attribution.
6. Tests reject truncated archives, unsafe/colliding paths, digest/size mismatches, invalid zoom/extent/version, over-budget quota, missing resources, and external URLs; interruption and replacement tests prove prior-package retention.
7. Fresh focused Vitest, maps typecheck/lint, and (after root page integration) Chromium offline restart/render smoke against the licensed temporary archive pass with network requests blocked and labels/icons/attribution visible.

## Risk, permissions, verification, and stop conditions

- Risk: partial activation could remove the last usable offline map or unrelated local user data; all writes must be scoped to package keys and verified before activation.
- User priority update: complete usable local behavior now; physical abortion of an already-started local Blob read is a later performance refinement. Immediate cancellation at the protocol boundary, the 4 MiB bound, transactional package safety, and the real render smoke remain required.
- Permission: workspace-local code/test edits only; no package installation, remote writes, database writes, publish/deploy, commit, or cleanup.
- Verify exact file scope before and after; report commands, results, URLs/requests, screenshots or DOM assertions, and the archive/assets hashes used.
- Stop and report BLOCKED if canonical contract fields do not represent validated local resources, browser storage cannot provide the required atomicity without changing the DB owner’s schema, source artifacts/terms cannot be verified, or an acceptance criterion requires page integration.
- Required handoff: task ID, status, summary, changed files, exact checks/evidence, risks, blockers, and whether independent review is required.
