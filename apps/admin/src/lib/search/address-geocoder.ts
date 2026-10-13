// Desenvolvido por MtsFerreira. Manual address lookup; never autocomplete.
export type AddressResult = { id: string; label: string; lon: number; lat: number };
type Candidate = { place_id?: unknown; display_name?: unknown; lat?: unknown; lon?: unknown };
const cache = new Map<string, AddressResult[]>();
let lastRequest = 0;

export async function searchAddressOnline(
  query: string, signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<AddressResult[]> {
  const term = query.trim().replace(/\s+/g, " ");
  if (term.length < 3 || term.length > 160)
    throw new Error("Informe um endereço entre 3 e 160 caracteres.");
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new Error("Sem internet. Use os locais do mapa baixado.");
  const key = term.toLocaleLowerCase("pt-BR");
  if (cache.has(key)) return cache.get(key)!;
  // Public Nominatim: one user-initiated request per 1.2 seconds per app tab.
  if (Date.now() - lastRequest < 1200)
    throw new Error("Aguarde um instante antes de buscar outro endereço.");
  lastRequest = Date.now();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", term);
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "pt-BR");
  const response = await fetcher(url.toString(), {
    method: "GET", credentials: "omit", redirect: "error",
    cache: "no-store", headers: { Accept: "application/json" }, signal,
  });
  if (!response.ok) throw new Error("Busca online indisponível. Tente novamente mais tarde.");
  const length = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(length) && length > 128 * 1024)
    throw new Error("Resposta de busca muito grande.");
  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) throw new Error("Resposta de endereço inválida.");
  const hits = raw.slice(0, 5).flatMap((item: Candidate) => {
    const lat = Number(item.lat), lon = Number(item.lon);
    if (typeof item.display_name !== "string" || !Number.isFinite(lat) ||
      !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
    return [{ id: String(item.place_id ?? item.display_name), label: item.display_name.slice(0, 220), lat, lon }];
  });
  if (cache.size >= 60) cache.clear();
  cache.set(key, hits);
  return hits;
}
