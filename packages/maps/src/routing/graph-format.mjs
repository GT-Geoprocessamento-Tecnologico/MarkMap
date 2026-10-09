/** Regional graph wire format. Shared by the offline packager and the PWA. */
export const MAX_GRAPH_BYTES = 8 * 1024 * 1024;
export const MAX_GRAPH_NODES = 30_000;
export const MAX_GRAPH_EDGES = 70_000;
export const MAX_GRAPH_RESTRICTIONS = 10_000;
const profilesAllowed = new Set(['walk', 'bicycle', 'car']);
const turnsAllowed = new Set([
  'no_left_turn', 'no_right_turn', 'no_straight_on',
  'only_left_turn', 'only_right_turn', 'only_straight_on',
]);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const validId = (value) => Number.isSafeInteger(value) && value >= 0;
const validBounds = (b) => Array.isArray(b) && b.length === 4 && b.every(finite) &&
  b[0] >= -180 && b[2] <= 180 && b[1] >= -90 && b[3] <= 90 && b[0] < b[2] && b[1] < b[3];
function assert(condition, message) {
  if (!condition) throw new Error(`Grafo regional inválido: ${message}`);
}

/** Validate untrusted graph.json without network, mutation or unsafe defaults. */
export function validateRegionalGraph(value, expected = {}) {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'objeto obrigatório');
  const graph = value;
  assert(typeof graph.version === 'string' && graph.version.length > 0 && graph.version.length <= 64, 'versão ausente');
  assert(validBounds(graph.bounds), 'limites geográficos incorretos');
  assert(typeof graph.osmDataDate === 'string' && Number.isFinite(Date.parse(graph.osmDataDate)) &&
    graph.osmDataDate.length <= 64, 'data OSM inválida');
  if (expected.bounds) assert(validBounds(expected.bounds) && graph.bounds.every((n, i) => Math.abs(n - expected.bounds[i]) < 1e-7), 'limites não correspondem ao pacote');
  if (expected.osmDataDate) assert(graph.osmDataDate === expected.osmDataDate, 'data OSM difere do pacote');
  assert(Array.isArray(graph.profiles) && graph.profiles.length >= 1 && graph.profiles.length <= 3 &&
    new Set(graph.profiles).size === graph.profiles.length && graph.profiles.every(p => profilesAllowed.has(p)), 'perfis inválidos');
  assert(Array.isArray(graph.nodes) && graph.nodes.length >= 2 && graph.nodes.length <= MAX_GRAPH_NODES, 'quantidade de nós fora do limite');
  assert(Array.isArray(graph.edges) && graph.edges.length >= 1 && graph.edges.length <= MAX_GRAPH_EDGES, 'quantidade de vias fora do limite');
  assert(Array.isArray(graph.turnRestrictions) && graph.turnRestrictions.length <= MAX_GRAPH_RESTRICTIONS, 'restrições ausentes ou excessivas');
  const nodes = new Set();
  for (const node of graph.nodes) {
    assert(node && validId(node.id) && !nodes.has(node.id) && finite(node.lon) && finite(node.lat) &&
      node.lon >= graph.bounds[0] && node.lon <= graph.bounds[2] &&
      node.lat >= graph.bounds[1] && node.lat <= graph.bounds[3], 'nó inválido, repetido ou fora da região');
    nodes.add(node.id);
  }
  const edges = new Map();
  for (const edge of graph.edges) {
    assert(edge && validId(edge.id) && !edges.has(edge.id) && validId(edge.from) && validId(edge.to) &&
      edge.from !== edge.to && nodes.has(edge.from) && nodes.has(edge.to), 'via inválida ou sem nós');
    assert(finite(edge.distance) && edge.distance > 0 && edge.distance <= 1_000_000 &&
      finite(edge.speedKph) && edge.speedKph > 0 && edge.speedKph <= 160 &&
      typeof edge.highwayType === 'string' && edge.highwayType.length > 0 && edge.highwayType.length <= 64 &&
      typeof edge.oneway === 'boolean', 'velocidade, distância ou tipo de via inválidos');
    assert(edge.access && typeof edge.access === 'object' && !Array.isArray(edge.access) &&
      Object.keys(edge.access).length <= 16 && Object.values(edge.access).every(v => typeof v === 'boolean'), 'acessos inválidos');
    assert(edge.name === undefined || (typeof edge.name === 'string' && edge.name.length <= 160), 'nome de via inválido');
    assert(edge.surface === undefined || (typeof edge.surface === 'string' && edge.surface.length <= 64), 'superfície inválida');
    assert(typeof edge.bridges === 'boolean', 'ponte inválida');
    assert(typeof edge.tunnels === 'boolean', 'túnel inválido');
    edges.set(edge.id, edge);
  }
  for (const restriction of graph.turnRestrictions) {
    assert(restriction && validId(restriction.fromEdge) && validId(restriction.toEdge) &&
      validId(restriction.viaNode) && turnsAllowed.has(restriction.type), 'restrição inválida');
    const from = edges.get(restriction.fromEdge);
    const to = edges.get(restriction.toEdge);
    assert(from && to && nodes.has(restriction.viaNode) &&
      (from.from === restriction.viaNode || from.to === restriction.viaNode) &&
      (to.from === restriction.viaNode || to.to === restriction.viaNode), 'restrição referencia via inexistente');
  }
  return graph;
}
