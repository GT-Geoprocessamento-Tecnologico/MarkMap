/**
 * Region Manager - Gerenciador de regiões instaladas
 *
 * Fornece operações de gerenciamento de pacotes regionais instalados,
 * incluindo listagem, remoção, reparo e detalhes de licenças.
 * Este módulo é o MM-MAP-140 da sequência Maps Engine v2 offline.
 *
 * Gate M2: pacote regional continua funcionando após force-stop/reload e sem rede.
 */

import { offlineMapStore } from "./offline-map-store";
import { offlineMapPackageManifestSchema, type OfflineMapPackageManifest } from "@markmap/contracts";
import { getSelectedOfflineMapId } from "./offline-map-selection";
import { validateOfflinePackage } from "@markmap/maps/offline/package";
import { fetchRemoteRegionManifest } from './remote-region-manifest.mjs';
import { ResumableInstaller } from './resumable-installer';
import { getRegionSourceUrl } from './region-source-registry';
import { compareRegionVersions } from './region-version';
import { fingerprintRegionManifest, matchesRegionUpdatePreview, type RegionUpdatePreview } from './region-update-identity.mjs';
export type { RegionUpdatePreview } from './region-update-identity.mjs';
import { version as appVersion } from '../../../package.json';

/** Tipo de operação de região */
export type RegionOperation = "list" | "remove" | "repair" | "details";

/** Status da região */
export type RegionStatus = "installed" | "updating" | "active" | "error" | "removed";

export interface RegionInfo {
  id: string;
  version: string;
  label: string;
  size: number; // bytes
  date: string; // data da fonte OSM
  status: RegionStatus;
  manifest: OfflineMapPackageManifest; // Manifest v2
  manifestPath: string;
  lastActivated: string;
  lastUsed: string;
  offlineSince?: string; // desde quando está offline
  removable: boolean;
  repairRequired: boolean;
  licenses: Array<{ name: string; url: string }>;
}

/** Filtros de listagem de regiões */
export interface RegionFilter {
  status?: RegionStatus;
  search?: string; // busca por label ou id
  minSize?: number;
  maxSize?: number;
}

/** Resultado da listagem de regiões */
export interface RegionList {
  regions: RegionInfo[];
  total: number;
  cacheDate: string;
}

/** Resultado da operação de remoção */
export interface RemoveResult {
  success: boolean;
  regionId: string;
  freedBytes: number;
  message: string;
}

/** Resultado da operação de reparo */
export interface RepairResult {
  success: boolean;
  regionId: string;
  message: string;
  repairedFiles: number;
}

/** Gerenciador de regiões */
export class RegionManager {
  /** Listar todas as regiões instaladas */
  async listRegions(filter?: RegionFilter): Promise<RegionList> {
    try {
      // Listar pacotes do offline store
      const packages = await offlineMapStore.list();
      const now = new Date().toISOString();
      const regions: RegionInfo[] = [];

      for (const pkg of packages) {
        try {
          const manifest = pkg.manifest;
          const status: RegionStatus = getSelectedOfflineMapId() === manifest.id ? 'active' : 'installed';

          regions.push({
            id: manifest.id,
            version: manifest.packageVersion || manifest.version,
            label: manifest.label || manifest.id,
            size: manifest.totalBytes || (manifest.archive.bytes + manifest.style.blob.bytes + manifest.glyphs.reduce((n: number, a: { blob: { bytes: number } }) => n + a.blob.bytes, 0) + manifest.sprites.reduce((n: number, a: { blob: { bytes: number } }) => n + a.blob.bytes, 0)),
            date: manifest.osmDataDate || pkg.installedAt,
            status,
            manifest: manifest,
            manifestPath: `/offline/${manifest.id}/manifest.json`,
            lastActivated: pkg.installedAt,
            lastUsed: pkg.installedAt,
            removable: status !== 'active',
            repairRequired: this.requiresRepair(manifest),
            licenses: this.extractLicenses(manifest),
          });
        } catch {
          continue;
        }
      }

      // Ordenar por data (mais recente primeiro)
      regions.sort((a, b) => b.lastActivated.localeCompare(a.lastActivated));

      const filtered = this.applyFilter(regions, filter);

      return {
        regions: filtered,
        total: filtered.length,
        cacheDate: now,
      };
    } catch (error) {
      return { regions: [], total: 0, cacheDate: new Date().toISOString() };
    }
  }

