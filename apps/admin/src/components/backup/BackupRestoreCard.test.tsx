import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { version as appVersion } from '../../../package.json';
import { BackupRestoreCard } from './BackupRestoreCard';

const { toast, dryRunRestore, restoreWorkspaceSnapshot, exportEncryptedWorkspace } = vi.hoisted(() => ({
  toast: vi.fn(),
  dryRunRestore: vi.fn(),
  restoreWorkspaceSnapshot: vi.fn(),
  exportEncryptedWorkspace: vi.fn(),
}));
vi.mock('../../lib/backup/restore', () => ({ dryRunRestore, restoreWorkspaceSnapshot }));
vi.mock('../../lib/backup/export', () => ({ exportEncryptedWorkspace }));
vi.mock('@markmap/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@markmap/ui')>()),
  useToast: () => ({ toast }),
}));

describe('BackupRestoreCard (T5)', () => {
  let queryClient: QueryClient;
  const renderCard = () => render(
    <QueryClientProvider client={queryClient}><BackupRestoreCard /></QueryClientProvider>,
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    toast.mockClear();
    dryRunRestore.mockReset();
    restoreWorkspaceSnapshot.mockReset();
    exportEncryptedWorkspace.mockReset();
  });

  it('renderiza a secao com botoes de exportacao e restauracao', () => {
    renderCard();
    expect(
      screen.getByRole('heading', { name: 'Backup & Restauração Cifrada' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Exportar Backup Cifrado' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Restaurar Backup' }),
    ).toBeEnabled();
    expect(screen.getByText(/Esta cópia é parcial/)).toHaveTextContent(/16 MiB/);
    expect(screen.getByText(/Esta cópia é parcial/)).toHaveTextContent(/Mapas offline/);
  });

  it('abre modal de exportacao e valida tamanho minimo de senha', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Backup Cifrado' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Gerar e Baixar')).toBeDisabled();

    const passInput = screen.getByLabelText(/Frase de proteção \(mínimo 12 caracteres\)/i);
    fireEvent.change(passInput, { target: { value: 'senha-curta' } });
    expect(screen.getByText('Gerar e Baixar')).toBeDisabled();

    fireEvent.change(passInput, { target: { value: 'senha-longa-suficiente-2026' } });
    expect(screen.getByText('Gerar e Baixar')).toBeEnabled();
  });

  it('envia ao exportador a versão numérica canônica do pacote', async () => {
    exportEncryptedWorkspace.mockRejectedValue(new Error('fim da prova'));
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar Backup Cifrado' }));
    const password = 'senha-longa-suficiente-2026';
    fireEvent.change(screen.getByLabelText(/Frase de proteção \(mínimo 12 caracteres\)/i), { target: { value: password } });
    fireEvent.change(screen.getByLabelText(/Confirme a frase de proteção/i), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar e Baixar' }));
    await waitFor(() => expect(exportEncryptedWorkspace).toHaveBeenCalledWith({ passphrase: password, appVersion }));
    expect(appVersion).toMatch(/^\d+\.\d+\.\d+$/);
    await screen.findByText('fim da prova');
  });

  it('abre modal de restauracao com campo de arquivo e frase de protecao', () => {
    renderCard();
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
  it('invalida a prévia e a confirmação ao mudar a frase ou fechar o diálogo', async () => {
    dryRunRestore.mockResolvedValue({
      appVersion: '0.5.13',
      createdAt: '2026-10-27T00:00:00Z',
      workspaceId: 'workspace-teste',
      summary: { projectsCount: 1, featuresCount: 0, originalsCount: 0, totalOriginalsBytes: 0, totalRecords: 2, outboxCount: 1, conflictsCount: 0 },
      snapshot: {},
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    const file = new File(['arquivo'], 'teste.markmapbackup');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });
    fireEvent.change(screen.getByLabelText(/Arquivo de Backup/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Frase de proteção'), { target: { value: 'frase-de-teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await screen.findByText('Integridade confirmada');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Restaurar Dados' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Frase de proteção'), { target: { value: 'outra-frase' } });
    expect(screen.queryByText('Integridade confirmada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar Dados' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await screen.findByText('Integridade confirmada');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    expect(screen.queryByText('Integridade confirmada')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Frase de proteção')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Restaurar Dados' })).toBeDisabled();
  });

  it('ignora verificação concluída depois de fechar e reabrir o diálogo', async () => {
    let finish!: (value: unknown) => void;
    dryRunRestore.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    const file = new File(['arquivo'], 'teste.markmapbackup');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });
    fireEvent.change(screen.getByLabelText(/Arquivo de Backup/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Frase de proteção'), { target: { value: 'frase-de-teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await waitFor(() => expect(dryRunRestore).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    await act(async () => { finish({ summary: { totalRecords: 1 } }); });
    expect(screen.queryByText('Integridade confirmada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar Dados' })).toBeDisabled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('recusa arquivo acima de 32 MiB antes de lê-lo em memória', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    const file = new File(['x'], 'grande.markmapbackup');
    const arrayBuffer = vi.fn();
    Object.defineProperty(file, 'size', { value: 32 * 1024 * 1024 + 1 });
    Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer });
    fireEvent.change(screen.getByLabelText(/Arquivo de Backup/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Frase de proteção'), { target: { value: 'frase-de-teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('limite de 32 MiB');
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(dryRunRestore).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Restaurar Dados' })).toBeDisabled();
  });

  it('permite leitura de arquivo com tamanho exatamente no limite de 32 MiB', async () => {
    dryRunRestore.mockRejectedValue(new Error('conteúdo sintético inválido'));
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    const file = new File(['x'], 'limite.markmapbackup');
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    Object.defineProperty(file, 'size', { value: 32 * 1024 * 1024 });
    Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer });
    fireEvent.change(screen.getByLabelText(/Arquivo de Backup/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Frase de proteção'), { target: { value: 'frase-de-teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await waitFor(() => expect(dryRunRestore).toHaveBeenCalledOnce());
    expect(arrayBuffer).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('conteúdo sintético inválido');
  });

  it('invalida apenas consultas locais depois do commit de restauração', async () => {
    for (const key of ['projects', 'layers', 'features', 'analytics-layers', 'unrelated']) {
      queryClient.setQueryData([key, 'exemplo'], 'anterior');
    }
    dryRunRestore.mockResolvedValue({
      appVersion: '0.5.13', createdAt: '2026-10-27T00:00:00Z', workspaceId: 'workspace-teste',
      summary: { projectsCount: 1, featuresCount: 0, originalsCount: 0, totalOriginalsBytes: 0, totalRecords: 1, outboxCount: 0, conflictsCount: 0 },
      snapshot: {},
    });
    restoreWorkspaceSnapshot.mockResolvedValue({
      restoredCounts: { entities: 1, originals: 0, outbox: 0, conflicts: 0 },
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    const file = new File(['x'], 'teste.markmapbackup');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });
    fireEvent.change(screen.getByLabelText(/Arquivo de Backup/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Frase de proteção'), { target: { value: 'frase-de-teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await screen.findByText('Integridade confirmada');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Dados' }));
    await waitFor(() => expect(queryClient.getQueryState(['projects', 'exemplo'])?.isInvalidated).toBe(true));
    for (const key of ['layers', 'features', 'analytics-layers']) {
      expect(queryClient.getQueryState([key, 'exemplo'])?.isInvalidated).toBe(true);
    }
    expect(queryClient.getQueryState(['unrelated', 'exemplo'])?.isInvalidated).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Backup restaurado com sucesso' }));
  });

  it('mantém restauração como sucesso mesmo se a invalidação falhar', async () => {
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValue(new Error('falha de atualização'));
    dryRunRestore.mockResolvedValue({
      appVersion: '0.5.13', createdAt: '2026-10-27T00:00:00Z', workspaceId: 'workspace-teste',
      summary: { projectsCount: 1, featuresCount: 0, originalsCount: 0, totalOriginalsBytes: 0, totalRecords: 1, outboxCount: 0, conflictsCount: 0 },
      snapshot: {},
    });
    restoreWorkspaceSnapshot.mockResolvedValue({
      restoredCounts: { entities: 1, originals: 0, outbox: 0, conflicts: 0 },
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Backup' }));
    const file = new File(['x'], 'teste.markmapbackup');
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(0) });
    fireEvent.change(screen.getByLabelText(/Arquivo de Backup/), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText('Frase de proteção'), { target: { value: 'frase-de-teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    await screen.findByText('Integridade confirmada');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar Dados' }));
    await waitFor(() => expect(queryClient.invalidateQueries).toHaveBeenCalledOnce());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Backup restaurado com sucesso' }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro na restauração' }));
  });

});
