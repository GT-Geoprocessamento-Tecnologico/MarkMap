# Frontend audit repairs and main consolidation plan

**Specification planning:** GEO-FRONT-MAIN-2026-09-30. Scope is the user's explicitly authorized frontend repair; prior GeoPDF/sync architecture remains separately gated. No Council was used.

## Implementation decisions

- Use principal `main` only. Copy verified dirty changes instead of merging identical HEADs. Remove old branch/worktree only after hash/diff proof and canonical dependency install; preserve principal private configuration.
- Plain Three.js GLTFLoader/OrbitControls in a lazily loaded React page. Existing React 18 is preserved; installed react-three packages target a different peer version, so do not activate those incompatible wrappers. Pin direct Three.js/types to the already resolved versions through the sole root tooling owner.
- Mesh uploads are self-contained GLB only, 25 MiB input, capped declared resources/geometry and no arbitrary external URIs. Render actual user geometry; optional bundled demo must be clearly labeled and not a purported user dataset. Store original ArrayBuffer bytes + metadata/settings atomically in versioned mesh-only IndexedDB, reconstruct Blob for rendering and read prior Blob records. This avoids WebKit File/Blob preparation failures. Fail visibly on quota/write failure. No database-save claim.
- Global `/mesh` exposes the local mesh collection; `/projects/$projectId/mesh` scopes it to the selected project. Link from primary navigation, project list/detail and dataset mesh actions.
- Cross-task interface `lib/mesh/mesh-store.ts`: `listMeshes(projectId?: string)`, `saveMesh(input:{file:File;projectId?:string})`, `getMesh(id:string)`, `removeMesh(id:string)`, `saveMeshView(id:string, view:MeshView)`. Types and validation defined by mesh owner; import UI consumes these, never edits them concurrently. `MeshView` has camera preset, wireframe and opacity; unsupported editing/measurement tools must not pretend functionality.
- Dataset vector imports start with validated GeoJSON using existing geometry/contracts and original Blob storage; the importer must count actual features, persist locally and provide preview/export/delete. Link GLB into the shared mesh store. Do not advertise Shapefile/raster/GeoPDF processing until real adapters exist. Preserve original files and useful unsupported messages.
- Navigation actions use existing routes/hooks; mobile search/filter/action behavior derives from saved projects, not static demonstration counts. Analytics displays actual project/layer/feature totals and documented missing measurements. Hide unavailable developer mode controls that have no runtime effect.
- Responsive shell uses dynamic viewport height, safe-area insets, `min-w-0`, overflow containment, accessible menu/dialog/focus states and 44px touch controls. Page tables may scroll within a named region, never overflow the whole viewport. Mesh canvas uses ResizeObserver and handles WebGL context loss/unsupported devices.

## Task graph and concrete ownership

| Task | Files / interface | Depends | Required evidence |
| --- | --- | --- | --- |
| C0 consolidate | 130 copied files, root manifest and Git worktree registry | source workers finished | SHA256/binary diff equality, one branch/worktree |
| D0 dependencies | admin package.json + root lockfile, Three.js/types only | C0 | frozen install; no new peer activation |
| M1 mesh validation/store | `apps/admin/src/lib/mesh/{validation,mesh-store}.ts`, mesh test fixtures/tests | C0/D0 | invalid/oversize/external resource rejection, original/view reload/delete/quota tests |
| M2 real renderer | `src/components/mesh/*`, `pages/workspace/MeshStudioPage.tsx` | M1 | real local GLB rendering, camera/wireframe/opacity, cleanup/resize/WebGL failure |
| U1 navigation/layout | RootLayout, TopNavBar, router, styles, dashboards, projects | C0 | visible studio entry, no-op dashboard actions repaired, all viewport checks |
| U2 settings/data pages | Settings, Analytics, CoordinateSystems, telemetry view | U1 | actual persisted settings/actions and honest metrics, no ineffective API mode switch |
| I1 datasets/import | ImportsPage, `lib/datasets/*`, tests | M1 interface / C0 | parsed actual GeoJSON/GLB, original reload, real preview/export/delete/errors |
| I2 map actions | CommandCenter, dedicated helpers/components/tests | I1 / existing hooks | selected project/layers/features rendered, actions do real work, initialization cleanup/error |
| Q1 independent QA | e2e responsive/frontend/mesh/import flow tests + review docs | M2/U2/I2 | real browsers, screenshots, bounded console failures, technical review |
| Q2 root gates | full suite/audit, local API/PostGIS checks, main inventory | Q1 fixes | uncached serial checks, final branch/worktree state, loopback preview |

