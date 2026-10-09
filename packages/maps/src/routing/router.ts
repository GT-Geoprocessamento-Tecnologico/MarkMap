import type {
  GraphEdge, Maneuver, Route, RouteRequest, RoutingGraph, RoutingProfile,
} from '@geonexo/contracts';

type TraversedEdge = { edge: GraphEdge; from: number; to: number };
type HeapItem = { id: number; cost: number };

/** Dijkstra uses seconds as its only cost unit. It never queries the network. */
class MinHeap {
  private readonly items: HeapItem[] = [];
  get size(): number { return this.items.length; }
  push(item: HeapItem): void {
    this.items.push(item);
    for (let i = this.items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (this.items[parent]!.cost <= this.items[i]!.cost) break;
      [this.items[parent], this.items[i]] = [this.items[i]!, this.items[parent]!];
      i = parent;
    }
  }
  pop(): HeapItem | undefined {
    if (!this.items.length) return undefined;
    const result = this.items[0]!;
    const last = this.items.pop()!;
    if (this.items.length) {
      this.items[0] = last;
      for (let i = 0;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let next = i;
        if (left < this.items.length && this.items[left]!.cost < this.items[next]!.cost) next = left;
        if (right < this.items.length && this.items[right]!.cost < this.items[next]!.cost) next = right;
        if (next === i) break;
        [this.items[next], this.items[i]] = [this.items[i]!, this.items[next]!];
        i = next;
      }
    }
    return result;
  }
}

export function snapToNearestNode(graph: RoutingGraph, lon: number, lat: number): number {
  let id = -1;
  let distance = Infinity;
  for (const node of graph.nodes) {
    const distanceSquared = (node.lon - lon) ** 2 + (node.lat - lat) ** 2;
    if (distanceSquared < distance) { distance = distanceSquared; id = node.id; }
  }
  return id;
}

function edgeAllowed(edge: GraphEdge, profile: RoutingProfile): boolean {
  if (!Number.isFinite(edge.distance) || edge.distance <= 0) return false;
  const access = edge.access ?? {};
  const key = profile === 'walk' ? 'foot' : profile === 'bicycle' ? 'bicycle' : 'motor_vehicle';
  if (access.access === false || access[key] === false) return false;
  if ((profile === 'walk' || profile === 'bicycle') && ['motorway', 'motorway_link'].includes(edge.highwayType)) return false;
  // Individual bicycle restrictions are represented by access.bicycle, not the surface type.
  return true;
}

export function buildAdjacencyList(
  graph: RoutingGraph, profile: RoutingProfile,
): Map<number, Array<{ edge: GraphEdge; reverse: boolean }>> {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, [] as Array<{ edge: GraphEdge; reverse: boolean }>]));
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to) || !edgeAllowed(edge, profile)) continue;
    // Forward travel is ALWAYS allowed when the edge itself is available.
    adjacency.get(edge.from)!.push({ edge, reverse: false });
    // One-way traffic restricts car/bicycle, but not regular walking.
    if (!edge.oneway || profile === 'walk') adjacency.get(edge.to)!.push({ edge, reverse: true });
  }
  return adjacency;
}

function speedKph(edge: GraphEdge, profile: RoutingProfile): number {
  if (profile === 'walk') return 5;
  if (profile === 'bicycle') return 15;
  const roadCaps: Record<string, number> = {
    motorway: 110, trunk: 90, primary: 70, secondary: 60, tertiary: 50,
  };
  const limit = roadCaps[edge.highwayType] ?? 50;
  return Math.min(limit, Number.isFinite(edge.speedKph) && edge.speedKph > 0 ? edge.speedKph : limit);
}
function edgeSeconds(edge: GraphEdge, profile: RoutingProfile): number {
  return edge.distance / (speedKph(edge, profile) / 3.6);
}

