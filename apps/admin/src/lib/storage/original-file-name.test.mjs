import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportedOriginalName } from './original-file-name.mjs';

test('renomeia PDF sem mudar formato e preserva extensao TIFF', () => {
  assert.equal(normalizeImportedOriginalName('Propriedade', 'application/pdf', 'old.pdf'), 'Propriedade.pdf');
  assert.equal(normalizeImportedOriginalName('Carta.pdf', 'application/pdf', 'old.pdf'), 'Carta.pdf');
  assert.equal(normalizeImportedOriginalName('Fazenda', 'image/tiff', 'old.tiff'), 'Fazenda.tiff');
  assert.equal(normalizeImportedOriginalName('Fazenda.tif', 'image/tiff', 'old.tiff'), 'Fazenda.tif');
});

test('rejeita nomes perigosos, trocas de tipo e nomes excessivos', () => {
  for (const name of ['', '../arquivo', 'projeto\\mapa', 'Mapa:2026', '.']) {
    assert.throws(() => normalizeImportedOriginalName(name, 'application/pdf', 'old.pdf'));
  }
  assert.throws(() => normalizeImportedOriginalName('raster.tiff', 'application/pdf', 'old.pdf'));
  assert.throws(() => normalizeImportedOriginalName('x'.repeat(121), 'application/pdf', 'old.pdf'));
});
