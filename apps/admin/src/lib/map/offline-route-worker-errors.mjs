/** Safe messages for errors crossing the offline routing Worker boundary.
 * Storage/parser errors are not UI content: they can include local paths or URLs.
 */
const KNOWN_LOAD_ERRORS = new Set([
  'Grafo ausente ou incompleto',
  'Falha de integridade no grafo offline',
  'Capacidades da regiao inconsistentes',
]);
const KNOWN_ROUTE_ERRORS = new Set([
  'Instale um mapa com grafo de rotas offline.',
]);

export function describeOfflineRouteWorkerFailure(cause, operation = 'load') {
  const message = cause instanceof Error ? cause.message : null;
  if (operation === 'load') {
    return message && KNOWN_LOAD_ERRORS.has(message)
      ? message
      : 'Nao foi possivel validar as rotas deste mapa offline. Confira o pacote em Configuracoes.';
  }
  return message && KNOWN_ROUTE_ERRORS.has(message)
    ? message
    : 'Nao foi possivel calcular a rota offline. Tente novamente.';
}
