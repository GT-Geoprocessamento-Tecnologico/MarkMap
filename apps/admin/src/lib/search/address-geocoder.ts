import { addressSearchCache } from './address-search-cache';

export type AddressResult = {
  id: string; label: string; lon: number; lat: number;
  source?: string; attribution?: string; postalCode?: string;
};
const REQUEST_TIMEOUT_MS = 9_000;
const MAX_BODY_BYTES = 128 * 1024;

export function configuredAddressSearchEndpoint(path: string | undefined = import.meta.env.VITE_MARKMAP_GEOCODER_ENDPOINT): string | null {
  if (path === undefined) return "/api/address-search";
  if (!path || !/^\/api\/[A-Za-z0-9/_-]+$/.test(path) || path.includes("//")) return null;
  return path;
}

export async function searchAddressOnline(query: string, signal?: AbortSignal, fetcher: typeof fetch = fetch, endpoint = configuredAddressSearchEndpoint()): Promise<AddressResult[]> {
  const term = query.trim().replace(/\s+/g, " ");
  if (term.length < 3 || term.length > 160) throw new Error("Informe um endereço entre 3 e 160 caracteres.");
  if (!endpoint) throw new Error("Busca online aguarda um provedor autorizado. Use os mapas offline.");
  const normalizedTerm = /^\d{5}-?\d{3}$/.test(term) ? term.replace("-", "") : term;
  throwIfAborted(signal);
  const cached = await addressSearchCache.read(normalizedTerm, endpoint);
  throwIfAborted(signal);
  if (cached?.length) return cached;
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("Sem internet. Use os locais do mapa baixado.");
  const params = new URLSearchParams({ q: normalizedTerm, limit: "5" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetcher(`${endpoint}?${params.toString()}`, { method: "GET", credentials: "same-origin", redirect: "error", cache: "no-store", headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) throw new Error("Busca online indisponível. Tente mais tarde.");
    const length = Number(response.headers.get("Content-Length"));
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new Error("Resposta de busca muito grande.");
    const raw: unknown = await readJsonWithLimit(response);
    if (!Array.isArray(raw)) throw new Error("Resposta de endereço inválida.");
    const hits = raw.slice(0, 5).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const obj = item as Record<string, unknown>, lat = obj.lat, lon = obj.lon;
      if (typeof obj.label !== "string" || obj.label.length === 0 || obj.label.length > 220 || typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
      const result: AddressResult = { id: typeof obj.id === "string" && obj.id.length <= 160 ? obj.id : obj.label.slice(0, 160), label: obj.label, lat, lon };
      if (typeof obj.source === "string" && obj.source.length <= 80) result.source = obj.source;
      if (typeof obj.attribution === "string" && obj.attribution.length <= 240) result.attribution = obj.attribution;
      if (typeof obj.postalCode === "string" && /^\d{8}$/.test(obj.postalCode)) result.postalCode = obj.postalCode;
      return [result];
    });
    if (hits.length) { throwIfAborted(signal); await addressSearchCache.write(normalizedTerm, endpoint, hits); throwIfAborted(signal); }
    return hits;
  } finally {
    clearTimeout(timeout); signal?.removeEventListener("abort", onAbort);
  }
}

async function readJsonWithLimit(response: Response): Promise<unknown> {
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("Resposta de busca muito grande.");
    return JSON.parse(text);
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let total = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("Resposta de busca muito grande."); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
}
