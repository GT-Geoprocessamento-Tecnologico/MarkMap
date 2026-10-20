import { describe, it, expect } from "vitest";
import {
  normalizeName,
  normalizePostalCode,
  getShardId,
  partitionByFirstLetter,
  binarySearchPrefix,
  levenshteinDistance,
  haversineDistanceKm,
  calculateRelevance,
  searchIndex,
  type SearchRecord,
} from "../../src/search/index.js";

function makeRecord(id: string, name: string, type = "street"): SearchRecord {
  return {
    id,
    name,
    normalized: normalizeName(name),
    type,
    category: type,
    lon: -46.63,
    lat: -23.55,
  };
}

describe("normalizeName", () => {
  it("lowercases and removes accents", () => {
    expect(normalizeName("Avenida Paulista")).toBe("avenida paulista");
    expect(normalizeName("São João")).toBe("sao joao");
    expect(normalizeName("CAFÉ")).toBe("cafe");
  });

  it("removes special characters", () => {
    expect(normalizeName("Rua & Avenida 1º")).toBe("rua avenida 1");
  });

  it("trims whitespace", () => {
    expect(normalizeName("  Test  ")).toBe("test");
  });
});

describe("normalizePostalCode", () => {
  it("accepts formatted and unformatted CEPs only when eight digits remain", () => {
    expect(normalizePostalCode("12345-678")).toBe("12345678");
    expect(normalizePostalCode("12345678")).toBe("12345678");
    expect(normalizePostalCode("12345")).toBeNull();
  });
});

describe("getShardId", () => {
  it("returns uppercase letter for a-z", () => {
    expect(getShardId("avenida")).toBe("A");
    expect(getShardId("praça")).toBe("P");
  });

  it("returns # for digits and symbols", () => {
    expect(getShardId("123")).toBe("#");
    expect(getShardId("#")).toBe("#");
    expect(getShardId("")).toBe("#");
  });
});

describe("binarySearchPrefix", () => {
  const names = ["avenida paulista", "bar", "centro", "downtown", "estacao"];

  it("finds prefix range", () => {
    const { start, end } = binarySearchPrefix(names, "e");
    expect(start).toBe(4);
    expect(end).toBe(4);
  });

  it("returns empty for no match", () => {
    const { end } = binarySearchPrefix(names, "z");
    expect(end).toBe(-1);
  });

  it("finds range with multiple matches", () => {
    const multiNames = ["abc", "abd", "abe", "xyz"];
    const { start, end } = binarySearchPrefix(multiNames, "ab");
    expect(start).toBe(0);
    expect(end).toBe(2);
  });
});

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("abc", "abc")).toBe(0);
  });

  it("computes single edit", () => {
    expect(levenshteinDistance("abc", "abd")).toBe(1);
    expect(levenshteinDistance("abc", "ab")).toBe(1);
    expect(levenshteinDistance("abc", "abcd")).toBe(1);
  });

  it("computes multiple edits", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("paulista", "pulista")).toBe(1);
  });

  it("handles empty strings", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });
});

describe("haversineDistanceKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineDistanceKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it("computes known distance", () => {
    const dist = haversineDistanceKm(-23.55, -46.63, -23.56, -46.64);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(5);
  });
});

describe("calculateRelevance", () => {
  it("gives 1.0 for exact match", () => {
    expect(calculateRelevance("avenida paulista", "avenida paulista")).toBeGreaterThanOrEqual(1.0);
  });

  it("gives higher score for prefix match than contains", () => {
    const prefix = calculateRelevance("avenida paulista", "avenida");
    const contains = calculateRelevance("rua avenida paulista", "avenida");
    expect(prefix).toBeGreaterThan(contains);
  });

  it("adds type bonus", () => {
    const withoutType = calculateRelevance("test", "test");
    const withType = calculateRelevance("test", "test", "street", ["street"]);
    expect(withType).toBeGreaterThan(withoutType);
  });
});

describe("searchIndex", () => {
  const records: SearchRecord[] = [
    makeRecord("1", "Avenida Paulista", "highway"),
    makeRecord("2", "Rua Augusta", "street"),
    makeRecord("3", "Praça da Sé", "place"),
    makeRecord("4", "Estação Sé", "transit"),
    makeRecord("5", "Rua da Consolação", "street"),
  ];

  it("returns results for exact prefix", () => {
    const response = searchIndex(records, { query: "avenida" });
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]!.name).toBe("Avenida Paulista");
  });

  it("respects limit", () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      makeRecord(String(i), `Rua ${i}`),
    );
    const response = searchIndex(many, { query: "rua", limit: 5 });
    expect(response.results.length).toBeLessThanOrEqual(5);
  });

  it("returns empty for no match", () => {
    const response = searchIndex(records, { query: "zzzzz" });
    expect(response.results.length).toBe(0);
  });

  it("filters by type", () => {
    const response = searchIndex(records, { query: "rua", types: ["street"] });
    for (const r of response.results) {
      expect(r.type).toBe("street");
    }
  });

  it("fuzzy matching finds similar names", () => {
    const response = searchIndex(records, { query: "pulista", fuzzy: true });
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0]!.name).toBe("Avenida Paulista");
  });

  it("calculates relevance scores", () => {
    const response = searchIndex(records, { query: "avenida paulista" });
    expect(response.results[0]!.relevance).toBeGreaterThanOrEqual(0.8);
  });

  it("measures elapsed time", () => {
    const response = searchIndex(records, { query: "rua" });
    expect(response.took).toBeGreaterThanOrEqual(0);
  });

  it("finds exact indexed CEPs in both display forms", () => {
    const record = { ...makeRecord("cep", "Rua Augusta"), postalCodes: ["12345678"] };
    expect(searchIndex([record], { query: "12345-678" }).results[0]?.id).toBe("cep");
    expect(searchIndex([record], { query: "12345678" }).results[0]?.id).toBe("cep");
    expect(searchIndex([record], { query: "12345" }).results).toHaveLength(0);
  });
});

describe("partitionByFirstLetter", () => {
  it("groups records by first letter", () => {
    const records = [
      makeRecord("1", "Avenida"),
      makeRecord("2", "Bar"),
      makeRecord("3", "Acesso"),
    ];
    const shards = partitionByFirstLetter(records);
    expect(shards.get("A")).toHaveLength(2);
    expect(shards.get("B")).toHaveLength(1);
  });

  it("sorts within each shard", () => {
    const records = [
      makeRecord("1", "Avenida Z"),
      makeRecord("2", "Avenida A"),
    ];
    const shards = partitionByFirstLetter(records);
    const list = shards.get("A")!;
    expect(list[0]!.normalized).toBe("avenida a");
    expect(list[1]!.normalized).toBe("avenida z");
  });
});
