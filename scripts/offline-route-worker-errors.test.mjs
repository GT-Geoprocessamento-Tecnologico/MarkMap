import test from 'node:test';
import assert from 'node:assert/strict';
import { describeOfflineRouteWorkerFailure } from '../apps/admin/src/lib/map/offline-route-worker-errors.mjs';

test('A33 preserves known actionable integrity and missing-graph messages', () => {
  for (const reason of [
    'Grafo ausente ou incompleto',
    'Falha de integridade no grafo offline',
    'Capacidades da regiao inconsistentes',
  ]) assert.equal(describeOfflineRouteWorkerFailure(Error(reason), 'load'), reason);
});

test('A33 never forwards local paths or private URLs from storage failures', () => {
  const output = describeOfflineRouteWorkerFailure(
    Error('IndexedDB denied path /private/storage/secret?token=TOP_SECRET'), 'load');
  assert.match(output, /rotas.*offline/i);
  assert.doesNotMatch(output, /secret|private|token|path|indexeddb/i);
});

test('A33 error resembling a known message with appended credentials is not trusted', () => {
  const output = describeOfflineRouteWorkerFailure(
    Error('Grafo ausente ou incompleto https://api.example/?token=TOP_SECRET'), 'load');
  assert.doesNotMatch(output, /TOP_SECRET|https:/);
  assert.notEqual(output, 'Grafo ausente ou incompleto https://api.example/?token=TOP_SECRET');
});

test('A33 preserves harmless known no-graph route failure', () => {
  assert.equal(describeOfflineRouteWorkerFailure(
    Error('Instale um mapa com grafo de rotas offline.'), 'route'),
    'Instale um mapa com grafo de rotas offline.');
});

test('A33 never forwards unexpected route engine exceptions', () => {
  const output = describeOfflineRouteWorkerFailure(Error('Invalid node: C:\\user\\secrets\\key'), 'route');
  assert.doesNotMatch(output, /secrets|Invalid|key/);
});

test('A33 unknown thrown values stay safe for both operations', () => {
  for (const cause of [null, undefined, 'token=secret', { message: 'token=secret' }]) {
    for (const op of ['load', 'route']) assert.doesNotMatch(
      describeOfflineRouteWorkerFailure(cause, op), /secret|token|undefined|null/i);
  }
});
