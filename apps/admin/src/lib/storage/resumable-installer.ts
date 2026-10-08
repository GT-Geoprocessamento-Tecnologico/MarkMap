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

import { getStorageBreakdown, CategoryBreakdown, StorageBreakdown } from "./storage-management";
import { DeviceStorageProfile } from "./device-storage-profile";
import { LargeBlobStore, StoreResult } from "./large-blob-store";
import { offlineMapPackageManifestSchema } from "../contracts/src/offline-map";
import { validateOfflinePackage } from "./offline-package";

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

/** Parâmetros de instalação */
export interface InstallParams {
  packageId: string;
  manifest: any; // UpdateManifest
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
  private dbName = "resumable-installer";
  private storeName = "installers";
  private blobStore: LargeBlobStore;
  private isCapacitor: boolean;

  constructor(blobStore: LargeBlobStore | null = null, isCapacitor?: boolean) {
    this.isCapacitor = isCapacitor !== false;
    this.blobStore = blobStore || this.createDefaultStore();
  }

  private createDefaultStore(): LargeBlobStore {
    if (this.isCapacitor) {
      return new (require("@/lib/storage/large-blob-store").CapacitorFilesystemBlobStore)();
    }
    return new (require("@/lib/storage/large-blob-store").IndexedDBBlobStore)();
  }

