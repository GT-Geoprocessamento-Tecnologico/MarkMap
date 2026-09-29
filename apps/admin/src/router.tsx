import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import AppShell from './components/AppShell';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectPage from './pages/projects/ProjectPage';
import WorkspacePage from './pages/workspace/WorkspacePage';
import ImportsPage from './pages/imports/ImportsPage';
import SettingsPage from './pages/settings/SettingsPage';

// Rotas fixadas pelo handoff (20-FRONTEND-PRD-HANDOFF.md:108-119).
// Sem /login nesta fase. Paginas usam default export.
const rootRoute = createRootRoute({ component: AppShell });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectPage,
});

const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/map',
  component: WorkspacePage,
});

const importsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/imports',
  component: ImportsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsRoute,
  projectRoute,
  workspaceRoute,
  importsRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
