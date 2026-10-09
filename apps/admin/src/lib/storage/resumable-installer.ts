/**
 * MM-MAP-130: remote regional installer. Downloaded chunks remain in a separate
 * IndexedDB until checksums, manifest and MapLibre-local paths are verified.
 * Runtime package activation is delegated to the existing OfflineMapStore.
 */
import { getDeviceStorageProfile } from './device-storage-profile';
import { type LargeBlobStore, type StoreResult, createBlobStoreError } from './large-blob-store';
import { offlineMapPackageManifestSchema, type OfflineMapPackageManifest } from '@geonexo/contracts';
import { validateOfflinePackage } from '@geonexo/maps/offline/package';
import { offlineMapStore } from './offline-map-store';
import { RegionDownloadCheckpoints } from './region-download-checkpoints';
import { downloadVerifiedAsset, DownloadIntegrityError } from './verified-range-download.mjs';

export type InstallerStatus = 'idle' | 'downloading' | 'validating' | 'activating' | 'active' | 'rollback' | 'error';
export interface InstallerProgress {
  status: InstallerStatus;
  percent: number;
  message: string;
  downloadedBytes: number;
  totalBytes: number | null;
  speed: number;
  eta: number;
  checkpoint: number;
  lastCheckpoint: number;
  abort: () => void;
}
export type InstallerResult<T> = { success: true; data: T } | { success: false; error: {
  code: string; message: string; retryable: boolean;
} };
export type InstallManifest = OfflineMapPackageManifest & { archivePath: string };
export interface InstallParams {
  packageId: string;
  manifest: InstallManifest;
  /** HTTPS directory containing archivePath, style and sprite/glyph paths. */
  baseUrl?: string;
  onProgress?: (progress: InstallerProgress) => void;
  forceValidate: boolean;
}
export interface Checkpoint {
  id: string;
  timestamp: string;
  downloadedBytes: number;
  totalBytes: number | null;
  speed: number;
  eta: number;
}
export interface ResumeResult { canResume: boolean; checkpoint: Checkpoint | null; reason?: string; }

function safePath(path: string): boolean {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') &&
    path.split('/').every((part) => part && part !== '.' && part !== '..' && /^[a-zA-Z0-9._@-]+$/.test(part));
}
function validatedBaseUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.search || parsed.hash ||
      !((parsed.protocol === 'https:') || (parsed.protocol === 'http:' && parsed.hostname === 'localhost')))
    throw new Error('Fonte do pacote deve ser HTTPS, sem credenciais nem query string');
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  return parsed;
}
function fail(code: string, message: string, retryable = false): StoreResult<never> {
  return { success: false, error: createBlobStoreError(code, message, retryable) };
}

export class ResumableInstaller {
  private readonly chunks = new RegionDownloadCheckpoints();
  private active: AbortController | null = null;
  // Constructor kept for compatibility with RegionManager; all durable data
  // lives in OfflineMapStore and RegionDownloadCheckpoints, not LargeBlobStore.
  constructor(_blobStore: LargeBlobStore | null = null, _isCapacitor?: boolean) {}