  /** Aplicar filtros de listagem sobre o conjunto completo de regiões */
  private applyFilter(regions: RegionInfo[], filter?: RegionFilter): RegionInfo[] {
    if (!filter) return regions;

    let result = regions;

    if (filter.status !== undefined) {
      result = result.filter((region) => region.status === filter.status);
    }

    if (filter.search) {
      const query = filter.search.trim().toLowerCase();
      if (query) {
        result = result.filter(
          (region) =>
            region.label.toLowerCase().includes(query) ||
            region.id.toLowerCase().includes(query),
        );
      }
    }

    if (filter.minSize !== undefined) {
      result = result.filter((region) => region.size >= (filter.minSize ?? 0));
    }

    if (filter.maxSize !== undefined) {
      result = result.filter((region) => region.size <= (filter.maxSize ?? Number.MAX_SAFE_INTEGER));
    }

    return result;
  }

  /** Verificar se região precisa de reparo */
  private requiresRepair(manifest: OfflineMapPackageManifest): boolean {
    // Verificar integridade do manifest
    if (!manifest) return true;
    return !offlineMapPackageManifestSchema.safeParse(manifest).success;
  }

  /** Extrair licenças do manifest */
  private extractLicenses(manifest: OfflineMapPackageManifest): Array<{ name: string; url: string }> {
    const licenses: Array<{ name: string; url: string }> = [];

    // Mostrar as atribuições reais do pacote, não atribuir OSM a qualquer origem.
    for (const attribution of manifest.sources?.attributions ?? []) {
      if (attribution.name && attribution.url) {
        licenses.push({ name: attribution.name, url: attribution.url });
      }
    }
    return licenses;
  }

  /** Remover uma região instalada */
  async removeRegion(regionId: string): Promise<RemoveResult> {
    try {
      // Verificar se pode remover
      const list = await this.listRegions();
      const region = list.regions.find((r) => r.id === regionId);
      if (!region) {
        return { success: false, regionId, freedBytes: 0, message: "Região não encontrada" };
      }

      if (!region.removable) {
        return { success: false, regionId, freedBytes: 0, message: "A regiao ativa nao pode ser removida. Selecione outra primeiro." };
      }
      await offlineMapStore.remove(regionId);

      return {
        success: true,
        regionId,
        freedBytes: region.size,
        message: `Região ${region.label} removida com sucesso`,
      };
    } catch (error) {
      return {
        success: false,
        regionId,
        freedBytes: 0,
        message: error instanceof Error ? error.message : "Erro ao remover região",
      };
    }
  }

  /** Reparar uma região instalada */
  async repairRegion(regionId: string): Promise<RepairResult> {
    try {
      // Listar região para obter info
      const list = await this.listRegions();
      const region = list.regions.find((r) => r.id === regionId);
      if (!region) {
        return { success: false, regionId, message: "Região não encontrada", repairedFiles: 0 };
      }

      const manifestValidate = offlineMapPackageManifestSchema.safeParse(region.manifest);
      if (!manifestValidate.success) {
        return { success: false, regionId,
          message: "Manifest invalido. Reinstale a regiao a partir de fonte confiavel.", repairedFiles: 0 };
      }
      const manifest = manifestValidate.data;
      const assets = new Map<string, Blob>();
      const refs = [manifest.style, ...manifest.glyphs, ...manifest.sprites,
        ...(manifest.searchShards ?? []),
        ...(manifest.routingGraph ? [manifest.routingGraph] : []),
        ...(manifest.contourLines ? [manifest.contourLines] : []),
        ...(manifest.wikipediaPack ? [manifest.wikipediaPack] : []),
        ...(manifest.transitPack ? [manifest.transitPack] : []),
        ...(manifest.demGrid ? [manifest.demGrid] : [])];
      for (const path of ['package.pmtiles', ...refs.map((ref) => ref.path)]) {
        const blob = await offlineMapStore.asset(regionId, path);
        if (!blob) return { success: false, regionId, message: `Arquivo ausente no pacote: ${path}`, repairedFiles: 0 };
        assets.set(path, blob);
      }
      const verified = await validateOfflinePackage(manifest, assets);
      if (!verified.ok) return { success: false, regionId,
        message: `Falha de integridade: ${verified.code}. Reinstale a regiao.`, repairedFiles: 0 };
      return { success: true, regionId,
        message: "Integridade do pacote verificada; nenhum reparo necessario", repairedFiles: 0 };
    } catch (error) {
      return {
        success: false,
        regionId,
        message: error instanceof Error ? error.message : "Erro ao reparar região",
        repairedFiles: 0,
      };
    }
  }

