import { useState, useRef, type ChangeEvent } from 'react';
import {
  useToast,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  Button,
  Checkbox,
} from '@markmap/ui';
import { exportEncryptedWorkspace } from '../../lib/backup/export';
import {
  dryRunRestore,
  restoreWorkspaceSnapshot,
  type DryRunRestoreResult,
} from '../../lib/backup/restore';
import { localDb } from '../../lib/local-db';
import { appCredits } from '../../lib/app-credits';

function formatBytes(bytes?: number): string {
  if (bytes === undefined || Number.isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export function BackupRestoreCard() {
  const { toast } = useToast();

  // Estados de Exportação
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportConfirm, setExportConfirm] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Estados de Restauração
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunRestoreResult | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExportError(null);
    if (exportPassphrase.length < 12) {
      setExportError('A frase de proteção deve conter no mínimo 12 caracteres.');
      return;
    }
    if (exportPassphrase !== exportConfirm) {
      setExportError('A confirmação da frase de proteção não coincide.');
      return;
    }

    setExportBusy(true);
    try {
      const result = await exportEncryptedWorkspace({
        passphrase: exportPassphrase,
        appVersion: appCredits.version,
      });

      const blob = new Blob([result.bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup exportado com sucesso',
        description: `Arquivo ${result.filename} gerado com proteção AES-256.`,
        variant: 'success',
      });

      setExportOpen(false);
      setExportPassphrase('');
      setExportConfirm('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha na exportação do backup.';
      setExportError(message);
      toast({
        title: 'Erro na exportação',
        description: message,
        variant: 'error',
      });
    } finally {
      setExportBusy(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setRestoreFile(file);
    setDryRunResult(null);
    setRestoreConfirmed(false);
    setRestoreError(null);
  };

  const handleDryRun = async () => {
    setRestoreError(null);
    if (!restoreFile) {
      setRestoreError('Selecione um arquivo de backup antes de continuar.');
      return;
    }
    if (!restorePassphrase) {
      setRestoreError('Informe a frase de proteção do arquivo.');
      return;
    }

    setDryRunBusy(true);
    try {
      const buffer = await restoreFile.arrayBuffer();
      const result = await dryRunRestore(buffer, restorePassphrase);
      setDryRunResult(result);
      toast({
        title: 'Backup verificado',
        description: `Criptografia e integridade validadas (${result.summary.totalRecords} registros).`,
        variant: 'success',
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha na verificação do backup.';
      setRestoreError(message);
      setDryRunResult(null);
      toast({
        title: 'Verificação falhou',
        description: message,
        variant: 'error',
      });
    } finally {
      setDryRunBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!dryRunResult) return;
    if (!restoreConfirmed) {
      setRestoreError('É necessário confirmar a restauração antes de prosseguir.');
      return;
    }

    setRestoreBusy(true);
    setRestoreError(null);
    try {
      const result = await restoreWorkspaceSnapshot(dryRunResult.snapshot, localDb, {
        confirmed: true,
      });

      toast({
        title: 'Backup restaurado com sucesso',
        description: `${result.restoredCounts.entities} entidades e ${result.restoredCounts.originals} originais restaurados no workspace.`,
        variant: 'success',
      });

      setRestoreOpen(false);
      setRestoreFile(null);
      setRestorePassphrase('');
      setDryRunResult(null);
      setRestoreConfirmed(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Falha na restauração do backup.';
      setRestoreError(message);
      toast({
        title: 'Erro na restauração',
        description: message,
        variant: 'error',
      });
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <h2 className="text-lg font-semibold">Backup & Restauração Cifrada</h2>
      <p className="my-2 text-sm text-on-surface-variant">
        Gere cópias de segurança criptografadas (AES-256-GCM + PBKDF2) dos dados locais ou
        restaure arquivos com inspeção preliminar segura em memória (sem escrita prévia).
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {/* Modal de Exportação */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="min-h-[44px] rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              Exportar Backup Cifrado
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Exportar Backup Cifrado</DialogTitle>
              <DialogDescription>
                Seus dados serão protegidos com chave derivada via PBKDF2 (310.000 iterações) e
                AES-256-GCM. Guarde a frase de proteção em local seguro.
              </DialogDescription>
            </DialogHeader>

            {exportError && (
              <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-500">
                {exportError}
              </p>
            )}

            <div className="space-y-4 py-3">
              <div>
                <label
                  htmlFor="export-passphrase"
                  className="block text-xs font-semibold uppercase text-on-surface-variant"
                >
                  Frase de proteção (mínimo 12 caracteres)
                </label>
                <input
                  id="export-passphrase"
                  type="password"
                  value={exportPassphrase}
                  onChange={e => setExportPassphrase(e.target.value)}
                  placeholder="Digite uma frase longa e segura"
                  disabled={exportBusy}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="export-confirm-passphrase"
                  className="block text-xs font-semibold uppercase text-on-surface-variant"
                >
                  Confirme a frase de proteção
                </label>
                <input
                  id="export-confirm-passphrase"
                  type="password"
                  value={exportConfirm}
                  onChange={e => setExportConfirm(e.target.value)}
                  placeholder="Repita a frase exatamente igual"
                  disabled={exportBusy}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setExportOpen(false)}
                disabled={exportBusy}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleExport()}
                disabled={exportBusy || exportPassphrase.length < 12}
                className="bg-brand-blue text-white hover:brightness-110"
              >
                {exportBusy ? 'Criptografando…' : 'Gerar e Baixar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Restauração */}
        <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="min-h-[44px] rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high disabled:opacity-50"
            >
              Restaurar Backup
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Restaurar Backup Cifrado</DialogTitle>
              <DialogDescription>
                Selecione o arquivo <code className="rounded bg-surface-container-high px-1 py-0.5 text-xs font-mono">.markmapbackup</code> e insira a senha para verificar o conteúdo com validação segura antes de gravar.
              </DialogDescription>
            </DialogHeader>

            {restoreError && (
              <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-500">
                {restoreError}
              </p>
            )}

            <div className="space-y-4 py-3">
              <div>
                <label
                  htmlFor="restore-file-input"
                  className="block text-xs font-semibold uppercase text-on-surface-variant"
                >
                  Arquivo de Backup (.markmapbackup)
                </label>
                <input
                  id="restore-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".markmapbackup,application/json"
                  onChange={handleFileChange}
                  disabled={dryRunBusy || restoreBusy}
                  className="mt-1 w-full text-xs text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:text-xs file:font-semibold file:text-on-surface hover:file:brightness-105"
                />
              </div>

              <div>
                <label
                  htmlFor="restore-passphrase-input"
                  className="block text-xs font-semibold uppercase text-on-surface-variant"
                >
                  Frase de proteção
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="restore-passphrase-input"
                    type="password"
                    value={restorePassphrase}
                    onChange={e => setRestorePassphrase(e.target.value)}
                    placeholder="Frase utilizada na exportação"
                    disabled={dryRunBusy || restoreBusy}
                    className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    onClick={() => void handleDryRun()}
                    disabled={dryRunBusy || !restoreFile || !restorePassphrase}
                    variant="secondary"
                    className="min-h-[44px] whitespace-nowrap"
                  >
                    {dryRunBusy ? 'Verificando…' : 'Verificar'}
                  </Button>
                </div>
              </div>

              {/* Painel de Prévia Dry-Run */}
              {dryRunResult && (
                <div className="rounded-xl border border-outline-variant bg-surface p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                    <span className="font-semibold text-emerald-500">Integridade confirmada</span>
                    <span className="text-on-surface-variant">App v{dryRunResult.appVersion}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-on-surface">
                    <div>
                      <dt className="text-on-surface-variant">Data da criação</dt>
                      <dd className="font-medium">{new Date(dryRunResult.createdAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">Workspace de origem</dt>
                      <dd className="font-mono truncate" title={dryRunResult.workspaceId}>
                        {dryRunResult.workspaceId}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">Projetos / Feições</dt>
                      <dd className="font-medium">
                        {dryRunResult.summary.projectsCount} projetos · {dryRunResult.summary.featuresCount} feições
                      </dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">Originais (GeoPDF)</dt>
                      <dd className="font-medium">
                        {dryRunResult.summary.originalsCount} ({formatBytes(dryRunResult.summary.totalOriginalsBytes)})
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                    Salvaguarda ativa: a restauração não sobrescreverá alterações pendentes na outbox.
                  </div>

                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <Checkbox
                      checked={restoreConfirmed}
                      onCheckedChange={checked => setRestoreConfirmed(Boolean(checked))}
                      disabled={restoreBusy}
                    />
                    <span className="text-xs font-medium text-on-surface">
                      Confirmo a restauração dos dados deste backup no workspace.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setRestoreOpen(false)}
                disabled={restoreBusy}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleRestore()}
                disabled={restoreBusy || !dryRunResult || !restoreConfirmed}
                className="bg-brand-blue text-white hover:brightness-110"
              >
                {restoreBusy ? 'Restaurando…' : 'Restaurar Dados'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