function bearing(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const longitude = (b[0] - a[0]) * rad;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;
  return Math.atan2(Math.sin(longitude) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitude)) / rad;
}
function maneuverType(before: number, after: number): Pick<Maneuver, 'type' | 'modifier'> {
  const difference = ((after - before + 540) % 360) - 180;
  const magnitude = Math.abs(difference);
  if (magnitude <= 20) return { type: 'continue' };
  if (magnitude >= 160) return { type: 'u_turn', modifier: 'uturn' };
  const side = difference > 0 ? 'right' : 'left';
  const intensity = magnitude < 45 ? 'slight_' : magnitude > 135 ? 'sharp_' : '';
  return { type: side === 'right' ? 'turn_right' : 'turn_left',
    modifier: `${intensity}${side}` as Maneuver['modifier'] };
}

export function findRoute(graph: RoutingGraph, request: RouteRequest): Route | null {
  if (graph.nodes.length === 0 || !['walk', 'bicycle', 'car'].includes(request.profile)) return null;
  const originId = snapToNearestNode(graph, ...request.origin);
  const destinationId = snapToNearestNode(graph, ...request.destination);
  if (originId < 0 || destinationId < 0) return null;
  const adjacency = buildAdjacencyList(graph, request.profile);
  const costs = new Map<number, number>(graph.nodes.map((n) => [n.id, Infinity]));
  const previous = new Map<number, { from: number; edge: GraphEdge }>();
  const visited = new Set<number>();
  costs.set(originId, 0);
  const queue = new MinHeap();
  queue.push({ id: originId, cost: 0 });
  while (queue.size) {
    const current = queue.pop()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.id === destinationId) break;
    for (const { edge, reverse } of adjacency.get(current.id) ?? []) {
      const next = reverse ? edge.from : edge.to;
      if (visited.has(next)) continue;
      const candidate = current.cost + edgeSeconds(edge, request.profile);
      if (candidate < (costs.get(next) ?? Infinity)) {
        costs.set(next, candidate);
        previous.set(next, { from: current.id, edge });
        queue.push({ id: next, cost: candidate });
      }
    }
  }
  if (originId !== destinationId && !previous.has(destinationId)) return null;
  const traversed: TraversedEdge[] = [];
  let cursor = destinationId;
  while (cursor !== originId) {
    const prev = previous.get(cursor);
    if (!prev) return null;
    traversed.unshift({ edge: prev.edge, from: prev.from, to: cursor });
    cursor = prev.from;
  }
  const nodes = new Map(graph.nodes.map((n): [number, [number, number]] => [n.id, [n.lon, n.lat]]));
  const start = nodes.get(originId)!;
  const geometry: Array<[number, number]> = [start];
  const steps: Route['steps'] = [];
  let distance = 0;
  let duration = 0;
  let lastBearing: number | null = null;
  for (const [index, part] of traversed.entries()) {
    const from = nodes.get(part.from);
    const to = nodes.get(part.to);
    if (!from || !to) return null;
    const direction = bearing(from, to);
    const kind = index === 0 || lastBearing === null ? { type: 'depart' as const } : maneuverType(lastBearing, direction);
    const seconds = edgeSeconds(part.edge, request.profile);
    steps.push({
      maneuver: { ...kind, location: from, distance: 0, duration: 0, roadName: part.edge.name },
      distance: part.edge.distance,
      duration: seconds,
      geometry: [from, to],
    });
    geometry.push(to);
    distance += part.edge.distance;
    duration += seconds;
    lastBearing = direction;
  }
  steps.push({ maneuver: { type: 'arrive', location: geometry[geometry.length - 1]!, distance: 0, duration: 0 },
    distance: 0, duration: 0, geometry: [geometry[geometry.length - 1]!] });
  return {
    profile: request.profile,
    origin: request.origin,
    destination: request.destination,
    distance, duration, geometry, steps,
    legs: [{ distance, duration, summary: traversed[0]?.edge.name ?? '' }],
  };
}
