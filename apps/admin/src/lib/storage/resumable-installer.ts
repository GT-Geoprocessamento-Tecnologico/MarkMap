/**
 * MM-MAP-130: remote regional installer. Downloaded chunks remain in a separate
 * IndexedDB until checksums, manifest and MapLibre-local paths are verified.
 * Runtime package activation is delegated to the existing OfflineMapStore.
 */
import { getDeviceStorageProfile } from './device-storage-profile';
import { type LargeBlobStore, type StoreResult, createBlobStoreError } from './large-blob-store';
import { offlineMapPackageManifestSchema, type OfflineMapPackageManifest } from '@markmap/contracts';
import { validateOfflinePackage, OFFLINE_PACKAGE_QUOTA } from '@markmap/maps/offline/package';
import { offlineMapStore, StaleRegionGenerationError } from './offline-map-store';
import { RegionDownloadCheckpoints } from './region-download-checkpoints';
import { withRegionInstallLock } from './region-install-lock.mjs';
import { downloadVerifiedAsset, DownloadIntegrityError } from './verified-range-download.mjs';
import { isRegionalQuotaError } from './region-install-feedback.mjs';

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
  /** Optional UI cancellation, including reads before the download begins. */
  signal?: AbortSignal;
  /** CAS of the currently installed generation for explicit version updates. */
  expectedActiveGeneration?: string;
}
export interface Checkpoint {
  id: string;
  timestamp: string;
  downloadedBytes: number;
  totalBytes: number | null;
  speed: number;
  eta: number;
}
export interface ResumeResult { canResume: boolean; checkpoint: Checkpoint | null; reason?: string; needsConfirmation?: boolean; }

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

function manifestSignature(manifest: OfflineMapPackageManifest): string {
  const refs = [manifest.style, ...manifest.glyphs, ...manifest.sprites,
    ...(manifest.searchShards ?? []), ...(manifest.routingGraph ? [manifest.routingGraph] : []),
    ...(manifest.contourLines ? [manifest.contourLines] : []),
    ...(manifest.wikipediaPack ? [manifest.wikipediaPack] : []),
    ...(manifest.transitPack ? [manifest.transitPack] : []),
    ...(manifest.demGrid ? [manifest.demGrid] : [])];
  return [manifest.version, manifest.packageVersion, manifest.archive.sha256,
    ...refs.map((ref) => ref.blob.sha256)].join(':');
}

export class ResumableInstaller {
  private readonly chunks = new RegionDownloadCheckpoints();
  private active: AbortController | null = null;
  private installing = false;
  // Constructor kept for compatibility with RegionManager; all durable data
  // lives in OfflineMapStore and RegionDownloadCheckpoints, not LargeBlobStore.
  constructor(_blobStore: LargeBlobStore | null = null, _isCapacitor?: boolean) {}

