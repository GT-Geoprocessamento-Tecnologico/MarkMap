import { useRef, useState } from "react";
import {
  exportFullPointPhotoBackup, inspectFullPointPhotoBackup, restoreFullPointPhotoBackup,
  MAX_PHOTO_BACKUP_ARCHIVE_BYTES,
} from "../../lib/backup/photo-backup";

function fmt(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

/**
 * Full photo coverage within ONE workspace. Does not claim to back up
 * offline maps, GeoPDFs or other databases; those require separate exports.
 */
export function FullPhotoBackupCard() {
  const [exportPass, setExportPass] = useState("");
  const [exportConfirm, setExportConfirm] = useState("");
  const [restorePass, setRestorePass] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [verified, setVerified] = useState<{count:number; bytes:number; file:File; pass:string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportPhotos = async () => {
    if (busy) return;
    setError(null); setNotice(null);
    if (exportPass.length < 12 || exportPass !== exportConfirm) {
      setError("Use uma frase de proteção de pelo menos 12 caracteres e confirme-a.");
      return;
    }
    setBusy(true);
    try {
      const result = await exportFullPointPhotoBackup(exportPass);
      const url = URL.createObjectURL(new Blob([result.bytes.buffer as ArrayBuffer], { type: "application/octet-stream" }));
      const link = document.createElement("a");
      link.href = url; link.download = result.filename;
      document.body.appendChild(link);
      link.click(); link.remove();
      // Keep the object URL alive long enough for mobile save/share workflows.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setNotice(`Backup completo de ${result.photoCount} fotos (${fmt(result.totalBytes)}) gerado. Salve o arquivo fora do aparelho.`);
      setExportPass(""); setExportConfirm("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível fazer backup das fotos.");
    } finally { setBusy(false); }
  };
  const verify = async () => {
    if (busy || !restoreFile || !restorePass) return;
    setError(null); setNotice(null); setVerified(null);
    setBusy(true);
    try {
      if (restoreFile.size > MAX_PHOTO_BACKUP_ARCHIVE_BYTES)
        throw new Error("Arquivo de fotos excede o limite de segurança.");
      const preview = await inspectFullPointPhotoBackup(
        new Uint8Array(await restoreFile.arrayBuffer()), restorePass,
      );
      setVerified({count:preview.count,bytes:preview.totalBytes,file:restoreFile,pass:restorePass});
      setNotice(`Integridade conferida: ${preview.count} fotos (${fmt(preview.totalBytes)}). Nenhuma gravação realizada.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "O backup de fotos não pôde ser verificado.");
    } finally { setBusy(false); }
  };
  const restore = async () => {
    if (busy || !restoreFile || !restorePass || !verified ||
        verified.file !== restoreFile || verified.pass !== restorePass) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await restoreFullPointPhotoBackup(
        new Uint8Array(await restoreFile.arrayBuffer()), restorePass,
      );
      setNotice(`Restauração concluída: ${result.added} fotos adicionadas e ${result.unchanged} já existentes preservadas.` +
        (result.orphaned ? ` ${result.orphaned} foto(s) de pontos ausentes ficaram guardadas até restaurar esses pontos.` : ""));
      setVerified(null);
      setRestoreFile(null); setRestorePass("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Restauração das fotos cancelada; não apague os dados.");
    } finally { setBusy(false); }
  };

  return (
    <section aria-label="Backup integral das fotos" className="my-4 min-w-0 space-y-3 rounded-xl border border-outline-variant bg-surface p-3">
      <h3 className="text-sm font-bold">Backup integral das fotos dos pontos</h3>
      <p className="text-xs text-on-surface-variant break-words">
        Inclui todas as fotos deste workspace, com senha e integridade SHA-256. Não inclui projetos,
        mapas offline ou sincronização. Restaure os projetos/pontos primeiro em um dispositivo novo.
      </p>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <label className="block min-w-0 text-xs font-semibold">
          Frase de proteção das fotos
          <input type="password" value={exportPass} disabled={busy} onChange={(e) => setExportPass(e.target.value)}
            className="mt-1 min-h-[44px] w-full min-w-0 rounded-lg border border-outline-variant bg-background px-3" />
        </label>
        <label className="block min-w-0 text-xs font-semibold">
          Confirmar frase de proteção
          <input type="password" value={exportConfirm} disabled={busy} onChange={(e) => setExportConfirm(e.target.value)}
            className="mt-1 min-h-[44px] w-full min-w-0 rounded-lg border border-outline-variant bg-background px-3" />
        </label>
      </div>
      <button type="button" disabled={busy || exportPass.length < 12} onClick={() => void exportPhotos()}
        className="min-h-[44px] max-w-full rounded-lg bg-brand-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {busy ? "Processando…" : "Exportar todas as fotos (criptografado)"}
      </button>
      <div className="border-t border-outline-variant pt-3">
        <p className="mb-2 text-xs font-semibold">Restaurar todas as fotos</p>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <label className="block min-w-0 text-xs">
            Arquivo .markmapfotos
            <input ref={fileInputRef} type="file" accept=".markmapfotos,application/json" disabled={busy}
              onChange={(e) => {setRestoreFile(e.currentTarget.files?.[0] ?? null);setVerified(null);setNotice(null);}}
              className="mt-1 block min-w-0 w-full max-w-full text-xs" />
          </label>
          <label className="block min-w-0 text-xs">
            Frase de proteção
            <input type="password" value={restorePass} disabled={busy}
              onChange={(e) => {setRestorePass(e.target.value);setVerified(null);}}
              className="mt-1 min-h-[44px] w-full min-w-0 rounded-lg border border-outline-variant bg-background px-3" />
          </label>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap gap-2">
          <button type="button" disabled={busy || !restoreFile || restorePass.length < 12} onClick={() => void verify()}
            className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-xs disabled:opacity-50">
            Verificar arquivo, sem restaurar
          </button>
          <button type="button" disabled={busy || !verified || verified.file !== restoreFile || verified.pass !== restorePass}
            onClick={() => void restore()} className="min-h-[44px] rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-on-secondary disabled:opacity-50">
            Confirmar restauração das fotos
          </button>
        </div>
      </div>
      {notice && <p role="status" className="break-words text-xs text-secondary">{notice}</p>}
      {error && <p role="alert" className="break-words text-xs text-error">{error}</p>}
    </section>
  );
}
