/**
 * Permissão de localização no aplicativo nativo (Capacitor).
 *
 * No navegador — PWA e desktop — a Web Geolocation API já pede a permissão ao
 * usuário e `navigator.geolocation` funciona. No Android, porém, o WebView
 * devolve PERMISSION_DENIED (código 1) sem que `ACCESS_FINE_LOCATION` /
 * `ACCESS_COARSE_LOCATION` estejam declaradas no manifesto e concedidas em
 * tempo de execução, e o WebView não consegue exibir o diálogo de permissão.
 *
 * O plugin `@capacitor/geolocation` expõe a solicitação nativa via
 * `requestPermissions()`. No Android, as permissões também são garantidas no
 * manifesto gerado pelo script de build `ensure-android-location-permissions.mjs`.
 *
 * Este módulo é deliberadamente um no-op na web, para que a instalação PWA e
 * o navegador de desenvolvimento não mudem de comportamento. O Capacitor só
 * é importado quando o shell nativo é detectado.
 */

export type LocationPermissionState =
  | { readonly state: "granted" }
  | { readonly state: "denied"; readonly reason: "denied" | "unavailable" | "error" };

interface CapacitorGlobal {
  readonly isNativePlatform?: () => boolean;
  readonly getPlatform?: () => string;
}

const DENIED: LocationPermissionState = { state: "denied", reason: "denied" };

/**
 * Detecta o shell nativo pelo global injetado pela ponte Capacitor.
 *
 * A ponte nativa pode injetar apenas `getPlatform`, enquanto a versão web
 * instalada por `import '@capacitor/core'` expõe `isNativePlatform`. Ambos os
 * formatos são aceitos; sem o global, a resposta é "não nativo".
 */
const detectNativeShell = (): boolean => {
  if (typeof window === "undefined") return false;
  const capacitor = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function") return capacitor.isNativePlatform();
  if (typeof capacitor.getPlatform === "function") return capacitor.getPlatform() !== "web";
  return false;
};

/**
 * Garante a permissão de localização antes de usar a Web Geolocation API.
 *
 * Na web resolve imediatamente como `granted`, preservando o comportamento
 * atual. No nativo consulta o estado e solicita quando ainda é `prompt`.
 */
export const ensureLocationPermission = async (): Promise<LocationPermissionState> => {
  if (!detectNativeShell()) return { state: "granted" };

  try {
    const { Geolocation } = await import("@capacitor/geolocation");

    const current = await Geolocation.checkPermissions();
    if (current.location === "granted") return { state: "granted" };
    if (current.location === "denied") return DENIED;

    const requested = await Geolocation.requestPermissions({
      permissions: ["location"],
    });
    return requested.location === "granted" ? { state: "granted" } : DENIED;
  } catch {
    // Serviço de localização indisponível ou plugin nativo inacessível.
    // O restante do aplicativo deve continuar utilizável offline.
    return { state: "denied", reason: "unavailable" };
  }
};