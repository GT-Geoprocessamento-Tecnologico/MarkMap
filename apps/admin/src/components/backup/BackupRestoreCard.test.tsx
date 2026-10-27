import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupRestoreCard } from './BackupRestoreCard';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@markmap/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@markmap/ui')>()),
  useToast: () => ({ toast }),
}));

describe('BackupRestoreCard (T5)', () => {
  beforeEach(() => {
    toast.mockClear();
  });

  it('renderiza a secao com botoes de exportacao e restauracao', () => {
    render(<BackupRestoreCard />);
    expect(
      screen.getByRole('heading', { name: 'Backup & Restauração Cifrada' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Exportar Backup Cifrado' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Restaurar Backup' }),
    ).toBeEnabled();
  });

  it('abre modal de exportacao e valida tamanho minimo de senha', () => {
    render(<BackupRestoreCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Backup Cifrado' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Gerar e Baixar')).toBeDisabled();

    const passInput = screen.getByLabelText(/Frase de proteção \(mínimo 12 caracteres\)/i);
    fireEvent.change(passInput, { target: { value: 'senha-curta' } });
    expect(screen.getByText('Gerar e Baixar')).toBeDisabled();

    fireEvent.change(passInput, { target: { value: 'senha-longa-suficiente-2026' } });
    expect(screen.getByText('Gerar e Baixar')).toBeEnabled();
  });

  it('abre modal de restauracao com campo de arquivo e frase de protecao', () => {
    render(<BackupRestoreCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Arquivo de Backup \(\.markmapbackup\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Frase de proteção/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verificar' })).toBeDisabled();
  });
});