  async init(): Promise<{ success: boolean; error?: string }> {
    try { await getDeviceStorageProfile(); return { success: true }; }
    catch (e) { return { success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }; }
  }
  async checkResume(packageId: string, manifest?: OfflineMapPackageManifest): Promise<ResumeResult> {
    try {
      const session = await this.chunks.getSession(packageId);
      if (!session) return { canResume: false, checkpoint: null, reason: 'Nenhum download interrompido' };
      if (manifest && (manifest.id !== packageId || session.manifestSha !== manifestSignature(manifest)))
        return { canResume: false, checkpoint: null,
          reason: 'Há blocos de outra versão; confirme a nova versão antes de substituir o download salvo.', needsConfirmation: true };
      // Legacy sessions have no expected sizes; resume still works from the
      // manifest but cannot report a trusted preflight count yet.
      if (!session.assets?.length)
        return { canResume: false, checkpoint: null,
          reason: 'Abra novamente a fonte do mapa para validar os blocos antigos e retomar.' };
      const downloadedBytes = await this.chunks.getDownloadedBytes(session.assets);
      if (downloadedBytes <= 0 || downloadedBytes > session.totalBytes)
        return { canResume: false, checkpoint: null, reason: 'Sem blocos completos para retomar' };
      return { canResume: true, checkpoint: {
        id: session.manifestSha, timestamp: session.updatedAt, downloadedBytes,
        totalBytes: session.totalBytes, speed: 0, eta: 0,
      } };
    } catch (e) { return { canResume: false, checkpoint: null, reason: e instanceof Error ? e.message : 'Falha no checkpoint' }; }
  }
  async startInstall(params: InstallParams): Promise<StoreResult<{ installId: string; status: InstallerStatus }>> {
    if (params?.signal?.aborted) return fail('aborted', 'Instalação cancelada', true);
    if (this.installing || this.active) return fail('install-busy', 'Já existe uma instalação em andamento');
    if (!params || typeof params.packageId !== 'string' ||
        !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(params.packageId))
      return fail('invalid-manifest', 'ID da região inválido');

    // Web Locks are per-origin across tabs. If unavailable, retain the
    // existing generation-ID transactional guard and single-instance lock.
    this.installing = true;
    try {
      const lock = await withRegionInstallLock(params.packageId, () => this.installWithLock(params));
      if (!lock.acquired)
        return fail('install-busy-other-tab', 'Outra aba está instalando esta região', true);
      return lock.result;
    } catch (error) {
      return fail('install-lock-failed',
        error instanceof Error ? error.message : 'Não foi possível coordenar a instalação', true);
    } finally {
      this.installing = false;
    }
  }

