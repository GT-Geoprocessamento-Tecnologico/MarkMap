import type {
  GraphEdge,
  GraphNode,
  Maneuver,
  Route,
  RouteRequest,
  RoutingGraph,
  RoutingProfile,
} from "@geonexo/contracts";

const PROFILE_SPEEDS: Record<RoutingProfile, Record<string, number>> = {
  walk: { default: 5 },
  bicycle: { default: 15 },
  car: { default: 50, motorway: 110, trunk: 90, primary: 70, secondary: 60, tertiary: 50 },
};

const PROFILE_ACCESS: Record<RoutingProfile, string[]> = {
  walk: ["foot", "access"],
  bicycle: ["bicycle", "access"],
  car: ["motor_vehicle", "access"],
};

interface WeightedNode {
  id: number;
  cost: number;
}

class MinHeap {
  private data: WeightedNode[] = [];

  get size() {
    return this.data.length;
  }

  push(node: WeightedNode) {
    this.data.push(node);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): WeightedNode | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const parentData = this.data[parent];
      const currentData = this.data[i];
      if (!parentData || !currentData) break;
      if (parentData.cost <= currentData.cost) break;
      this.data[parent] = currentData;
      this.data[i] = parentData;
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const n = this.data.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      const smallestData = this.data[smallest];
      if (!smallestData) break;
      if (l < n) {
        const ld = this.data[l];
        if (ld && ld.cost < smallestData.cost) smallest = l;
      }
      if (r < n) {
        const rd = this.data[r];
        const sd = this.data[smallest];
        if (rd && sd && rd.cost < sd.cost) smallest = r;
      }
      if (smallest === i) break;
      const tmp = this.data[smallest];
      const cur = this.data[i];
      if (tmp && cur) {
        this.data[smallest] = cur;
        this.data[i] = tmp;
      }
      i = smallest;
    }
  }
}

export function snapToNearestNode(
  graph: RoutingGraph,
  lon: number,
  lat: number,
): number {
  let bestId = 0;
  let bestDist = Infinity;
  for (const node of graph.nodes) {
    const d = (node.lon - lon) ** 2 + (node.lat - lat) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id;
    }
  }
  return bestId;
}

export function buildAdjacencyList(
  graph: RoutingGraph,
  profile: RoutingProfile,
): Map<number, Array<{ edge: GraphEdge; reverse: boolean }>> {
  const adj = new Map<number, Array<{ edge: GraphEdge; reverse: boolean }>>();
  const allowedAccess = PROFILE_ACCESS[profile];

  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (!isEdgeAllowed(edge, profile, allowedAccess)) continue;

    const forwardAllowed = !edge.oneway || profile === "walk";
    const reverseAllowed = !edge.oneway;

    if (forwardAllowed) {
      const list = adj.get(edge.from) ?? [];
      list.push({ edge, reverse: false });
      adj.set(edge.from, list);
    }
    if (reverseAllowed) {
      const list = adj.get(edge.to) ?? [];
      list.push({ edge, reverse: true });
      adj.set(edge.to, list);
    }
  }

  return adj;
}

function isEdgeAllowed(
  edge: GraphEdge,
  profile: RoutingProfile,
  accessKeys: string[],
): boolean {
  for (const key of accessKeys) {
    const val = edge.access[key];
    if (val === false) return false;
  }
  if (profile === "walk" && edge.highwayType === "motorway") return false;
  if (profile === "bicycle" && edge.highwayType === "motorway") return false;
  if (profile === "bicycle" && edge.surface === "gravel") return false;
  return true;
}

export function findRoute(
  graph: RoutingGraph,
  request: RouteRequest,
): Route | null {
  const originNode = snapToNearestNode(graph, request.origin[0], request.origin[1]);
  const destNode = snapToNearestNode(graph, request.destination[0], request.destination[1]);

  const adj = buildAdjacencyList(graph, request.profile);
  const speeds = PROFILE_SPEEDS[request.profile];

  const dist = new Map<number, number>();
  const prev = new Map<number, { nodeId: number; edge: GraphEdge }>();
  const visited = new Set<number>();

  for (const node of graph.nodes) dist.set(node.id, Infinity);
  dist.set(originNode, 0);

  const heap = new MinHeap();
  heap.push({ id: originNode, cost: 0 });

  while (heap.size > 0) {
    const current = heap.pop();
    if (!current) break;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    if (current.id === destNode) break;

    const neighbors = adj.get(current.id) ?? [];
    for (const { edge, reverse } of neighbors) {
      const nextId = reverse ? edge.from : edge.to;
      if (visited.has(nextId)) continue;

      const speed = speeds[edge.highwayType] ?? speeds.default;
      if (speed === undefined) continue;
      const timeCost = edge.distance / (speed / 3.6) / 1000;
      const newCost = current.cost + timeCost;

      if (newCost < (dist.get(nextId) ?? Infinity)) {
        dist.set(nextId, newCost);
        prev.set(nextId, { nodeId: current.id, edge });
        heap.push({ id: nextId, cost: newCost });
      }
    }
  }

  if (!prev.has(destNode) && originNode !== destNode) return null;

  const edges: GraphEdge[] = [];
  let cursor = destNode;
  while (cursor !== originNode) {
    const entry = prev.get(cursor);
    if (!entry) return null;
    edges.unshift(entry.edge);
    cursor = entry.nodeId;
  }

  return buildRoute(graph, edges, request, dist.get(destNode) ?? 0);
}

