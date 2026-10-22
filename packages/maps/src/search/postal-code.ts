/**
 * Copyright 2020 My.com B.V. (Mail.Ru Group), 2020-2026 Organic Maps Contributors.
 * Adapted by MtsFerreira for MarkMap, 2026.
 *
 * CEP normalization adapted from Organic Maps' postcode shape matcher:
 * REPOSITOTIROS MODELOS/organicmaps-master/organicmaps-master/
 * libs/indexer/postcodes_matcher.cpp:24-40,95-105.
 *
 * Organic Maps source is Apache-2.0 (LICENSES/Apache-2.0.txt). This TypeScript
 * implementation keeps only the small character-shape idea and applies the
 * product's strict Brazilian eight-digit CEP contract.
 */

function simplifyChar(char: string): "n" | "other" {
  return /^[0-9]$/.test(char) ? "n" : "other";
}

export function normalizePostalCode(value: string): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = [...trimmed].filter((char) => char !== "-" && char !== " " && char !== ".");
  if (compact.length !== 8 || compact.some((char) => simplifyChar(char) !== "n")) return null;
  return compact.join("");
}

export function formatPostalCode(value: string): string | null {
  const normalized = normalizePostalCode(value);
  return normalized ? `${normalized.slice(0, 5)}-${normalized.slice(5)}` : null;
}
