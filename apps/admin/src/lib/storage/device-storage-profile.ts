/**
 * DeviceStorageProfile - Perfil de storage do dispositivo
 *
 * Fornece informações sobre quota, usage, persistência e orçamento seguro
 * calculado para o armazenamento local do dispositivo. Opera em Web/PWA e
 * Capacitor, adaptando-se à disponibilidade de APIs.
 *
 * Este módulo é o MM-MAP-100 da sequência Maps Engine v2 offline.
 */

import { persistence } from "@capacitor/storage";
import { requestPermissions, requestPermission } from "@capacitor/geolocation";

import { getStorageBreakdown, CategoryBreakdown, StorageBreakdown } from "./storage-management";
import { offlineMapStore } from "./offline-map-store";

/**
 * Tipos do perfil de storage do dispositivo
 */

export type StorageBackend = "indexeddb" | "filesystem" | "unknown";

export interface DeviceStorageProfile {
  /** Quota total disponível em bytes (aprox. 20% do total do dispositivo) */
  quota: number;
  /** Uso atual em bytes, por categoria */
  usage: Map<StorageCategory, number>;
  /** Categories com uso */
  categoriesWithUsage: StorageCategory[];
  /** Se o storage persistente foi concedido */
  persistentGranted: boolean;
  /** Backend disponível para storage */
  backend: StorageBackend;
  /** Orçamento seguro calculado (quota * 0.85, nunca exceder 85% do total) */
  safeLimit: number;
  /** Limite máximo absoluto do dispositivo (bytes) */
  maxLimit: number;
  /** Espaço livre estimado (bytes) */
  freeSpace: number;
}

/** Categorias de armazenamento suportadas */
export type StorageCategory =
  | "offline-maps"
  | "pdfs"
  | "telemetry"
  | "datasets-excluidos";

/** Mapeamento interno de categorias do breakdown para o nosso tipo */
const categoryMap: Record<string, StorageCategory> = {
  "offline-maps": "offline-maps",
  "original-pdfs": "pdfs",
  "telemetry": "telemetry",
  "soft-deleted-datasets": "datasets-excluidos",
};

/**
 * Obtém o perfil completo de storage do dispositivo.
 *
 * - Em Web/PWA: usa navigator.storage.estimate() e IndexedDB
 * - Em Capacitor: usa plugin de storage + IndexedDB
 *
 * @returns DeviceStorageProfile preenchado com dados reais
 */
export async function getDeviceStorageProfile(): Promise<DeviceStorageProfile> {
  const isCapacitor = typeof window !== "undefined" && (window as any)?.Capacitor;
  const isNativePlatform = isCapacitor?.isNativePlatform === true;

  let quota = 0;
  let maxLimit = 0;
  let persistentGranted = false;
  let backend: StorageBackend = "indexeddb";
  let usageMap = new Map<StorageCategory, number>();
  let categoriesWithUsage: StorageCategory[] = [];

  // Tentar obter quota do navigator.storage (Web)
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      maxLimit = estimate.quota;
      quota = Math.floor(estimate.quota * 0.85); // 85% safe limit
      persistentGranted = await navigator.storage.persist?.();
    }
  } catch {
    // Fallback - Web sem estimate
  }

  // Em Capacitor, tentar obter info do plugin
  if (isNativePlatform) {
    try {
      const { value } = await persistence.get({ key: "storage_quota" });
      // O plugin pode armazenar a quota previamente calculada
      if (value && typeof value === "number") {
        maxLimit = value;
        quota = Math.floor(value * 0.85);
      }
    } catch {
      // Ignorar erros de persistence plugin
    }

    // Verificar permissões de persistência
    try {
      const permStatus = await requestPermissions({ permissions: ["storage"] });
      persistentGranted = permStatus.storage === "granted";
    } catch {
      // Ignorar
    }
  }

  // Obter breakdown detalhada
  try {
    const breakdown: StorageBreakdown = await getStorageBreakdown();

    for (const cat of breakdown.categories) {
      const mappedCat = categoryMap[cat.category] || "offline-maps";
      usageMap.set(mappedCat, cat.estimatedBytes);
      categoriesWithUsage.push(mappedCat);
    }
  } catch {
    // Fallback se breakdown falhar
  }

  // Calcular space livre
  const totalUsed = Array.from(usageMap.values()).reduce((sum, bytes) => sum + bytes, 0);
  const freeSpace = maxLimit > 0 ? maxLimit - totalUsed : 0;

  // Ajustar quota se freeSpace for menor
  if (maxLimit > 0 && freeSpace < quota) {
    quota = Math.floor(freeSpace * 0.95); // 95% do espaço livre restante
  }

  return {
    quota,
    usage: usageMap,
    categoriesWithUsage,
    persistentGranted,
    backend,
    safeLimit: quota,
    maxLimit,
    freeSpace,
  };
}

/**
 * Verifica se há espaço suficiente para um pacote de mapa de tamanho determinado.
 *
 * @param packageBytes Tamanho do pacote em bytes
 * @returns True se houver espaço suficiente considerando o safe limit
 */
export function hasSpaceForPackage(packageBytes: number): boolean {
  return packageBytes <= 0 ? false : hasSpaceForPackage._profile?.safeLimit >= packageBytes;
}

/** Cache estático do perfil (atualizado a cada 300s) */
hasSpaceForPackage._profile: DeviceStorageProfile | null = null;
hasSpaceForProfile._timer: NodeJS.Timeout | null = null;

/**
 * Atualiza o perfil cached a cada intervalo.
 *
 * @param refreshForcado Se verdadeiro, força atualização ignorando o cache
 */
export async function refreshStorageProfile(refreshForcado: boolean = false): Promise<DeviceStorageProfile> {
  const now = Date.now();

  // Se temos cache recente e não for refresh forçado, retorna cache
  if (!refreshForcado && hasSpaceForPackage._profile && hasSpaceForProfile._timer) {
    const age = now - (hasSpaceForProfile._timer as number);
    if (age < 300_000) {
      // 5 minutos de cache
      return hasSpaceForPackage._profile;
    }
  }

  const profile = await getDeviceStorageProfile();

  // Atualizar timer
  clearTimeout(hasSpaceForProfile._timer as NodeJS.Timeout);
  hasSpaceForProfile._timer = setTimeout(() => {
    hasSpaceForPackage._profile = null;
  }, 300_000);

  hasSpaceForPackage._profile = profile;
  return profile;
}

/**
 * Formata bytes em formato legível humano.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Verifica se o usuário tem permission persistente para storage.
 * Em Web, chama navigator.storage.persist(). Em Capacitor, verifica permissões.
 */
export async function isPersistentStorageGranted(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    return await navigator.storage.persist();
  }

  // Capacitor
  if (typeof window !== "undefined" && (window as any)?.Capacitor?.isNativePlatform === true) {
    try {
      const permStatus = await requestPermissions({ permissions: ["storage"] });
      return permStatus.storage === "granted";
    } catch {
      return false;
    }
  }

  return false;
}

/** Categorias suportadas pelo DeviceStorageProfile */
export const STORAGE_CATEGORIES: StorageCategory[] = [
  "offline-maps",
  "pdfs",
  "telemetry",
  "datasets-excluidos",
];

export default DeviceStorageProfile;