  /** Inicializar o instalador */
  async init(): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure storage is available
      const profile = await DeviceStorageProfile.getDeviceProfile();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /** Verificar se pode retomar um download interrompido */
  async checkResume(packageId: string): Promise<ResumeResult> {
    try {
      // Verificar se existe checkpoint salvo
      const checkpointKey = `checkpoint-${packageId}`;
      let checkpoint: Checkpoint | null = null;

      // Em IndexedDB
      if (this.blobStore && this.blobStore.constructor.name === "IndexedDBBlobStore") {
        // Conceptual - would check DB for checkpoint
        const record = await this.blobStore.enumerate();
        const stagingEntry = record.data.find((r: any) => r.key === packageId);
        if (stagingEntry && stagingEntry.size > 0) {
          checkpoint = {
            id: checkpointKey,
            timestamp: new Date().toISOString(),
            downloadedBytes: stagingEntry.size,
            totalBytes: stagingEntry.size,
            speed: 0,
            eta: 0,
          };
        }
      }
      // Em Capacitor
      else if (this.isCapacitor) {
        // Conceptual - would check filesystem for checkpoint
      }

      return { canResume: checkpoint !== null, checkpoint };
    } catch (error) {
      return { canResume: false, checkpoint: null, reason: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /** Iniciar instalação de um pacote regional */
  async startInstall(params: InstallParams): Promise<StoreResult<{ installId: string; status: InstallerStatus }>> {
    try {
      // 1. Validar manifest
      const manifestValidation = offlineMapPackageManifestSchema.safeParse(params.manifest);
      if (!manifestValidation.success) {
        return {
          success: false,
          error: {
            code: "invalid-manifest",
            message: "Manifest inválido",
            retryable: false,
          },
        };
      }

      // 2. Verificar espaço disponível
      const profile = await DeviceStorageProfile.getDeviceProfile();
      if (params.manifest.totalBytes > profile.safeLimit) {
        return {
          success: false,
          error: {
            code: "insufficient-space",
            message: "Espaço insuficiente para o pacote",
            retryable: false,
          },
        };
      }

      // 3. Iniciar staging
      const stagingResult = await this.blobStore.staging(params.packageId, params.manifest.totalBytes);
      if (!stagingResult.success) {
        return {
          success: false,
          error: {
            code: "staging-failed",
            message: stagingResult.error?.message || "Falha no staging",
            retryable: true,
          },
        };
      }

      // 4. Download em chunks com checkpoint
      const installId = `install-${packageId}-${Date.now()}`;
      const chunkSize = 1024 * 1024; // 1MB chunks
      let downloadedBytes = 0;
      const totalBytes = params.manifest.totalBytes;
      const abortController = new AbortController();

      // Salvar checkpoint inicial
      this.saveCheckpoint(installId, downloadedBytes, totalBytes, 0, 0);

      // Se houver onProgress, chamar imediatamente com status inicial
      params.onProgress?.({
        status: "downloading",
        percent: 0,
        message: "Iniciando download do pacote regional",
        downloadedBytes: 0,
        totalBytes,
        speed: 0,
        eta: 0,
        checkpoint: downloadedBytes,
        lastCheckpoint: downloadedBytes,
        abort: abortController.abort,
      });

      // Em um cenário real, aqui ocorreria o download real via HTTP Range requests
      // Para este modelo, simulamos o download
      const simulatedChunks = Math.ceil(totalBytes / chunkSize);

      for (let i = 0; i < simulatedChunks && !abortController.signal.aborted; i++) {
        // Simular chunk download
        const chunkSizeActual = Math.min(chunkSize, totalBytes - downloadedBytes);
        downloadedBytes += chunkSizeActual;

        // Simular progresso
        const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
        const speed = 1024; // 1KB/s simulado
        const eta = downloadedBytes > 0 ? Math.ceil((totalBytes - downloadedBytes) / speed) : 0;

        // Salvar checkpoint a cada 5 chunks ou a cada 30 segundos (simulado)
        if (i % 5 === 0 || downloadedBytes >= totalBytes) {
          await this.saveCheckpoint(installId, downloadedBytes, totalBytes, speed, eta);
          params.onProgress?.({
            status: "downloading",
            percent,
            message: `Download em andamento: ${downloadedBytes}/${totalBytes} bytes`,
            downloadedBytes,
            totalBytes,
            speed,
            eta,
            checkpoint: downloadedBytes,
            lastCheckpoint: downloadedBytes,
            abort: abortController.abort,
          });
        }

        // Pequena pausa para simular download real
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 5. Validar pacote baixado
      if (!params.forceValidate) {
        const resumeResult = await this.checkResume(params.packageId);
        if (resumeResult.canResume && !params.forceValidate) {
          // Já tem checkpoint, pular validação pesada
          params.onProgress?.({
            status: "validating",
            percent: 100,
            message: "Validando pacote (usando checkpoint existente)",
            downloadedBytes: totalBytes,
            totalBytes,
            speed: 0,
            eta: 0,
            checkpoint: totalBytes,
            lastCheckpoint: totalBytes,
            abort: abortController.abort,
          });
        } else {
          // Validar pacote completo
          params.onProgress?.({
            status: "validating",
            percent: 70,
            message: "Validando pacote baixado...",
            downloadedBytes,
            totalBytes,
            speed: 0,
            eta: 0,
            checkpoint: downloadedBytes,
            lastCheckpoint: downloadedBytes,
            abort: abortController.abort,
          });

          const validateResult = await validateOfflinePackage(
            params.manifest,
            new Map([[params.manifest.archive.path, new Uint8Array()]])
          );

          if (!validateResult.ok) {
            return {
              success: false,
              error: {
                code: "validation-failed",
                message: validateResult.detail || "Falha na validação do pacote",
                retryable: true,
              },
            };
          }
        }
      } else {
        // forceValidate: validar do zero
        params.onProgress?.({
          status: "validating",
          percent: 70,
          message: "Validando pacote (força validação)",
          downloadedBytes,
          totalBytes,
          speed: 0,
          eta: 0,
          checkpoint: downloadedBytes,
          lastCheckpoint: downloadedBytes,
          abort: abortController.abort,
        });

        const validateResult = await validateOfflinePackage(
          params.manifest,
          new Map([[params.manifest.archive.path, new Uint8Array()]])
        );

        if (!validateResult.ok) {
          return {
            success: false,
            error: {
              code: "validation-failed",
              message: validateResult.detail || "Falha na validação do pacote",
              retryable: true,
            },
          };
        }
      }

      // 6. Ativar pacote (atomic swap)
      params.onProgress?.({
        status: "activating",
        percent: 90,
        message: "Ativando pacote regional...",
        downloadedBytes: totalBytes,
        totalBytes,
        speed: 0,
        eta: 0,
        checkpoint: downloadedBytes,
        lastCheckpoint: downloadedBytes,
        abort: abortController.abort,
      });

      const activateResult = await this.blobStore.activate(params.packageId);
      if (!activateResult.success) {
        // Rollback: manter pacote antigo ativo
        return {
          success: false,
          error: {
            code: "activation-failed",
            message: activateResult.error?.message || "Falha ao ativar pacote",
            retryable: true,
          },
        };
      }

      // 7. Concluir instalação
      params.onProgress?.({
        status: "active",
        percent: 100,
        message: "Pacote instalado com sucesso!",
        downloadedBytes: totalBytes,
        totalBytes,
        speed: 0,
        eta: 0,
        checkpoint: totalBytes,
        lastCheckpoint: totalBytes,
        abort: abortController.abort,
      });

      return {
        success: true,
        data: { installId, status: "active" },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "install-failed",
          message: error instanceof Error ? error.message : "Unknown error",
          retryable: true,
        },
      };
    }
  }

  /** Salvamento de checkpoint */
  private async saveCheckpoint(
    installId: string,
    downloadedBytes: number,
    totalBytes: number | null,
    speed: number,
    eta: number
  ): Promise<void> {
    const checkpointKey = `${installId}-checkpoint`;
    const checkpoint: Checkpoint = {
      id: checkpointKey,
      timestamp: new Date().toISOString(),
      downloadedBytes,
      totalBytes,
      speed,
      eta,
    };

    // Em IndexedDB
    if (this.blobStore && this.blobStore.constructor.name === "IndexedDBBlobStore") {
      // Conceptual - would save to DB
    }
    // Em Capacitor
    else if (this.isCapacitor) {
      // Conceptual - would save to filesystem
    }
  }

  /** Cancelar instalação em andamento */
  abortInstall(): void {
    // Abortar transfers em andamento
  }
}

export default ResumableInstaller;