  private async installWithLock(params: InstallParams): Promise<StoreResult<{ installId: string; status: InstallerStatus }>> {
    if (params.signal?.aborted) return fail('aborted', 'Instalação cancelada', true);
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
    // Check under the existing per-region Web Lock, before changing checkpoints
    // or transferring bytes. Activation rechecks atomically in IndexedDB.
    if (params.expectedActiveGeneration !== undefined) {
      if (!/^[a-z0-9-]{8,80}$/i.test(params.expectedActiveGeneration))
        return fail('stale-active-generation', 'A revisão local não é válida. Consulte novamente.');
      try {
        const revision = await offlineMapStore.getActiveRevision(params.packageId);
        if (revision?.generation !== params.expectedActiveGeneration)
          return fail('stale-active-generation', 'Outra aba modificou este mapa. Consulte novamente.');
      } catch { return fail('storage-unavailable', 'Não foi possível confirmar a revisão local.'); }
    }
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
    // Integrity is verified per chunk and via bounded Blob slices. The
    // application-wide budget remains the canonical 250 MiB (not a promise of
    // physical availability: preflight and IndexedDB quota can still reject).
    if (!Number.isSafeInteger(total) || total <= 0 || total > OFFLINE_PACKAGE_QUOTA ||
        files.some((f) => !Number.isSafeInteger(f.size) || f.size <= 0 || f.size > OFFLINE_PACKAGE_QUOTA))
      return fail('package-too-large', 'Pacote excede o limite agregado de 250 MiB para mapas offline');
    if (total !== manifest.totalBytes) return fail('size-mismatch', 'Tamanho total difere dos artefatos declarados');
    const hashes = [...new Set(files.map((f) => f.sha256.toLowerCase()))];
    const expectedAssets = files.map((f) => ({ sha256: f.sha256.toLowerCase(), size: f.size }));
    const signature = manifestSignature(manifest);
    let existing;
    try { existing = await this.chunks.getSession(params.packageId); }
    catch { return fail('storage-unavailable', 'Não foi possível recuperar checkpoints'); }
    if (params.signal?.aborted) return fail('aborted', 'Instalação cancelada', true);
    if (existing && existing.manifestSha !== signature && !params.forceValidate)
      return fail('outdated-checkpoint', 'Download anterior é de outra versão. Revalide a fonte antes de substituir o checkpoint');

    let resumedBytes = 0;
    if (existing?.manifestSha === signature) {
      try {
        const bytes = await this.chunks.getDownloadedBytes(expectedAssets);
        if (bytes >= 0 && bytes <= total) resumedBytes = bytes;
      } catch { return fail('storage-unavailable', 'Não foi possível contabilizar o download parcial'); }
    }
    // Until the new generation commits, the active map AND downloaded chunks coexist.
    // Preflight is conservative; the IndexedDB stage transaction re-checks its own budget.
    const additionalBytes = total + (total - resumedBytes);
    try {
      const [profile, budget] = await Promise.all([
        getDeviceStorageProfile(), offlineMapStore.installationBudget(params.packageId),
      ]);
      if (budget.availableBytes < total)
        return fail('app-budget-exceeded', `A região exige ${Math.ceil(total / 1048576)} MiB adicionais; restam ${Math.floor(budget.availableBytes / 1048576)} MiB no orçamento de mapas offline`);
      if (profile.maxLimit > 0 && profile.safeLimit < additionalBytes)
        return fail('insufficient-space', `A instalação exige até ${Math.ceil(additionalBytes / 1048576)} MiB adicionais para download e ativação; libere espaço sem apagar seus projetos`, true);
    } catch { return fail('storage-unavailable', 'Não foi possível verificar o armazenamento'); }
    if (params.signal?.aborted) return fail('aborted', 'Instalação cancelada', true);
    if (existing && existing.manifestSha !== signature) {
      try {
        // Hashes can be shared by another region. Only unreferenced chunks
        // may be removed, atomically with the old session deletion.
        await this.chunks.finishSession(params.packageId);
      } catch { return fail('storage-unavailable', 'Não foi possível descartar staging anterior'); }
    }
    if (params.signal?.aborted) return fail('aborted', 'Instalação cancelada', true);
    this.active = new AbortController();
    const cancelActive = () => this.active?.abort();
    params.signal?.addEventListener('abort', cancelActive, { once: true });
    if (params.signal?.aborted) cancelActive();
    const signal = this.active.signal;
    try {
      await this.chunks.setSession({ packageId: params.packageId, manifestSha: signature,
        hashes, totalBytes: total, assets: expectedAssets });
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
      params.onProgress?.({ status: 'activating', percent: 100,
        message: 'Ativando mapa validado', downloadedBytes: total, totalBytes: total,
        speed: 0, eta: 0, checkpoint: total, lastCheckpoint: total,
        abort: () => undefined });
      await offlineMapStore.install(manifest, assets, params.expectedActiveGeneration);
      // Removing obsolete checkpoints is best-effort; installation already
      // committed and must not be reported as failed due to garbage collection.
      try {
        await this.chunks.finishSession(params.packageId);
      } catch { /* Safe to retry orphan cleanup later. */ }
      params.onProgress?.({ status: 'active', percent: 100, message: 'Regiao instalada',
        downloadedBytes: total, totalBytes: total, speed: 0, eta: 0,
        checkpoint: total, lastCheckpoint: total, abort: () => undefined });
      return { success: true, data: { installId: `${params.packageId}:${manifest.archive.sha256}`, status: 'active' } };
    } catch (e) {
      const code = signal.aborted ? 'aborted' :
        e instanceof StaleRegionGenerationError ? e.code :
        e instanceof DownloadIntegrityError ? e.code :
        isRegionalQuotaError(e) ? 'insufficient-space' : 'install-failed';
      return fail(code, e instanceof Error ? e.message : 'Falha ao instalar região',
        code === 'network-error' || code === 'insufficient-space' || code === 'aborted');
    } finally {
      params.signal?.removeEventListener('abort', cancelActive);
      this.active = null;
    }
  }
  abortInstall(): void { this.active?.abort(); }
}
export default ResumableInstaller;
