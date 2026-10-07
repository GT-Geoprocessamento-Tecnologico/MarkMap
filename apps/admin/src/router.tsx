import { lazy, Suspense } from 'react';
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import DashboardPage from './pages/dashboard/DashboardPage';
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectPage from './pages/projects/ProjectPage';
import CommandCenterPage from './pages/workspace/CommandCenterPage';

import ImportsPage from './pages/imports/ImportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import CoordinateSystemsPage from './pages/dashboard/CoordinateSystemsPage';
import { RootLayout } from './components/layout/RootLayout';
import { AppIcon } from './components/AppIcon';

const rootRoute = createRootRoute({ component: () => <RootLayout /> });
const LazyMeshStudioPage = lazy(() => import('./pages/workspace/MeshStudioPage'));
const MeshStudioRoute = () => (
  <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center" role="status">Carregando Estúdio de Malhas 3D…</div>}>
    <LazyMeshStudioPage />
  </Suspense>
);
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const meshSearch = (search: Record<string, unknown>): { meshId?: string } => ({
  meshId: isUuid(search.meshId) ? search.meshId : undefined,
});
const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
const mapSearch = (
  search: Record<string, unknown>,
): { datasetId?: string; pdfId?: string } => ({
  datasetId: isUuid(search.datasetId) ? search.datasetId : undefined,
  pdfId: isSha256(search.pdfId) ? search.pdfId.toLowerCase() : undefined,
});

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
  validateSearch: mapSearch,
  component: CommandCenterPage,
});

const meshRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/mesh',
  validateSearch: meshSearch,
  component: MeshStudioRoute,
});

const globalMeshRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mesh',
  validateSearch: meshSearch,
  component: MeshStudioRoute,
});

const canvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace',
  validateSearch: mapSearch,
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

/**
 * Telemetria congelada.
 *
 * A página existia, mas só exibia informações do próprio aparelho (estado da
 * rede, memória reportada, viewport e permissão de geolocalização) — nenhuma
 * telemetria de verdade. Como salvar localmente já é o comportamento normal do
 * GeoNexo, essa tela só poluía a navegação, então saiu do menu lateral.
 *
 * A rota continua registrada para que links antigos cheguem a uma explicação em
 * vez de um 404. `TelemetryPage` foi preservada para quando houver coleta real.
 */
function TelemetryFrozen() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <AppIcon name="telemetry" size="lg" className="text-on-surface-variant" />
      <h1 className="text-lg font-bold text-on-surface">Telemetria indisponível</h1>
      <p className="max-w-md text-sm text-on-surface-variant">
        Esta tela estava em desenvolvimento e foi desativada. Os seus dados
        continuam salvos no aparelho e sincronizando normalmente.
      </p>
    </section>
  );
}

const telemetryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/telemetry',
  component: TelemetryFrozen,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsRoute,
  projectRoute,
  commandCenterRoute,
  meshRoute,
  globalMeshRoute,
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
