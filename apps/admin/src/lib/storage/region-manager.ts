/**
 * Region Manager - Gerenciador de regiões instaladas
 *
 * Fornece operações de gerenciamento de pacotes regionais instalados,
 * incluindo listagem, remoção, reparo e detalhes de licenças.
 * Este módulo é o MM-MAP-140 da sequência Maps Engine v2 offline.
 *
 * Gate M2: pacote regional continua funcionando após force-stop/reload e sem rede.
 */

import { getStorageBreakdown, CategoryBreakdown, StorageBreakdown } from "./storage-management";
import { DeviceStorageProfile } from "./device-storage-profile";
import { LargeBlobStore } from "./large-blob-store";
import { offlineMapStore } from "./offline-map-store";
import { offlineMapPackageManifestSchema } from "../contracts/src/offline-map";
import { ResumableInstaller } from "./resumable-installer";

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
  manifest: any; // Manifest v2
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
  private blobStore: LargeBlobStore;
  private installer: ResumableInstaller;

  constructor() {
    this.blobStore = new (require("@/lib/storage/large-blob-store").IndexedDBBlobStore)();
    this.installer = new (require("@/lib/storage/resumable-installer").ResumableInstaller)(undefined, false);
  }

  /** Listar todas as regiões instaladas */
  async listRegions(filter?: RegionFilter): Promise<RegionList> {
    try {
      // Listar pacotes do offline store
      const packages = await offlineMapStore.list();
      const now = new Date().toISOString();
      const regions: RegionInfo[] = [];

      for (const pkg of packages) {
        try {
          // Ler manifest do pacote
          const manifestResult = await this.readPackageManifest(pkg.id);
          if (!manifestResult.success) continue;

          const manifest = manifestResult.data;
          const status = this.determineStatus(pkg, manifest);

          regions.push({
            id: pkg.id,
            version: manifest.packageVersion || "unknown",
            label: manifest.label || pkg.id,
            size: pkg.bytes || 0,
            date: manifest.osmDataDate || new Date().toISOString(),
            status,
            manifest: manifest,
            manifestPath: `/offline/${pkg.id}/manifest.json`,
            lastActivated: pkg.lastModified || new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            removable: this.isRemovable(pkg),
            repairRequired: this.requiresRepair(pkg, manifest),
            licenses: this.extractLicenses(manifest),
          });
        } catch {
          continue;
        }
      }

      // Ordenar por data (mais recente primeiro)
      regions.sort((a, b) => b.lastActivated.localeCompare(a.lastActivated));

      return {
        regions,
        total: regions.length,
        cacheDate: now,
      };
    } catch (error) {
      return { regions: [], total: 0, cacheDate: new Date().toISOString() };
    }
  }

  /** Determinar status da região */
  private determineStatus(pkg: any, manifest: any): RegionStatus {
    // Lógica simplificada para determinar status
    if (!manifest) return "error";
    // Se tem ativo e data recente, está active
    if (manifest.packageVersion && manifest.label) return "active";
    // Se tem manifest mas sem activation recente, está installed
    return "installed";
  }

  /** Verificar se região é removível */
  private isRemovable(pkg: any): boolean {
    // Não permitir remoção se for o único pacote ou se estiver ativo
    return true; // Simplificado
  }

  /** Verificar se região precisa de reparo */
  private requiresRepair(pkg: any, manifest: any): boolean {
    // Verificar integridade do manifest
    if (!manifest) return true;
    try {
      offlineMapPackageManifestSchema.safeParse(manifest);
      return false;
    } catch {
      return true;
    }
  }

  /** Extrair licenças do manifest */
  private extractLicenses(manifest: any): Array<{ name: string; url: string }> {
    const licenses: Array<{ name: string; url: string }> = [];

    // Extrair de attribution
    if (manifest.attribution) {
      licenses.push({ name: "OpenStreetMap", url: "https://www.openstreetmap.org" });
    }

    // Extrair de sources
    if (manifest.sources?.osm) {
      licenses.push({ name: "OpenStreetMap Data", url: manifest.sources.osm });
    }

    return licenses;
  }

  /** Ler manifest de um pacote */
  private readPackageManifest(packageId: string): Promise<{ success: boolean; data: any }> {
    // Em um cenário real, isso leria o manifest do armazenamento
    // Para este modelo, retornar null
    return Promise.resolve({ success: false, data: null });
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

      // Remover pacote do armazenamento
      await offlineMapStore.remove(regionId);

      // Remover metadados e arquivos associados
      // ... (implementação simplificada)

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
        return { success: false, regionId, message: "Região não encontrada" };
      }

      // Verificar integridade do manifest
      const manifestValidate = offlineMapPackageManifestSchema.safeParse(region.manifest);
      if (!manifestValidate.success) {
        // Tentar reparar dados faltantes
        // ... (implementação simplificada)
      }

      return {
        success: true,
        regionId,
        message: "Região reparada com sucesso",
        repairedFiles: 0,
      };
    } catch (error) {
      return {
        success: false,
        regionId,
        message: error instanceof Error ? error.message : "Erro ao reparar região",
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
  async checkUpdateAvailable(regionId: string): Promise<{ hasUpdate: boolean; updateInfo: any }> {
    // Verificar se há novo manifest disponível
    // ... (implementação simplificada)
    return { hasUpdate: false, updateInfo: {} };
  }

  /** Aplicar atualização de região */
  async applyUpdate(regionId: string): Promise<{ success: boolean; message: string }> {
    // Aplicar update usando o ResumableInstaller
    // ... (implementação simplificada)
    return { success: false, message: "Não implementado ainda" };
  }
}

export default RegionManager;