import type { Route, RoutingGraph, RoutingProfile } from '@markmap/contracts';
import { findRoute } from '@markmap/maps/routing';
import {
  computeOfflineNavigationProgress,
  type ForegroundGpsFix,
  type OfflineNavigationProgress,
} from '@markmap/maps/routing/navigation-progress';
import { MAX_GRAPH_BYTES, validateRegionalGraph } from '@markmap/maps/routing/graph-format.mjs';
import { offlineMapStore } from '../lib/storage/offline-map-store';
import { describeOfflineRouteWorkerFailure } from '../lib/map/offline-route-worker-errors.mjs';

type Incoming =
  | { type: 'load'; packageId: string }
  | { type: 'route'; requestId: number; origin: [number, number]; destination: [number, number]; profile: RoutingProfile; reroute?: boolean }
  | { type: 'progress'; sampleId: number; routeId: number; fix: ForegroundGpsFix };
type Outgoing =
  | { type: 'ready'; profiles: RoutingProfile[]; reason?: string }
  | { type: 'result'; requestId: number; reroute: boolean; route: Route | null; error?: string }
  | { type: 'progress'; sampleId: number; routeId: number; progress: OfflineNavigationProgress | null };
const scope = self as unknown as { postMessage(message: Outgoing): void };
let graph: RoutingGraph | null = null;
let activeRoute: Route | null = null;
let activeRouteId = 0;
let generation = 0;

async function load(packageId: string, token: number): Promise<void> {
  graph = null;
  activeRoute = null;
  activeRouteId = 0;
  try {
    const installed = await offlineMapStore.getActiveRevision(packageId);
    const ref = installed?.manifest.routingGraph;
    if (!installed || !ref) {
      if (generation === token) scope.postMessage({ type: 'ready', profiles: [], reason: 'Este mapa nao possui rotas offline.' });
      return;
    }
    const manifest = installed.manifest;
    const blob = await offlineMapStore.assetAtRevision(packageId, ref.path, installed.generation);
    if (!blob) {
      if ((await offlineMapStore.getActiveRevision(packageId))?.generation !== installed.generation)
        throw new Error('Mapa regional atualizado durante leitura');
      throw new Error('Grafo ausente ou incompleto');
    }
    if (blob.size !== ref.blob.bytes || blob.size > MAX_GRAPH_BYTES) throw new Error('Grafo ausente ou incompleto');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hex = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
    if (hex !== ref.blob.sha256) throw new Error('Falha de integridade no grafo offline');
    const parsed = validateRegionalGraph(JSON.parse(await blob.text()), { bounds: manifest.bounds, osmDataDate: manifest.osmDataDate });
    for (const profile of parsed.profiles)
      if (!manifest.capabilities.includes(`routing.${profile}`)) throw new Error('Capacidades da regiao inconsistentes');
    if (generation !== token) return;
    // An IndexedDB update may commit while SHA and graph parsing are in flight.
    if ((await offlineMapStore.getActiveRevision(packageId))?.generation !== installed.generation)
      throw new Error('Mapa regional atualizado durante leitura');
    if (generation !== token) return;
    graph = parsed;
    scope.postMessage({ type: 'ready', profiles: parsed.profiles });
  } catch (cause) {
    if (generation !== token) return;
    scope.postMessage({ type: 'ready', profiles: [], reason: describeOfflineRouteWorkerFailure(cause, 'load') });
  }
}

self.addEventListener('message', (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'load') {
    const token = ++generation;
    void load(message.packageId, token);
    return;
  }
  if (message.type === 'route') {
    if (!Number.isSafeInteger(message.requestId)) return;
    try {
      if (!graph) throw new Error('Instale um mapa com grafo de rotas offline.');
      const route = findRoute(graph, {
        origin: message.origin, destination: message.destination, profile: message.profile,
      });
      if (route) {
        activeRoute = route;
        activeRouteId = message.requestId;
      } else if (!message.reroute) {
        activeRoute = null;
        activeRouteId = 0;
      }
      scope.postMessage({ type: 'result', requestId: message.requestId, reroute: Boolean(message.reroute), route,
        ...(!route ? { error: 'Nenhuma rota valida na regiao offline (verifique cobertura e acessos).' } : {}),
      });
    } catch (cause) {
      if (!message.reroute) { activeRoute = null; activeRouteId = 0; }
      scope.postMessage({ type: 'result', requestId: message.requestId, reroute: Boolean(message.reroute), route: null,
        error: describeOfflineRouteWorkerFailure(cause, 'route') });
    }
    return;
  }
  if (message.type === 'progress' && Number.isSafeInteger(message.sampleId) && message.routeId === activeRouteId) {
    let progress: OfflineNavigationProgress | null = null;
    try { if (activeRoute) progress = computeOfflineNavigationProgress(activeRoute, message.fix); }
    catch { /* Invalid fixes never become navigation updates. */ }
    scope.postMessage({ type: 'progress', sampleId: message.sampleId, routeId: activeRouteId, progress });
  }
});
