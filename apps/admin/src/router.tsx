import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Outlet } from '@tanstack/react-router';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectPage from './pages/projects/ProjectPage';
import CommandCenterPage from './pages/workspace/CommandCenterPage';

import MeshStudioPage from './pages/workspace/MeshStudioPage';
import ImportsPage from './pages/imports/ImportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import CoordinateSystemsPage from './pages/dashboard/CoordinateSystemsPage';

import { RootLayout } from './components/layout/RootLayout';

const rootRoute = createRootRoute({ component: () => <RootLayout /> });

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

const commandCenterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/map',
  component: CommandCenterPage,
});

const meshRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/mesh',
  component: MeshStudioPage,
});

const canvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace',
  component: CommandCenterPage,
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

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  component: AnalyticsPage,
});

const coordinateSystemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/coordinate-systems',
  component: CoordinateSystemsPage,
});

const telemetryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/telemetry',
  component: CommandCenterPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsRoute,
  projectRoute,
  commandCenterRoute,
  meshRoute,
  canvasRoute,
  importsRoute,
  settingsRoute,
  analyticsRoute,
  coordinateSystemsRoute,
  telemetryRoute,
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
