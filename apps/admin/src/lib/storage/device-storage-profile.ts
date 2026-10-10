/**
 * DeviceStorageProfile - Perfil de storage do dispositivo
 *
 * Fornece informações sobre quota, usage, persistência e orçamento seguro
 * calculado para o armazenamento local do dispositivo. Opera em Web/PWA e
 * Capacitor, adaptando-se à disponibilidade de APIs.
 *
 * Este módulo é o MM-MAP-100 da sequência Maps Engine v2 offline.
 *
 * Observação sobre Capacitor: a Storage Manager API (`navigator.storage`) está
 * disponível dentro do WebView do Capacitor, portanto o caminho nativo usa as
 * mesmas APIs web. A persistência (`navigator.storage.persist()`) é concedida
 * pelo sistema operacional em Android/iOS quando o app é usado com frequência.
 */

import { getStorageBreakdown, StorageBreakdown } from "./storage-management";

/**
 * Tipos do perfil de storage do dispositivo
 */

export type StorageBackend = "indexeddb" | "filesystem" | "unknown";

export interface DeviceStorageProfile {
  /** Orçamento seguro restante estimado para novas gravações (não quota física total) */
  quota: number;
  /** Uso atual em bytes, por categoria */
  usage: Map<StorageCategory, number>;
  /** Categories com uso */
  categoriesWithUsage: StorageCategory[];
  /** Se o storage persistente foi concedido */
  persistentGranted: boolean;
  /** Backend disponível para storage */
  backend: StorageBackend;
  /** Espaço adicional após descontar o uso informado pelo navegador */
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
 * Usa `navigator.storage.estimate()` e a Storage Manager API, disponíveis
 * tanto em Web/PWA quanto dentro do WebView do Capacitor.
 *
 * @returns DeviceStorageProfile preenchido com dados reais
 */
export async function getDeviceStorageProfile(): Promise<DeviceStorageProfile> {
  let maxLimit = 0;
  let browserUsage: number | null = null;
  let persistentGranted = false;
  const backend: StorageBackend = "indexeddb";
  const usageMap = new Map<StorageCategory, number>();
  const categoriesWithUsage: StorageCategory[] = [];

  // Tentar obter quota do navigator.storage (Web + Capacitor WebView)
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota ?? 0;
      const usage = estimate.usage ?? -1;
      if (Number.isFinite(quota) && quota > 0) maxLimit = quota;
      if (Number.isFinite(usage) && usage >= 0) browserUsage = usage;
      persistentGranted = await isPersistentStorageGranted();
    }
  } catch {
    // Fallback - Web sem estimate
  }

  // Em Capacitor nativo, tentar ler a quota persistida em localStorage
  if (isNativePlatform()) {
    try {
      const raw = localStorage.getItem("storage_quota");
      const value = raw === null ? Number.NaN : Number(raw);
      if (Number.isFinite(value) && value > 0) {
        if (maxLimit === 0) maxLimit = value; // fallback only, never override browser quota
      }
      persistentGranted = persistentGranted || (await isPersistentStorageGranted());
    } catch {
      // Ignorar erros de leitura em ambiente nativo
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

  // Breakdown is partial. StorageManager usage also includes outbox, region chunks,
  // cache and other origin data; never replace the larger usage with a smaller estimate.
  const categoryUsage = Array.from(usageMap.values()).reduce((sum, bytes) => sum + bytes, 0);
  const totalUsed = Math.max(browserUsage ?? 0, categoryUsage);
  const freeSpace = maxLimit > 0 ? Math.max(maxLimit - totalUsed, 0) : 0;
  const safeTotal = Math.floor(maxLimit * 0.85);
  const adjustedQuota = maxLimit > 0
    ? Math.max(0, Math.min(safeTotal - totalUsed, Math.floor(freeSpace * 0.95)))
    : 0;

  return {
    quota: adjustedQuota,
    usage: usageMap,
    categoriesWithUsage,
    persistentGranted,
    backend,
    safeLimit: adjustedQuota,
    maxLimit,
    freeSpace,
  };
}

/** Detecta execução dentro do runtime nativo do Capacitor */
function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as { Capacitor?: { isNativePlatform?: boolean } })?.Capacitor;
  return capacitor?.isNativePlatform === true;
}

/**
 * Verifica se há espaço suficiente para um pacote de mapa de tamanho determinado.
 *
 * @param packageBytes Tamanho do pacote em bytes
 * @returns True se houver espaço suficiente considerando o safe limit
 */
export function hasSpaceForPackage(packageBytes: number): boolean {
  if (packageBytes <= 0) return false;
  return (cachedProfile?.safeLimit ?? 0) >= packageBytes;
}

/** Cache estático do perfil (atualizado a cada 300s) */
let cachedProfile: DeviceStorageProfile | null = null;
let cachedProfileTimestamp = 0;
let cacheExpiryTimer: ReturnType<typeof setTimeout> | null = null;

/** TTL do cache em ms (5 minutos) */
const PROFILE_CACHE_TTL_MS = 300_000;

/**
 * Atualiza o perfil cached a cada intervalo.
 *
 * @param refreshForcado Se verdadeiro, força atualização ignorando o cache
 */
export async function refreshStorageProfile(refreshForcado: boolean = false): Promise<DeviceStorageProfile> {
  const now = Date.now();

  // Se temos cache recente e não for refresh forçado, retorna cache
  if (!refreshForcado && cachedProfile !== null && now - cachedProfileTimestamp < PROFILE_CACHE_TTL_MS) {
    return cachedProfile;
  }

  const profile = await getDeviceStorageProfile();

  // Reiniciar timer de expiração do cache
  if (cacheExpiryTimer !== null) clearTimeout(cacheExpiryTimer);
  cacheExpiryTimer = setTimeout(() => {
    cachedProfile = null;
    cachedProfileTimestamp = 0;
    cacheExpiryTimer = null;
  }, PROFILE_CACHE_TTL_MS);

  cachedProfile = profile;
  cachedProfileTimestamp = now;
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
 *
 * Usa a Storage Manager API (`navigator.storage.persisted()`), que funciona
 * em Web/PWA e dentro do WebView do Capacitor.
 */
export async function isPersistentStorageGranted(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage?.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Solicita persistência de storage ao navegador/SO.
 *
 * @returns True se a persistência foi concedida
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
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
