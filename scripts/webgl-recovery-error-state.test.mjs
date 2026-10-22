import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEBGL_CONTEXT_LOST_MESSAGE,
  canReportMapError,
  clearRecoveredWebglError,
} from '../apps/admin/src/lib/map/webgl-context-recovery.mjs';

test('A31 the known lost-context warning may be cleared after a successful paint', () => {
  assert.equal(clearRecoveredWebglError(WEBGL_CONTEXT_LOST_MESSAGE),null);
});

test('A31 a genuine missing offline asset failure stays visible after WebGL recovery', () => {
  const problem='Um recurso do mapa regional está indisponível ou inválido.';
  assert.equal(clearRecoveredWebglError(problem),problem);
  assert.equal(canReportMapError(problem),false);
});

test('A31 the WebGL warning can be replaced by a new resource failure after restore', () => {
  assert.equal(canReportMapError(WEBGL_CONTEXT_LOST_MESSAGE),true);
  assert.equal(canReportMapError(null),true);
  assert.equal(canReportMapError('Não foi possível carregar a cartografia.'),false);
});

test('A31 recovery of a map without warnings remains idempotent', () => {
  assert.equal(clearRecoveredWebglError(null),null);
  assert.equal(clearRecoveredWebglError(null),clearRecoveredWebglError(clearRecoveredWebglError(null)));
});

test('A31 warning wording is stable and contains no paths or sensitive URLs', () => {
  assert.match(WEBGL_CONTEXT_LOST_MESSAGE,/contexto gráfico/);
  assert.equal(WEBGL_CONTEXT_LOST_MESSAGE.includes('://'),false);
  assert.equal(WEBGL_CONTEXT_LOST_MESSAGE.includes('/mnt/'),false);
});
