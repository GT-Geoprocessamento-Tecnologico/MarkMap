# GeoNexo responsive layout fix

**Task ID:** GEO-RESPONSIVE-2026-09-30  
**Status:** complete  
**Objective:** make the existing local GeoNexo UI usable on mobile, tablet, and desktop without changing the product architecture.

## Changes

- Keep navigation in a hamburger drawer below 1024px; show the persistent sidebar from 1024px.
- Show project and import cards below 1280px with their key details and actions; retain tables on wide screens.
- Move floating map tools above attribution/scale controls on narrow viewports and reserve safe-area space for mobile navigation.

## Verification evidence

- `pnpm --filter admin typecheck` — passed.
- Scoped ESLint for the six changed responsive files — passed.
- `pnpm --filter admin build -- --outDir C:\Users\MATEUS\AppData\Local\Temp\geonexo-responsive-build-20260930-d11fce75` — passed; Vite reported the existing chunk-size warning.
- Focused Vitest `src/test/project-pagination.test.tsx src/test/mobile-dashboard.test.tsx` — 5/5 passed.
- Production preview returned HTTP 200 at `http://127.0.0.1:5195` and was opened in headed Chromium at 390x844 for user inspection.
- Browser interaction checks covered 360, 390, 768, 1024, and 1366px widths: project and imported GeoJSON cards/actions, drawer open/navigation/close, desktop table/sidebar transition, map feature rendering, safe-area/toolbar placement, and horizontal overflow. No page errors were recorded.
- Independent read-only UI review passed with no responsive blocker.
- `git diff --check` passed; only standard LF/CRLF conversion warnings appeared.

## Changed files

- `apps/admin/src/components/layout/RootLayout.tsx`
- `apps/admin/src/components/TopNavBar.tsx`
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx`
- `apps/admin/src/pages/projects/ProjectsPage.tsx`
- `apps/admin/src/pages/imports/ImportsPage.tsx`
- `apps/admin/src/components/dashboard/MobileDashboard.tsx`