  async init(): Promise<{ success: boolean; error?: string }> {
    try { await getDeviceStorageProfile(); return { success: true }; }
    catch (e) { return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }; }
  }
  async checkResume(packageId: string): Promise<ResumeResult> {
    try {
      const session = await this.chunks.getSession(packageId);
      if (!session) return { canResume: false, checkpoint: null, reason: 'Nenhum download interrompido' };
      const downloadedBytes = await this.chunks.getDownloadedBytes(session.hashes);
      if (downloadedBytes <= 0 || downloadedBytes > session.totalBytes)
        return { canResume: false, checkpoint: null, reason: 'Sem chunks verificados para retomar' };
      return { canResume: true, checkpoint: {
        id: session.manifestSha, timestamp: session.updatedAt, downloadedBytes,
        totalBytes: session.totalBytes, speed: 0, eta: 0,
      } };
    } catch (e) { return { canResume: false, checkpoint: null, reason: e instanceof Error ? e.message : 'Falha no checkpoint' }; }
  }
  async startInstall(params: InstallParams): Promise<StoreResult<{ installId: string; status: InstallerStatus }>> {
    if (this.active) return fail('install-busy', 'Já existe uma instalação em andamento');
    if (!params?.manifest || typeof params.manifest !== 'object') return fail('invalid-manifest', 'Manifest ausente');
    const { archivePath, ...persistedManifest } = params.manifest;
    const parsed = offlineMapPackageManifestSchema.safeParse(persistedManifest);
    if (!parsed.success || params.packageId !== persistedManifest.id || !safePath(archivePath))
      return fail('invalid-manifest', 'Identidade, manifest ou caminho do pacote inválido');
    if (!params.baseUrl) return fail('missing-source', 'URL da fonte HTTPS é obrigatória');
    let base: URL;
    try { base = validatedBaseUrl(params.baseUrl); }
    catch (e) { return fail('invalid-source', e instanceof Error ? e.message : 'Fonte inválida'); }
    const manifest = parsed.data;
    const files = [
      { path: archivePath, target: 'package.pmtiles', size: manifest.archive.bytes, sha256: manifest.archive.sha256 },
      ...[manifest.style, ...manifest.glyphs, ...manifest.sprites, ...(manifest.searchShards ?? []), ...(manifest.routingGraph ? [manifest.routingGraph] : []), ...(manifest.contourLines ? [manifest.contourLines] : []),
        ...(manifest.wikipediaPack ? [manifest.wikipediaPack] : []),
        ...(manifest.transitPack ? [manifest.transitPack] : []),
        ...(manifest.demGrid ? [manifest.demGrid] : [])].map((ref) => ({ path: ref.path, target: ref.path, size: ref.blob.bytes, sha256: ref.blob.sha256 })),
    ];
    if (files.some((f) => !safePath(f.path) || !safePath(f.target)))
      return fail('invalid-path', 'O manifest inclui caminho inseguro');
    const total = files.reduce((sum, f) => sum + f.size, 0);
    // The current OfflineMapStore validation materializes every asset in RAM.
    // Until streaming validation lands, use a smaller defensive network budget.
    if (total > 64 * 1024 * 1024 || files.some((f) => f.size > 48 * 1024 * 1024))
      return fail('package-too-large', 'Instalacao por URL limitada a 64 MiB nesta etapa; use importacao local para regioes maiores');
    if (total !== manifest.totalBytes) return fail('size-mismatch', 'Tamanho total difere dos artefatos declarados');
    try {
      const profile = await getDeviceStorageProfile();
      if (profile.maxLimit > 0 && (profile.safeLimit < total || profile.freeSpace < total))
        return fail('insufficient-space', 'Espaço local insuficiente para instalar o mapa');
    } catch { return fail('storage-unavailable', 'Não foi possível verificar o armazenamento'); }
    const hashes = [...new Set(files.map((f) => f.sha256.toLowerCase()))];
    const signature = [manifest.version, manifest.packageVersion, ...files.map((f) => f.sha256)].join(':');
    let existing;
    try { existing = await this.chunks.getSession(params.packageId); }
    catch { return fail('storage-unavailable', 'Nao foi possivel recuperar checkpoints'); }
    if (existing && existing.manifestSha !== signature) {
      if (!params.forceValidate)
        return fail('outdated-checkpoint', 'Download anterior e de outra versao; forceValidate precisa ser autorizado');
      try {
        for (const hash of existing.hashes) await this.chunks.deleteAsset(hash);
        await this.chunks.clearSession(params.packageId);
      } catch { return fail('storage-unavailable', 'Nao foi possivel descartar staging anterior'); }
    }
    this.active = new AbortController();
    const signal = this.active.signal;
    try {
      await this.chunks.setSession({ packageId: params.packageId, manifestSha: signature,
        hashes, totalBytes: total });
      const assets = new Map<string, Blob>();
      let already = 0;
      let reported = 0;
      for (const file of files) {
        const downloadUrl = new URL(file.path, base).href;
        const blob = await downloadVerifiedAsset({
          url: downloadUrl, sha256: file.sha256, size: file.size, store: this.chunks,
          signal, onProgress: (p: { downloadedBytes: number }) => {
            reported = already + p.downloadedBytes;
            params.onProgress?.({ status: 'downloading', percent: Math.round(reported / total * 100),
              message: `Baixando ${file.path}`, downloadedBytes: reported, totalBytes: total,
              speed: 0, eta: 0, checkpoint: reported, lastCheckpoint: reported,
              abort: () => this.abortInstall(),
            });
          },
        });
        assets.set(file.target, blob);
        already += file.size;
      }
      params.onProgress?.({ status: 'validating', percent: 100, message: 'Validando arquivos',
        downloadedBytes: total, totalBytes: total, speed: 0, eta: 0,
        checkpoint: total, lastCheckpoint: total, abort: () => this.abortInstall() });
      const validation = await validateOfflinePackage(manifest, assets);
      if (!validation.ok) return fail(validation.code, validation.detail);
      if (signal.aborted) return fail('aborted', 'Instalação cancelada');
      // The existing IndexedDB package store stages and activates in transactions,
      // leaving the old active map available if validation or writes fail.
      await offlineMapStore.install(manifest, assets);
      // Removing obsolete checkpoints is best-effort; installation already
      // committed and must not be reported as failed due to garbage collection.
      try {
        for (const hash of hashes) await this.chunks.deleteAsset(hash);
        await this.chunks.clearSession(params.packageId);
      } catch { /* Safe to retry orphan cleanup later. */ }
      params.onProgress?.({ status: 'active', percent: 100, message: 'Regiao instalada',
        downloadedBytes: total, totalBytes: total, speed: 0, eta: 0,
        checkpoint: total, lastCheckpoint: total, abort: () => undefined });
      return { success: true, data: { installId: `${params.packageId}:${manifest.archive.sha256}`, status: 'active' } };
    } catch (e) {
      const code = e instanceof DownloadIntegrityError ? e.code : 'install-failed';
      return fail(code, e instanceof Error ? e.message : 'Falha ao instalar região', code === 'network-error');
    } finally { this.active = null; }
  }
  abortInstall(): void { this.active?.abort(); }
}
export default ResumableInstaller;
