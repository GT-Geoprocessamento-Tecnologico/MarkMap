import { describe, expect, it } from 'vitest';
import { createPropertyPopupContent } from '../pages/workspace/property-popup';

describe('createPropertyPopupContent', () => {
  it('preserves the legitimate popup content and styling', () => {
    const content = createPropertyPopupContent({
      name: 'Fazenda Santa Helena',
      area: '150 ha',
      owner: 'João Silva',
    });

    expect(content.textContent).toBe('Fazenda Santa HelenaÁrea: 150 haProprietário: João Silva');
    expect(content.querySelector('strong')?.textContent).toBe('Fazenda Santa Helena');
    expect(content.style.cssText).toContain('padding: 8px');
    expect(content.style.fontFamily).toBe('monospace');
  });

  it('renders attacker controlled values as text instead of markup', () => {
    const content = createPropertyPopupContent({
      name: '<img src=x onerror=alert(1)>',
      area: '<script>window.hacked = true</script>',
      owner: '" onmouseover="alert(1)',
    });

    expect(content.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(content.textContent).toContain('<script>window.hacked = true</script>');
    expect(content.querySelector('img, script')).toBeNull();
    expect(content.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders CAR properties when present', () => {
    const content = createPropertyPopupContent({
      name: 'Gleba A',
      cod_imovel: 'GO-5201108-8B7C9D01234',
      tipo_tema: 'RESERVA_LEGAL',
      num_area: '25.4',
      municipio: 'Anápolis',
      uf: 'GO',
      status: 'ATIVO',
    });

    expect(content.textContent).toContain('Gleba A');
    expect(content.textContent).toContain('Área: 25.4 ha');
    expect(content.textContent).toContain('CAR: GO-5201108-8B7C9D01234');
    expect(content.textContent).toContain('Camada: RESERVA_LEGAL');
    expect(content.textContent).toContain('Município: Anápolis - GO');
    expect(content.textContent).toContain('Status: ATIVO');
  });
});