For each implementation task: write failing regression; run focused test and capture failure; implement minimal repair; run unit/type/lint; review diff; hand actual files/commands/results/residuals to independent reviewer. No commit step without user authorization.

## Risk inputs and stop conditions

- GLB unknown signatures/version/chunks, malformed resource sizes, missing mesh, compressed dependencies, remote file references: M1 rejects before renderer; no network loaders by inference.
- Browser storage quota/interrupted transaction: M1/I1 fail without false success or silent original loss.
- Unsupported WebGL/context loss/mount/unmount/resize: M2 clears listeners/resources and presents a usable fallback.
- Mobile short viewport/sidebar/table/dialog clipping: U1/Q1 tests all named sizes and interactions, includes landscape and keyboard focus.
- Simulated metadata/nonexistent endpoint/API setting: U2/I1/I2 use actual data sources or explicit unavailable state; future full sync/PDF scope remains documented.
- If a repair needs a new unapproved backend/GeoPDF architecture, isolate the finding in that prior plan rather than inventing a response. No production writes or remote Git operations.

## Specification gate

### Live API integration repair (GEO-FRONT-LIVE-52)

Fresh live-preview preparation found that `api-client.ts` already calls documented project detail and nested layer/feature endpoints, while `services/api` currently registers only flat list/create routes. The existing API README documents the nested interface. This is a blocking existing integration defect for real project/map actions, within the requested frontend audit; it is independent of the gated GeoPDF/Neon/sync architecture.

- Backend owner may implement `GET /projects/:id`, `GET /layers/:id`, and documented `GET/POST /projects/:projectId/layers` and `GET/POST /layers/:layerId/features`, preserving flat endpoints and using current contract validation and DB queries. Add a bounded active-only project lookup in the existing DB queries if absent. No new auth, schema, service, dependency or remote database mutation.
- Path UUIDs and pagination/bbox use existing validators; nested paths are authoritative and conflicting body IDs must fail visibly. Existing 404 envelopes and `toProjectWire` normalization remain canonical. Preserve geometry, SRID, version and keyset pagination behavior.
- Backend owns only API route/query/test files and `packages/db/src/queries/projects.ts`; root owns frontend, test harness, lockfile and final integration. Reviewer remains read-only. No concurrent writes or full DB test writers.
- Regression acceptance: active project detail and missing/deleted/invalid IDs; nested layer create/list/read and nested feature create/list with real geometry, invalid/mismatched IDs, cursor/bbox; flat routes unchanged. Unit/type/lint/build followed by root browser actions against the actual isolated local PostGIS API. Production browser UI acceptance remains separate and mock mode is explicit.
- Stop at new architectural requirements, missing canonical contract, production/Neon writes or additional unrelated CRUD. Update-feature support is not added unless an exposed audited action demonstrably requires it.

This bounded integration specification is implementation-ready; the new subsystem gate remains separate.

This implementation-ready task graph records the audited existing defects and precise bounded repairs requested by the user. The frontend repair gate is satisfied once dependency/ownership interfaces are handed to workers; new GeoPDF/local-first/Neon subsystems retain the earlier written-plan review gate. User's request explicitly overrides the worktree preference: all new edits occur on main in the principal folder.
