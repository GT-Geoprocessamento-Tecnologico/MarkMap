import { useState, useRef, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
} from "@markmap/ui";
import { exportEncryptedWorkspace } from "../../lib/backup/export";
import {
  dryRunRestore,
  restoreWorkspaceSnapshot,
  type DryRunRestoreResult,
} from "../../lib/backup/restore";
import { localDb } from "../../lib/local-db";
import {
  readLocalEngineSnapshot, readMeshesSnapshot, readLargeBlobsSnapshot, readOfflineMapsSnapshot,
} from "../../lib/backup/multi-db";
import {
  summarizeDeviceBackupCoverage, type DevicePreflightReport,
} from "../../lib/backup/device-preflight.mjs";
import { FullPhotoBackupCard } from "./FullPhotoBackupCard";
import { version as appVersion } from "../../../package.json";

// Keep this pre-read limit aligned with dryRunRestore's archive limit.
const MAX_BACKUP_FILE_BYTES = 32 * 1024 * 1024;

function formatBytes(bytes?: number): string {
  if (bytes === undefined || Number.isNaN(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export function BackupRestoreCard({ showRecoveryLink = true }: { showRecoveryLink?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados de Exportação
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportConfirm, setExportConfirm] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [deviceCoverage, setDeviceCoverage] = useState<DevicePreflightReport | null>(null);
  const [coverageBusy, setCoverageBusy] = useState(false);
  const [coverageError, setCoverageError] = useState(false);

  const inspectOtherLocalData = async () => {
    if (coverageBusy) return;
    setCoverageBusy(true);
    setCoverageError(false);
    setDeviceCoverage(null);
    try {
      // Read-only counts; neither backup files nor workspace data are touched.
      const results = await Promise.allSettled([
        readLocalEngineSnapshot(), readMeshesSnapshot(),
        readLargeBlobsSnapshot(), readOfflineMapsSnapshot(),
      ]);
      setDeviceCoverage(summarizeDeviceBackupCoverage(results));
    } catch {
      // Do not surface IndexedDB exceptions containing identifiers or filenames.
      setCoverageError(true);
    } finally {
      setCoverageBusy(false);
    }
  };

  // Estados de Restauração
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunRestoreResult | null>(
    null,
  );
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ignore verification results that finish after the input or dialog changed.
  const verificationGeneration = useRef(0);

  const invalidatePreview = () => {
    verificationGeneration.current += 1;
    setDryRunBusy(false);
    setDryRunResult(null);
    setRestoreConfirmed(false);
    setRestoreError(null);
  };

  const onRestoreOpenChange = (open: boolean) => {
    if (!open && restoreBusy) return;
    if (!open) {
      invalidatePreview();
      setRestoreFile(null);
      setRestorePassphrase("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setRestoreOpen(open);
  };

  const handleExport = async () => {
    setExportError(null);
    if (exportPassphrase.length < 12) {
      setExportError(
        "A frase de proteção deve conter no mínimo 12 caracteres.",
      );
      return;
    }
    if (exportPassphrase !== exportConfirm) {
      setExportError("A confirmação da frase de proteção não coincide.");
      return;
    }

    setExportBusy(true);
    try {
      const result = await exportEncryptedWorkspace({
        passphrase: exportPassphrase,
        appVersion,
      });

      const blob = new Blob([result.bytes.buffer as ArrayBuffer], {
        type: "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Backup exportado com sucesso",
        description: `Arquivo ${result.filename} gerado com proteção AES-256.`,
        variant: "success",
      });

      setExportOpen(false);
      setExportPassphrase("");
      setExportConfirm("");
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Falha na exportação do backup.";
      setExportError(message);
      toast({
        title: "Erro na exportação",
        description: message,
        variant: "error",
      });
    } finally {
      setExportBusy(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    invalidatePreview();
    setRestoreFile(file);
  };

  const handleDryRun = async () => {
    setRestoreError(null);
    if (!restoreFile) {
      setRestoreError("Selecione um arquivo de backup antes de continuar.");
      return;
    }
    if (!restorePassphrase) {
      setRestoreError("Informe a frase de proteção do arquivo.");
      return;
    }
    if (restoreFile.size > MAX_BACKUP_FILE_BYTES) {
      invalidatePreview();
      setRestoreError("Arquivo de backup excede o limite de 32 MiB.");
      return;
    }

    invalidatePreview();
    const generation = verificationGeneration.current;
    setDryRunBusy(true);
    try {
      const buffer = await restoreFile.arrayBuffer();
      const result = await dryRunRestore(buffer, restorePassphrase);
      if (generation !== verificationGeneration.current) return;
      setDryRunResult(result);
      toast({
        title: "Backup verificado",
        description: `Criptografia e integridade validadas (${result.summary.totalRecords} registros).`,
        variant: "success",
      });
    } catch (cause) {
      if (generation !== verificationGeneration.current) return;
      const message =
        cause instanceof Error
          ? cause.message
          : "Falha na verificação do backup.";
      setRestoreError(message);
      setDryRunResult(null);
      toast({
        title: "Verificação falhou",
        description: message,
        variant: "error",
      });
    } finally {
      if (generation === verificationGeneration.current) setDryRunBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!dryRunResult) return;
    if (!restoreConfirmed) {
      setRestoreError(
        "É necessário confirmar a restauração antes de prosseguir.",
      );
      return;
    }

    setRestoreBusy(true);
    setRestoreError(null);
    try {
      const result = await restoreWorkspaceSnapshot(
        dryRunResult.snapshot,
        localDb,
        {
          confirmed: true,
        },
      );

      toast({
        title: "Backup restaurado com sucesso",
        description: `${result.restoredCounts.entities} entidades, ${result.restoredCounts.originals} originais, ${result.restoredCounts.outbox} operações e ${result.restoredCounts.conflicts} conflitos restaurados.`,
        variant: "success",
      });

      setRestoreOpen(false);
      setRestoreFile(null);
      setRestorePassphrase("");
      setDryRunResult(null);
      setRestoreConfirmed(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Restoration has committed. Refresh only local-data queries; a failed
      // refresh cannot turn a successful restore into a reported failure.
      void Promise.resolve().then(() => queryClient.invalidateQueries({
        predicate: ({ queryKey }) => typeof queryKey[0] === "string" &&
          ["projects", "layers", "features", "analytics-layers"].includes(queryKey[0]),
      })).catch(() => undefined);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Falha na restauração do backup.";
      setRestoreError(message);
      setRestoreConfirmed(false);
      toast({
        title: "Erro na restauração",
        description: message,
        variant: "error",
      });
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-5">
      <h2 className="text-lg font-semibold">Backup & Restauração Cifrada</h2>
      <p className="my-2 text-sm text-on-surface-variant">
        Gere cópias de segurança criptografadas (AES-256-GCM + PBKDF2) dos dados
        locais ou restaure arquivos com inspeção preliminar segura em memória
        (sem escrita prévia).
      </p>
      <p className="my-2 text-sm text-on-surface-variant">
        Esta cópia é parcial: inclui apenas os dados do workspace e tem limite
        de 16 MiB. Mapas offline e dados de outros bancos não estão incluídos.
      </p>

      <section aria-label="Cobertura do backup neste dispositivo" className="my-3 space-y-2 rounded-xl border border-outline-variant p-3">
        <p className="text-sm font-semibold">O que fica fora da cópia parcial?</p>
        <p className="text-xs text-on-surface-variant">
          Esta inspeção usa apenas contagens locais, sem rede nem leitura de arquivos grandes.
          Não cria backup, não verifica a integridade dos dados e não garante restauração.
        </p>
        <button type="button" onClick={() => void inspectOtherLocalData()} disabled={coverageBusy}
          className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm disabled:opacity-50">
          {coverageBusy ? "Verificando dados locais…" : "Verificar outros bancos locais"}
        </button>
        {coverageError && <p role="alert" className="text-xs text-on-surface-variant">
          Verificação indisponível. Podem existir dados locais não incluídos nesta cópia.
        </p>}
        {deviceCoverage && (
          <div role="status" aria-live="polite" className="space-y-2 text-xs text-on-surface-variant">
            <p>Resultado somente informativo: este backup continua <strong>parcial</strong>, mesmo que os outros bancos estejam vazios.</p>
            <ul className="list-disc space-y-1 pl-5">
              {deviceCoverage.sections.map((section) => (
                <li key={section.id}><strong>{section.label}:</strong> {section.message}</li>
              ))}
            </ul>
            <p>Os dados podem mudar entre as consultas; não há snapshot atômico entre bancos.</p>
          </div>
        )}
      </section>

      <FullPhotoBackupCard />

      {showRecoveryLink && (
        <p className="my-2 text-sm text-on-surface-variant">
          Para recuperar em um perfil novo ou vazio, abra nesse perfil o{" "}
          <a className="underline" href="/?restore=1">modo de recuperação</a>.
          Abrir o link nesta aba não cria outro perfil nem apaga dados existentes.
        </p>
      )}

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
                Seus dados serão protegidos com chave derivada via PBKDF2
                (310.000 iterações) e AES-256-GCM. Guarde a frase de proteção em
                local seguro. Mapas offline e dados de outros bancos não fazem
                parte desta cópia parcial.
              </DialogDescription>
            </DialogHeader>

            {exportError && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-500"
              >
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
                  onChange={(e) => setExportPassphrase(e.target.value)}
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
                  onChange={(e) => setExportConfirm(e.target.value)}
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
                {exportBusy ? "Criptografando…" : "Gerar e Baixar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Restauração */}
        <Dialog open={restoreOpen} onOpenChange={onRestoreOpenChange}>
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
                Selecione o arquivo{" "}
                <code className="rounded bg-surface-container-high px-1 py-0.5 text-xs font-mono">
                  .markmapbackup
                </code>{" "}
                e insira a senha para verificar o conteúdo com validação segura
                antes de gravar.
              </DialogDescription>
            </DialogHeader>

            {restoreError && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/40 bg-red-500/10 p-2.5 text-xs text-red-500"
              >
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
                    onChange={(e) => {
                      invalidatePreview();
                      setRestorePassphrase(e.target.value);
                    }}
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
                    {dryRunBusy ? "Verificando…" : "Verificar"}
                  </Button>
                </div>
              </div>

              {/* Painel de Prévia Dry-Run */}
              {dryRunResult && (
                <div className="rounded-xl border border-outline-variant bg-surface p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                    <span className="font-semibold text-emerald-500">
                      Integridade confirmada
                    </span>
                    <span className="text-on-surface-variant">
                      App v{dryRunResult.appVersion}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-on-surface">
                    <div>
                      <dt className="text-on-surface-variant">
                        Data da criação
                      </dt>
                      <dd className="font-medium">
                        {new Date(dryRunResult.createdAt).toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">
                        Workspace de origem
                      </dt>
                      <dd
                        className="font-mono truncate"
                        title={dryRunResult.workspaceId}
                      >
                        {dryRunResult.workspaceId}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">
                        Projetos / Feições
                      </dt>
                      <dd className="font-medium">
                        {dryRunResult.summary.projectsCount} projetos ·{" "}
                        {dryRunResult.summary.featuresCount} feições
                      </dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">
                        Originais (GeoPDF)
                      </dt>
                      <dd className="font-medium">
                        {dryRunResult.summary.originalsCount} (
                        {formatBytes(dryRunResult.summary.totalOriginalsBytes)})
                      </dd>
                    </div>
                    <div>
                      <dt className="text-on-surface-variant">Operações pendentes / conflitos</dt>
                      <dd className="font-medium">
                        {dryRunResult.summary.outboxCount} operações · {dryRunResult.summary.conflictsCount} conflitos
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                    Salvaguarda ativa: a restauração não sobrescreverá
                    alterações pendentes na outbox.
                  </div>

                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <Checkbox
                      checked={restoreConfirmed}
                      onCheckedChange={(checked) =>
                        setRestoreConfirmed(Boolean(checked))
                      }
                      disabled={restoreBusy}
                    />
                    <span className="text-xs font-medium text-on-surface">
                      Confirmo a restauração dos dados deste backup no
                      workspace.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => onRestoreOpenChange(false)}
                disabled={restoreBusy}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => void handleRestore()}
                disabled={restoreBusy || dryRunBusy || !dryRunResult || !restoreConfirmed}
                className="bg-brand-blue text-white hover:brightness-110"
              >
                {restoreBusy ? "Restaurando…" : "Restaurar Dados"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
