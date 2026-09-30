import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../pages/settings/SettingsPage';
import CoordinateSystemsPage from '../pages/dashboard/CoordinateSystemsPage';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@geonexo/ui', () => ({ useToast: () => ({ toast }) }));

beforeEach(() => {
  localStorage.clear(); toast.mockClear(); document.documentElement.classList.remove('dark');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

describe('functional device settings', () => {
  it('does not advertise configuration fields disconnected from runtime', () => {
    render(<SettingsPage />);
    expect(screen.queryByText('URL da API')).not.toBeInTheDocument();
    expect(screen.queryByText('Limite de Importação')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Proteger dados locais' })).toBeEnabled();
  });

  it('changes and persists the actual theme', () => {
    localStorage.setItem('theme', 'light');
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tema escuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});

describe('local CRS catalog', () => {
  it('rejects duplicates without a contradictory success message', () => {
    render(<CoordinateSystemsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Novo CRS/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Código do CRS' }), { target: { value: 'EPSG:4326' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do CRS' }), { target: { value: 'Duplicado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
    expect(screen.getByRole('dialog', { name: 'Novo CRS' })).toBeInTheDocument();
  });

  it('persists a valid custom catalog entry', () => {
    render(<CoordinateSystemsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Novo CRS/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Código do CRS' }), { target: { value: 'epsg:12345' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do CRS' }), { target: { value: 'Referência local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(JSON.parse(localStorage.getItem('geonexo_crs_systems') ?? '[]')).toContainEqual(expect.objectContaining({ code: 'EPSG:12345', name: 'Referência local' }));
  });
});