  /** Obter detalhes de uma região */
  async getRegionDetails(regionId: string): Promise<{ success: boolean; region: RegionInfo | null }> {
    try {
      const list = await this.listRegions();
      const region = list.regions.find((r) => r.id === regionId);
      if (!region) {
        return { success: false, region: null };
      }
      return { success: true, region };
    } catch (error) {
      return { success: false, region: null };
    }
  }

  /** Check a user-configured HTTPS manifest without modifying installed data. */
  async checkUpdateAvailable(regionId: string): Promise<{ hasUpdate: boolean; updateInfo: Record<string, unknown> }> {
    const unavailable = (reason: string) => ({ hasUpdate: false, updateInfo: { status: 'unavailable', reason } });
    const installed = await offlineMapStore.getActiveRevision(regionId).catch(() => null);
    if (!installed) return unavailable('Região não encontrada neste dispositivo.');
    const source = getRegionSourceUrl(regionId);
    if (!source) return unavailable('Instale a região a partir de uma URL HTTPS para ativar atualizações.');
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
      return unavailable('Conecte-se para consultar novas versões. O mapa instalado permanece offline.');
    try {
      const remote = await fetchRemoteRegionManifest(source);
      const parsed = offlineMapPackageManifestSchema.safeParse(remote.manifest);
      if (!parsed.success || parsed.data.id !== regionId)
        return unavailable('Manifest remoto incompatível ou de outra região.');
      const current = installed.manifest;
      const next = parsed.data;
      const order = compareRegionVersions(next.packageVersion, current.packageVersion);
      if (order === null) return unavailable('Versões regionais precisam seguir MAJOR.MINOR.PATCH.');
      if (order <= 0) return { hasUpdate: false, updateInfo: {
        status: order < 0 ? 'older' : 'current', installedVersion: current.packageVersion,
        availableVersion: next.packageVersion,
      } };
      const compatibility = compareRegionVersions(next.minimumCompatibleVersion, appVersion);
      if (compatibility === null || compatibility > 0)
        return unavailable('Este mapa exige um protocolo de aplicativo mais recente. Atualize o MarkMap primeiro.');
      return { hasUpdate: true, updateInfo: {
        status: 'available', installedVersion: current.packageVersion,
        availableVersion: next.packageVersion, bytes: next.totalBytes,
        sourceUrl: source, manifestFingerprint: fingerprintRegionManifest(next),
        installedGeneration: installed.generation,
      } };
    } catch (cause) {
      return unavailable(cause instanceof Error ? cause.message : 'Falha ao consultar o catálogo regional.');
    }
  }

  /** Apply only after an explicit click. The installer verifies all bytes before activation. */
  async applyUpdate(regionId: string, expected?: RegionUpdatePreview): Promise<{ success: boolean; message: string }> {
    if (!expected) return { success: false, message: 'Consulte a nova versão antes de confirmar uma atualização.' };
    const source = getRegionSourceUrl(regionId);
    if (!source || source !== expected.sourceUrl) return { success: false, message: 'Fonte alterada. Consulte novamente antes de atualizar.' };
    try {
      const remote = await fetchRemoteRegionManifest(source);
      const manifest = offlineMapPackageManifestSchema.parse(remote.manifest);
      const installed = await offlineMapStore.getActiveRevision(regionId);
      if (!installed || manifest.id !== regionId ||
          compareRegionVersions(manifest.packageVersion, installed.manifest.packageVersion) !== 1 ||
          (compareRegionVersions(manifest.minimumCompatibleVersion, appVersion) ?? 1) > 0 ||
          !matchesRegionUpdatePreview(manifest, source, installed.manifest.packageVersion, expected, installed.generation))
        return { success: false, message: 'A versão, origem ou algum arquivo mudou. Consulte novamente antes de instalar.' };
      const installer = new ResumableInstaller();
      const result = await installer.startInstall({ packageId: regionId,
        manifest: { ...manifest, archivePath: 'package.pmtiles' },
        baseUrl: remote.baseUrl, forceValidate: true,
        expectedActiveGeneration: expected.installedGeneration });
      return result.success
        ? { success: true, message: `Região ${manifest.label} atualizada para ${manifest.packageVersion}.` }
        : { success: false, message: result.error.message };
    } catch (cause) {
      return { success: false, message: cause instanceof Error ? cause.message : 'Falha ao atualizar região.' };
    }
  }

}

export default RegionManager;