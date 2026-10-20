import { createHash } from "node:crypto";

const BRASIL_API = "https://brasilapi.com.br/api/cep/v2/";
const PHOTON_API = "https://photon.komoot.io/api/";
const MAX_BODY = 128 * 1024;
const MAX_RESULTS = 5;
const REQUEST_DEADLINE_MS = 8000;
const PROVIDER_TIMEOUT_MS = 6000;
const CLIENT_WINDOW_MS = 60_000;
const CLIENT_LIMIT = 12;
const UPSTREAM_LIMIT = 30;
const UPSTREAM_CONCURRENCY = 4;
const CACHE_MAX = 128;
const CACHE_TTLS = { cep: 24 * 60 * 60_000, address: 60 * 60_000 };

const cache = new Map();
const clients = new Map();
const upstreamRequests = [];
let upstreamActive = 0;

export function normalizeCep(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s.-]/g, "");
  return /^\d{8}$/.test(digits) ? digits : null;
}

function finiteCoordinate(value, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) return null;
  return value;
}

function brasilCoordinate(value, minimum, maximum) {
  if (typeof value === "number") return finiteCoordinate(value, minimum, maximum);
  if (typeof value !== "string" || value.trim() === "" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  return finiteCoordinate(Number(value), minimum, maximum);
}

function normalizePostal(value) {
  if (typeof value !== "string") return undefined;
  const digits = value.replace(/[\s.-]/g, "");
  return /^\d{8}$/.test(digits) ? digits : undefined;
}

function text(value, max) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : "";
}

function idFor(provider, value) {
  return createHash("sha256").update(`${provider}:${value}`).digest("hex").slice(0, 64);
}

function brasilResult(payload, cep) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.cep !== undefined && normalizeCep(payload.cep) !== cep) return null;
  const location = payload.location;
  const coordinates = location && typeof location === "object" ? location.coordinates : null;
  const lon = brasilCoordinate(coordinates?.longitude, -180, 180);
  const lat = brasilCoordinate(coordinates?.latitude, -90, 90);
  if (lon === null || lat === null) return null;
  const parts = [payload.street, payload.neighborhood, payload.city, payload.state].map((value) => text(value, 220)).filter(Boolean);
  const label = text(parts.join(", "), 220);
  if (!label) return null;
  return { id: idFor("brasilapi", cep), label, lat, lon, source: "brasilapi", attribution: "BrasilAPI", postalCode: normalizePostal(cep) };
}

function photonResult(feature, requiredCep) {
  if (!feature || typeof feature !== "object" || !feature.geometry || typeof feature.geometry !== "object") return null;
  const geometry = feature.geometry;
  const coordinates = geometry.coordinates;
  if (geometry.type !== "Point" || !Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = finiteCoordinate(coordinates[0], -180, 180);
  const lat = finiteCoordinate(coordinates[1], -90, 90);
  if (lon === null || lat === null) return null;
  const properties = feature.properties && typeof feature.properties === "object" ? feature.properties : {};
  const postalCode = normalizePostal(properties.postcode);
  if (requiredCep && postalCode !== normalizePostal(requiredCep)) return null;
  const parts = [properties.name, properties.housenumber && `${properties.street ?? ""} ${properties.housenumber}`, properties.street, properties.city, properties.state, properties.country]
    .map((value) => text(value, 220)).filter(Boolean);
  const label = text(parts.join(", "), 220);
  if (!label) return null;
  const osmType = typeof properties.osm_type === "string" ? properties.osm_type.trim().slice(0, 20) : "";
  const osmId = typeof properties.osm_id === "string" && properties.osm_id.trim()
    ? properties.osm_id.trim().slice(0, 60)
    : typeof properties.osm_id === "number" && Number.isFinite(properties.osm_id)
      ? String(properties.osm_id)
      : "";
  return { id: idFor("photon", osmId || label), label, lat, lon, source: "photon", attribution: "OpenStreetMap contributors via Photon/Komoot", ...(postalCode ? { postalCode } : {}) };
}

async function boundedJson(response) {
  if (!response.body?.getReader) {
    const value = await response.text();
    if (Buffer.byteLength(value, "utf8") > MAX_BODY) throw new Error("UPSTREAM_TOO_LARGE");
    return JSON.parse(value);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_BODY) throw new Error("UPSTREAM_TOO_LARGE");
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function providerFetch(url, deadline, fetcher) {
  const now = Date.now();
  if (now >= deadline) throw new Error("UPSTREAM_TIMEOUT");
  while (upstreamActive >= UPSTREAM_CONCURRENCY) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (Date.now() >= deadline) throw new Error("UPSTREAM_TIMEOUT");
  }
  const cutoff = Date.now() - CLIENT_WINDOW_MS;
  while (upstreamRequests.length && upstreamRequests[0] < cutoff) upstreamRequests.shift();
  if (upstreamRequests.length >= UPSTREAM_LIMIT) throw new Error("UPSTREAM_RATE_LIMIT");
  upstreamRequests.push(Date.now());
  upstreamActive += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(PROVIDER_TIMEOUT_MS, Math.max(1, deadline - Date.now())));
  try {
    const response = await fetcher(url, { method: "GET", redirect: "error", headers: { Accept: "application/json" }, signal: controller.signal });
    if (!response.ok) {
      const cancelled = response.body?.cancel?.();
      if (cancelled?.catch) await cancelled.catch(() => {});
      return { status: response.status, payload: null };
    }
    return { status: response.status, payload: await boundedJson(response) };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("UPSTREAM_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
    upstreamActive -= 1;
  }
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit || hit.expires <= Date.now()) { cache.delete(key); return null; }
  cache.delete(key); cache.set(key, hit);
  return hit.value;
}

