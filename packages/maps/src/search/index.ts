export interface SearchRecord {
  id: string;
  name: string;
  normalized: string;
  type: string;
  category: string;
  lon: number;
  lat: number;
  description?: string;
}

export interface SearchShard {
  shardId: string;
  firstLetter: string;
  normalizedNames: string[];
  offsets: Uint32Array;
}

export interface SearchIndexMeta {
  version: string;
  regionId: string;
  generatedAt: string;
  recordCount: number;
  types: string[];
  fuzzySupport: boolean;
  maxEditDistance: number;
}

export interface SearchQuery {
  query: string;
  location?: [number, number];
  radius?: number;
  types?: string[];
  fuzzy?: boolean;
  limit?: number;
}

export interface SearchResult {
  id: string;
  name: string;
  type: string;
  category: string;
  relevance: number;
  distance?: number;
  lon: number;
  lat: number;
  preview?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  took: number;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getShardId(normalized: string): string {
  const first = normalized[0] ?? "#";
  if (first >= "a" && first <= "z") return first.toUpperCase();
  if (first >= "0" && first <= "9") return "#";
  return "#";
}

export function partitionByFirstLetter(records: SearchRecord[]): Map<string, SearchRecord[]> {
  const shards = new Map<string, SearchRecord[]>();
  for (const record of records) {
    const shardId = getShardId(record.normalized);
    const list = shards.get(shardId) ?? [];
    list.push(record);
    shards.set(shardId, list);
  }
  for (const list of shards.values()) {
    list.sort((a, b) => a.normalized.localeCompare(b.normalized));
  }
  return shards;
}

export function binarySearchPrefix(
  names: string[],
  prefix: string,
): { start: number; end: number } {
  let low = 0;
  let high = names.length - 1;
  let start = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midName = names[mid];
    if (midName !== undefined && midName >= prefix) {
      start = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (start === -1) return { start: 0, end: -1 };

  let end = start;
  while (end + 1 < names.length && names[end + 1]?.startsWith(prefix)) {
    end++;
  }

  const startName = names[start];
  if (!startName || !startName.startsWith(prefix)) return { start: 0, end: -1 };
  return { start, end };
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[b.length]![a.length]!;
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateRelevance(
  recordNormalized: string,
  queryNormalized: string,
  type?: string,
  queryTypes?: string[],
): number {
  let score = 0;

  if (recordNormalized === queryNormalized) score += 1.0;
  else if (recordNormalized.startsWith(queryNormalized)) score += 0.8;
  else if (recordNormalized.includes(queryNormalized)) score += 0.7;

  const firstWord = recordNormalized.split(" ")[0] ?? "";
  if (firstWord.startsWith(queryNormalized)) score += 0.8;

  if (type && queryTypes && queryTypes.includes(type)) score += 0.3;

  return score;
}

export function searchIndex(
  records: SearchRecord[],
  query: SearchQuery,
): SearchResponse {
  const start = performance.now();
  const queryNormalized = normalizeName(query.query);
  const limit = query.limit ?? 20;
  const maxEditDistance = 2;

  const shardMap = partitionByFirstLetter(records);
  const shardId = getShardId(queryNormalized);
  const candidates: SearchRecord[] = [];

  const searchShards = query.fuzzy
    ? Array.from(shardMap.keys())
    : [shardId];

  for (const sid of searchShards) {
    const shard = shardMap.get(sid);
    if (!shard) continue;

    const names = shard.map((r) => r.normalized);

    if (query.fuzzy) {
      for (const record of shard) {
        let matched = levenshteinDistance(record.normalized, queryNormalized) <= maxEditDistance;
        if (!matched) {
          const words = record.normalized.split(/\s+/);
          for (const word of words) {
            if (levenshteinDistance(word, queryNormalized) <= maxEditDistance) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          candidates.push(record);
        }
      }
    } else {
      const { start: s, end: e } = binarySearchPrefix(names, queryNormalized);
      for (let i = s; i <= e; i++) {
        if (shard[i]) candidates.push(shard[i]!);
      }
    }
  }

  let filtered = candidates;
  if (query.types && query.types.length > 0) {
    filtered = filtered.filter((r) => query.types!.includes(r.type));
  }

  if (query.location) {
    const [qlat, qlon] = query.location;
    const radius = query.radius ?? 50;
    filtered = filtered
      .map((r) => ({
        record: r,
        dist: haversineDistanceKm(qlat, qlon, r.lat, r.lon),
      }))
      .filter((x) => x.dist <= radius)
      .map((x) => ({ ...x.record, _dist: x.dist }));
  }

  const results: SearchResult[] = filtered
    .map((r) => {
      const withDist = r as SearchRecord & { _dist?: number };
      const relevance = calculateRelevance(
        withDist.normalized,
        queryNormalized,
        r.type,
        query.types,
      );
      const result: SearchResult = {
        id: r.id,
        name: r.name,
        type: r.type,
        category: r.category,
        relevance,
        lon: r.lon,
        lat: r.lat,
      };
      if (withDist._dist !== undefined) result.distance = withDist._dist;
      if (r.description !== undefined) result.preview = r.description;
      return result;
    })
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  return {
    results,
    total: filtered.length,
    query: query.query,
    took: Math.round((performance.now() - start) * 100) / 100,
  };
}
