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
import { offlineMapPackageManifestSchema, type OfflineMapPackageManifest } from "@geonexo/contracts";
import { getSelectedOfflineMapId } from "./offline-map-selection";
import { validateOfflinePackage } from "@geonexo/maps/offline/package";

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
            size: manifest.totalBytes || (manifest.archive.bytes + manifest.style.blob.bytes + manifest.glyphs.reduce((n, a) => n + a.blob.bytes, 0) + manifest.sprites.reduce((n, a) => n + a.blob.bytes, 0)),
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
        ...(manifest.transitPack ? [manifest.transitPack] : [])];
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

  /** Verificar se há atualização disponível para uma região */
  async checkUpdateAvailable(_regionId: string): Promise<{ hasUpdate: boolean; updateInfo: Record<string, unknown> }> {
    // Verificar se há novo manifest disponível
    // ... (implementação simplificada)
    return { hasUpdate: false, updateInfo: { status: "unavailable", reason: "Catálogo de atualizações ainda não integrado" } };
  }

  /** Aplicar atualização de região */
  async applyUpdate(_regionId: string): Promise<{ success: boolean; message: string }> {
    // Aplicar update usando o ResumableInstaller
    // ... (implementação simplificada)
    return { success: false, message: "Não implementado ainda" };
  }
}

export default RegionManager;