/**
 * ResumableInstaller - Instalador resumível de pacotes regionais
 *
 * Fornece operações de download resumível, checkpoint, retry idempotente,
 * staging, validação e activate atômico. Este módulo é o MM-MAP-130 da
 * sequência Maps Engine v2 offline.
 *
 * Regras de projeto:
 * - Download sempre em staging, nunca sobre o pacote ativo
 * - Checkpoint a cada X MB ou Y segundos
 * - Retry idempotente: pode ser seguramente refeito sem efeito colateral
 * - Ativação atômica: manter pacote antigo ativo até novo ser validado
 * - Nunca apagar pacote ativo antes da validação do novo
 */

import { getDeviceStorageProfile } from "./device-storage-profile";
import { type LargeBlobStore, type StoreResult, createBlobStoreError } from "./large-blob-store";
import { offlineMapPackageManifestSchema, type OfflineMapPackageManifest } from "@geonexo/contracts";

/** Status do instalador */
export type InstallerStatus = "idle" | "downloading" | "validating" | "activating" | "active" | "rollback" | "error";

export interface InstallerProgress {
  status: InstallerStatus;
  percent: number; // 0-100
  message: string;
  downloadedBytes: number;
  totalBytes: number | null;
  speed: number; // bytes por segundo
  eta: number; // segundos
  checkpoint: number; // bytes no checkpoint atual
  lastCheckpoint: number; // bytes no último checkpoint salvo
  abort: () => void;
}

/** Result of installer operation */
export type InstallerResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };

};

/**
 * Manifest usado pelo instalador: manifest do pacote regional mais os dados de
 * download que só existem em tempo de instalação (`archivePath` e `totalBytes`).
 */
export type InstallManifest = OfflineMapPackageManifest & {
  /** Caminho do arquivo de archiver dentro do pacote (usado na validação) */
  archivePath: string;
  /** Tamanho total do download em bytes */
  totalBytes: number;
};

/** Parâmetros de instalação */
export interface InstallParams {
  packageId: string;
  manifest: InstallManifest;
  onProgress?: (progress: InstallerProgress) => void;
  /** Se verdadeiro, força validação mesmo com checkpoint existente */
  forceValidate: boolean;
}

/** Checkpoint info */
export interface Checkpoint {
  id: string;
  timestamp: string;
  downloadedBytes: number;
  totalBytes: number | null;
  speed: number;
  eta: number;
}

/** Result of resume check */
export interface ResumeResult {
  canResume: boolean;
  checkpoint: Checkpoint | null;
  reason?: string;
}

/** Instalador resumível principal */
export class ResumableInstaller {
  constructor(_blobStore: LargeBlobStore | null = null, _isCapacitor?: boolean) {}

  /** Verifica disponibilidade do storage, sem iniciar uma instalação. */
  async init(): Promise<{ success: boolean; error?: string }> {
    try {
      await getDeviceStorageProfile();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Não declarar retomada possível até que checkpoints sejam persistidos e
   * vinculados ao checksum do arquivo. Enumerar um staging não comprova bytes.
   */
  async checkResume(_packageId: string): Promise<ResumeResult> {
    return { canResume: false, checkpoint: null, reason: "Checkpoint verificável ainda não implementado" };
  }

  /**
   * Fail closed: o instalador anterior apenas simulava bytes/progresso,
   * validava um Uint8Array vazio e podia ativar um staging sem mapa real.
   * O contrato InstallParams ainda não contém URL/fonte de dados verificável.
   */
  async startInstall(params: InstallParams): Promise<StoreResult<{ installId: string; status: InstallerStatus }>> {
    const parsed = offlineMapPackageManifestSchema.safeParse(params.manifest);
    if (!parsed.success) {
      return {
        success: false,
        error: createBlobStoreError("invalid-manifest", "Manifest inválido", false),
      };
    }

    // Nenhum staging/ativação/indicação de sucesso até existir transferência real
    // com HTTP Range, checksum e validateOfflinePackage sobre os bytes recebidos.
    return {
      success: false,
      error: createBlobStoreError(
        "download-not-implemented",
        "Download regional ainda não implementado. Nenhum dado foi alterado.",
        false,
      ),
    };
  }

  abortInstall(): void {
    // Sem transferências em andamento neste adapter.
  }
}

export default ResumableInstaller;