function cachePut(key, value, ttl) {
  if (!Array.isArray(value) || value.length === 0) return;
  cache.delete(key);
  cache.set(key, { value, expires: Date.now() + ttl });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function pruneClients(now) {
  const cutoff = now - CLIENT_WINDOW_MS;
  for (const [key, calls] of clients) {
    const fresh = calls.filter((stamp) => stamp > cutoff);
    if (fresh.length) clients.set(key, fresh);
    else clients.delete(key);
  }
  while (clients.size > 1024) clients.delete(clients.keys().next().value);
}

function clientKey(req) {
  const forwarded = req.headers?.["x-forwarded-for"] ?? req.headers?.["x-real-ip"] ?? "anonymous";
  return createHash("sha256").update(String(forwarded).split(",")[0].trim()).digest("hex");
}

function allowedBrowser(req) {
  const site = req.headers?.["sec-fetch-site"];
  if (site && !["same-origin", "same-site", "none"].includes(String(site).toLowerCase())) return false;
  const origin = req.headers?.origin;
  if (!origin) return true;
  const host = req.headers?.["x-forwarded-host"] ?? req.headers?.host;
  const protocol = req.headers?.["x-forwarded-proto"] ?? "https";
  return Boolean(host && origin === `${protocol}://${host}`);
}

function json(res, status, body, requestId) {
  res.statusCode = status;
  res.setHeader?.("Content-Type", "application/json; charset=utf-8");
  res.setHeader?.("Cache-Control", "private, no-store");
  res.setHeader?.("X-Request-Id", requestId);
  if (status === 405) res.setHeader?.("Allow", "GET");
  if (status === 429) res.setHeader?.("Retry-After", "60");
  res.end(JSON.stringify(body));
}

export function resetAddressSearchState() {
  cache.clear(); clients.clear(); upstreamRequests.splice(0); upstreamActive = 0;
}

export async function handleAddressSearch(req, res, { fetcher = fetch, now = () => Date.now() } = {}) {
  const requestId = idFor("request", `${now()}:${Math.random()}`);
  if (req.method !== "GET") return json(res, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Método não permitido." } }, requestId);
  if (!allowedBrowser(req)) return json(res, 403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "Origem não permitida." } }, requestId);
  pruneClients(now());
  const key = clientKey(req);
  const cutoff = now() - CLIENT_WINDOW_MS;
  const calls = (clients.get(key) ?? []).filter((stamp) => stamp > cutoff);
  if (calls.length >= CLIENT_LIMIT) return json(res, 429, { error: { code: "RATE_LIMITED", message: "Muitas consultas. Tente novamente mais tarde." } }, requestId);
  clients.set(key, [...calls, now()]);
  const url = new URL(req.url ?? "/api/address-search", "https://markmap.invalid");
  const term = typeof url.searchParams.get("q") === "string" ? url.searchParams.get("q").trim().replace(/\s+/g, " ") : "";
  const limit = Number(url.searchParams.get("limit") ?? "5");
  const cepLike = /^[\d\s.-]+$/.test(term) && /\d/.test(term);
  if (term.length < 3 || term.length > 160 || !Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS || (cepLike && !normalizeCep(term)))
    return json(res, 400, { error: { code: "INVALID_QUERY", message: "Consulta inválida." } }, requestId);
  const cep = normalizeCep(term);
  const kind = cep ? "cep" : "address";
  const normalized = cep ?? term.toLocaleLowerCase("pt-BR");
  const cacheKey = `${kind}:v1:${normalized}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return json(res, 200, cached, requestId);
  const deadline = now() + REQUEST_DEADLINE_MS;
  try {
    let results = [];
    if (cep) {
      let brasil = null;
      try { brasil = await providerFetch(`${BRASIL_API}${cep}`, deadline, fetcher); } catch (error) {
        if (error?.message === "UPSTREAM_RATE_LIMIT") throw error;
      }
      if (brasil?.status === 200) {
        const result = brasilResult(brasil.payload, cep);
        if (result) results = [result];
      }
      if (!results.length && now() < deadline) {
        const photon = await providerFetch(`${PHOTON_API}?q=${encodeURIComponent(cep)}&limit=5`, deadline, fetcher);
        if (photon.status === 200 && photon.payload?.type === "FeatureCollection" && Array.isArray(photon.payload.features))
          results = photon.payload.features.map((feature) => photonResult(feature, cep)).filter(Boolean).slice(0, limit);
      }
    } else {
      const photon = await providerFetch(`${PHOTON_API}?q=${encodeURIComponent(term)}&limit=5`, deadline, fetcher);
      if (photon.status !== 200) throw new Error("UPSTREAM_UNAVAILABLE");
      if (photon.payload?.type !== "FeatureCollection" || !Array.isArray(photon.payload.features)) throw new Error("UPSTREAM_INVALID");
      results = photon.payload.features.map((feature) => photonResult(feature)).filter(Boolean).slice(0, limit);
    }
    cachePut(cacheKey, results, CACHE_TTLS[kind]);
    return json(res, 200, results, requestId);
  } catch (error) {
    const code = error?.message === "UPSTREAM_RATE_LIMIT" ? "RATE_LIMITED" : "UPSTREAM_UNAVAILABLE";
    return json(res, code === "RATE_LIMITED" ? 429 : 502, { error: { code, message: "Busca online indisponível." } }, requestId);
  }
}
