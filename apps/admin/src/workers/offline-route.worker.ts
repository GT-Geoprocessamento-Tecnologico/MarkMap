import type { Route, RoutingGraph, RoutingProfile } from '@geonexo/contracts';
import { findRoute } from '@geonexo/maps/routing';
import { MAX_GRAPH_BYTES, validateRegionalGraph } from '@geonexo/maps/routing/graph-format.mjs';
import { offlineMapStore } from '../lib/storage/offline-map-store';

type Incoming =
  | { type: 'load'; packageId: string }
  | { type: 'route'; requestId: number; origin: [number, number]; destination: [number, number]; profile: RoutingProfile };
type Outgoing =
  | { type: 'ready'; profiles: RoutingProfile[]; reason?: string }
  | { type: 'result'; requestId: number; route: Route | null; error?: string };
const scope = self as unknown as { postMessage(message: Outgoing): void };
let graph: RoutingGraph | null = null;
let generation = 0;

async function load(packageId: string, token: number): Promise<void> {
  graph = null;
  try {
    const installed = await offlineMapStore.get(packageId);
    const manifest = installed?.manifest;
    if (!manifest?.routingGraph) {
      if (generation === token) scope.postMessage({ type: 'ready', profiles: [], reason: 'Este mapa não possui rotas offline.' });
      return;
    }
    const ref = manifest.routingGraph;
    const blob = await offlineMapStore.asset(packageId, ref.path);
    if (!blob || blob.size !== ref.blob.bytes || blob.size > MAX_GRAPH_BYTES) throw new Error('Grafo ausente ou incompleto');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hex = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('');
    if (hex !== ref.blob.sha256) throw new Error('Falha de integridade no grafo offline');
    const parsed = validateRegionalGraph(JSON.parse(await blob.text()), { bounds: manifest.bounds, osmDataDate: manifest.osmDataDate });
    for (const profile of parsed.profiles)
      if (!manifest.capabilities.includes(`routing.${profile}`)) throw new Error('Capacidades da região inconsistentes');
    if (generation !== token) return;
    graph = parsed;
    scope.postMessage({ type: 'ready', profiles: parsed.profiles });
  } catch (cause) {
    if (generation !== token) return;
    scope.postMessage({ type: 'ready', profiles: [], reason: cause instanceof Error ? cause.message : 'Grafo local inválido' });
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
      scope.postMessage({ type: 'result', requestId: message.requestId, route,
        ...(!route ? { error: 'Nenhuma rota válida no grafo local (verifique cobertura, acesso e distância à via).' } : {}),
      });
    } catch (cause) {
      scope.postMessage({ type: 'result', requestId: message.requestId, route: null,
        error: cause instanceof Error ? cause.message : 'Roteamento offline indisponível' });
    }
  }
});