function buildRoute(
  graph: RoutingGraph,
  edges: GraphEdge[],
  request: RouteRequest,
  _totalCost: number,
): Route {
  const nodeMap = new Map(graph.nodes.map((n): [number, GraphNode] => [n.id, n]));
  const geometry: Array<[number, number]> = [];
  const steps: Route["steps"] = [];
  const legs: Route["legs"] = [];

  let cumulativeDistance = 0;
  let cumulativeDuration = 0;
  let currentRoadName = "";
  let stepGeometry: Array<[number, number]> = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge) continue;
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!fromNode || !toNode) continue;

    if (stepGeometry.length === 0) {
      stepGeometry.push([fromNode.lon, fromNode.lat]);
    }
    stepGeometry.push([toNode.lon, toNode.lat]);
    geometry.push([toNode.lon, toNode.lat]);

    cumulativeDistance += edge.distance;
    const speed = 50;
    const duration = edge.distance / (speed / 3.6) / 1000;
    cumulativeDuration += duration;

    if (edge.name !== currentRoadName || i === edges.length - 1) {
      if (stepGeometry.length >= 2) {
        const maneuver = generateManeuver(edges, i, request);
        steps.push({
          maneuver,
          distance: edge.distance,
          duration,
          geometry: [...stepGeometry],
        });
        stepGeometry = [[toNode.lon, toNode.lat]];
      }
      currentRoadName = edge.name ?? "";
    }

    if (edge.name && legs.length === 0) {
      legs.push({
        distance: cumulativeDistance,
        duration: cumulativeDuration,
        summary: edge.name,
      });
    }
  }

  const lastStep = steps[steps.length - 1];
  if (lastStep) {
    lastStep.maneuver = { ...lastStep.maneuver, type: "arrive" };
  }

  return {
    profile: request.profile,
    distance: cumulativeDistance,
    duration: cumulativeDuration,
    steps,
    geometry,
    legs: legs.length > 0 ? legs : [{ distance: cumulativeDistance, duration: cumulativeDuration, summary: "" }],
    origin: request.origin,
    destination: request.destination,
  };
}

function generateManeuver(
  edges: GraphEdge[],
  index: number,
  request: RouteRequest,
): Maneuver {
  const firstEdge = edges[0];
  if (index === 0) {
    return {
      type: "depart",
      location: request.origin,
      distance: 0,
      duration: 0,
      roadName: firstEdge?.name,
    };
  }

  const prev = edges[index - 1];
  const curr = edges[index];
  if (!prev || !curr) {
    return {
      type: "continue",
      location: request.origin,
      distance: 0,
      duration: 0,
    };
  }

  const bearing = computeBearing(prev, curr);

  let type: Maneuver["type"] = "continue";
  let modifier: Maneuver["modifier"] | undefined;

  if (bearing > 15 && bearing <= 45) {
    type = "turn_right";
    modifier = "slight_right";
  } else if (bearing > 45 && bearing <= 135) {
    type = "turn_right";
    modifier = "right";
  } else if (bearing > 135 && bearing <= 165) {
    type = "turn_right";
    modifier = "sharp_right";
  } else if (bearing < -15 && bearing >= -45) {
    type = "turn_left";
    modifier = "slight_left";
  } else if (bearing < -45 && bearing >= -135) {
    type = "turn_left";
    modifier = "left";
  } else if (bearing < -135 && bearing >= -165) {
    type = "turn_left";
    modifier = "sharp_left";
  } else if (Math.abs(bearing) > 165) {
    type = "u_turn";
    modifier = "uturn";
  }

  return {
    type,
    location: [0, 0],
    distance: curr.distance,
    duration: curr.distance / 50,
    roadName: curr.name,
    modifier,
  };
}

function computeBearing(prev: GraphEdge, curr: GraphEdge): number {
  const prevAngle = Math.atan2(0, prev.distance) * (180 / Math.PI);
  const currAngle = Math.atan2(0, curr.distance) * (180 / Math.PI);
  return currAngle - prevAngle;
}
