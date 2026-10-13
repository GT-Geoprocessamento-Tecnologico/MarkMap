// Desenvolvido por MtsFerreira. No anonymous public geocoder in production.
export type AddressResult = { id: string; label: string; lon: number; lat: number };
const cache = new Map<string, AddressResult[]>();

/** A configured first-party route can use a licensed provider with server-side limits. */
export function configuredAddressSearchEndpoint(
  path: string | undefined = import.meta.env.VITE_MARKMAP_GEOCODER_ENDPOINT,
): string | null {
  if (!path || !path.startsWith("/api/") || path.includes("//") ||
      path.includes("?") || path.includes("#") || path.includes("\\")) return null;
  return path;
}

export async function searchAddressOnline(
  query: string, signal?: AbortSignal, fetcher: typeof fetch = fetch,
  endpoint = configuredAddressSearchEndpoint(),
): Promise<AddressResult[]> {
  const term = query.trim().replace(/\s+/g, " ");
  if (term.length < 3 || term.length > 160)
    throw new Error("Informe um endereço entre 3 e 160 caracteres.");
  if (!endpoint) throw new Error("Busca online aguarda um provedor autorizado. Use os mapas offline.");
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error("Sem internet. Use os locais do mapa baixado.");
  const key = `${endpoint}:${term.toLocaleLowerCase("pt-BR")}`;
  if (cache.has(key)) return cache.get(key)!;
  const params = new URLSearchParams({ q: term, limit: "5" });
  const response = await fetcher(`${endpoint}?${params.toString()}`, {
    method: "GET", credentials: "same-origin", redirect: "error",
    cache: "no-store", headers: { Accept: "application/json" }, signal,
  });
  if (!response.ok) throw new Error("Busca online indisponível. Tente mais tarde.");
  const length = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > 128 * 1024)
    throw new Error("Resposta de busca muito grande.");
  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) throw new Error("Resposta de endereço inválida.");
  const hits = raw.slice(0, 5).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const obj = item as Record<string, unknown>;
    const lat = Number(obj.lat), lon = Number(obj.lon);
    if (typeof obj.label !== "string" || obj.label.length > 220 ||
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
    return [{ id: String(obj.id ?? obj.label), label: obj.label, lat, lon }];
  });
  if (cache.size >= 60) cache.clear();
  cache.set(key, hits);
  return hits;
}
