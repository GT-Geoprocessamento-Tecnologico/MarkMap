import type { RoutingGraph } from '@markmap/contracts';
export const MAX_GRAPH_BYTES: number;
export const MAX_GRAPH_NODES: number;
export const MAX_GRAPH_EDGES: number;
export const MAX_GRAPH_RESTRICTIONS: number;
export function validateRegionalGraph(value: unknown, expected?: {
  bounds?: readonly [number, number, number, number];
  osmDataDate?: string;
}): RoutingGraph;
