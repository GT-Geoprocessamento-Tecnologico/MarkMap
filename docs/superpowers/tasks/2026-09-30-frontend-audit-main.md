# GeoNexo frontend audit and main consolidation

**ID:** GEO-FRONT-MAIN-2026-09-30. **Status:** frontend implementation and independent review passed; final browser QA/preview in progress on main. Git consolidation verified; physical generated remnants cleanup denied by automatic policy review.

## User authorization and objective

The user explicitly requests the frontend-orchestrator skill, frontend/action/field audit and repairs, responsive behavior across devices, discoverable visible 3D meshes, and all improvements in one main branch and one principal worktree. Existing repair workers have finished. Preserve the earlier GeoPDF/local-first/Neon objective: those new subsystems remain pending written-plan review and are not falsely closed by this frontend work.

Canonical checkout is now `D:/MATEUS/Documentos/GitHub/GeoNexo`, branch `main`. User explicitly authorizes local consolidation and removal of duplicate branches/worktrees after loss-proof verification. No push/deploy or production mutation is included; no unrequested commit.

## Fresh consolidation evidence

- Main and feature both based on `a80586a5f2e8aca8c21ff88a661e21e7f61c941e`; main initially clean, source had 113 tracked modifications and 17 untracked files.
- All 130 files copied to principal checkout; individual SHA256 matched and complete binary Git diffs matched. Manifest saved in session TEMP `geonexo-consolidation-manifest-20260930.json`.
- Source ignored inventory contained dependencies/builds/reports/caches only. Private `.env` files exist only in principal checkout and remain untouched. No secret content was read.
- Independent inventory GEO-CONSOLIDATION-READREVIEW-37 confirmed exactly two local branches/worktrees and no additional immediate nested repositories.
- Before duplicate removal verify exact absolute source path and all transferred hashes again; stop only the identified owned old preview, not unknown processes. Use Git worktree removal/branch deletion only after proof.
- Root rechecked all 130 hashes before cleanup, removed the former Git worktree and feature branch successfully. Fresh Git inventory now contains only main and the principal worktree. The physical former directory contains generated dependency/build remnants only; a guarded native PowerShell removal was automatically rejected. Do not bypass that rejection or claim one physical directory yet.
- Main installation uncovered an old Vite/esbuild file lock, an override configuration incompatible with the pinned pnpm 9 placement, partial dependency links and a restarted GeoNexo Turbo process lock. Only identified GeoNexo dev processes were stopped. Root pinned direct Three.js/types, removed unused React 19 wrappers from the React 18 application and preserved the existing esbuild override in pnpm 9 root configuration. Final native dependency repair and runtime checks are recorded separately.

## Audit findings and scope

- GEO-FRONT-AUDIT-38: dashboards have no-op actions, import fabricates counts/status, analytics fabricates metrics, API-mode setting has no effect, telemetry routes to a map, coordinate preferences do not survive reload.
- GEO-3D-AUDIT-39: mesh route exists only within project, has no mesh loader/project data, hardcoded terrain/extrusion, false database-save success, unwired LOD/opacity/tool controls.
- Repair existing frontend flows and make controls honest and functional. Preserve existing backend/contracts architecture; no invented remote endpoints or successful-save claims.
- First real mesh format: local self-contained GLB, with bounded validation, original byte persistence and real Three.js rendering. Stored ArrayBuffer bytes reconstruct the Blob for rendering and preserve read compatibility with older Blob records. Other external-resource/multi-file/compressed formats require explicit support and useful errors; do not advertise unsupported imports.
- Keep SVG/UI design system; fix navigation, safe areas, scroll/overflow, form accessibility and tablet/mobile layout. Use existing runtime persistence paths where sound; mesh-specific Blob storage is separate from the future full sync subsystem.

## Acceptance and verification

1. Exactly one local branch `main` and one registered/physical project worktree after verified consolidation; all prior 130 improvements preserved.
2. Visible global/project access to 3D studio; actual selected project context or clear missing-project state.
3. Import a lawful self-contained GLB, see geometry, use real camera/wireframe/opacity controls, save and reload original/view settings locally, remove a selected mesh and recover cleanly from bad files/WebGL/quota errors.
4. Dashboard navigation/create/import and settings/CRS actions execute their stated action; no success toast for a nonexistent operation, fake record counts or fabricated operational analytics.
5. Datasets register only parsed supported originals. Ordinary unsupported formats get explicit errors; GeoPDF new processing is still gated by its own plan.
6. All routes remain usable at 320/375/768/1024/1440/1920 CSS widths and short landscape height; no global horizontal overflow, reachable nav and touch actions, visible forms/viewport.
7. User already requested tests; run regression/unit/type/lint/build, actual Playwright interaction flows and screenshots, independent review and combined root QA on main. Emulated viewports are not physical-device proof.

## Ownership and stop conditions

- Root: consolidation, dependency installation, persistent spec/plan, shared contract interfaces and final integration/evidence.
- Mesh specialist: MeshStudio page and dedicated mesh components/store/validation, no navigation/imports/layout files.
- UI specialist: router/layout/nav/dashboard/projects/settings/analytics/CRS/telemetry; no MeshStudio/imports/storage ownership.
- After the UI specialist handoff, root owns remaining UI repairs. Independent review 43 found desktop/analytics fabricated values, disconnected settings, remote demonstration images, map lifecycle races and pre-allocation GLB size checks. Root repairs UI/settings/CRS/shared local transaction durability; specialists repair their mesh/map findings. No concurrent source writers.
- Import/map specialist: ImportsPage and CommandCenter map actions/data wiring with agreed exports; no router/layout/mesh files.
- Independent reviewer/QA: read-only review and browser checks; never authors the source being reviewed.
- No concurrent writers on shared files; no new worktrees contrary to explicit single-folder instruction.
- Stop on unsafe private data transfer, divergent commits/staged source, unverified deletion target, unsupported mesh requests requiring remote resources, production DB mutation or unresolved independent blocker.
