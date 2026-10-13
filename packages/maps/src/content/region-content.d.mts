import type { TransitNetwork, WikipediaArticle } from '@geonexo/contracts';
export const MAX_WIKIPEDIA_BYTES: number;
export const MAX_TRANSIT_BYTES: number;
export const MAX_WIKIPEDIA_ARTICLES: number;
export const MAX_TRANSIT_STATIONS: number;
export const MAX_TRANSIT_LINES: number;
export class RegionContentError extends Error { readonly code: string; constructor(message: string, code?: string); }
export interface WikipediaRegionPackage {
  regionId: string;
  version: string;
  generatedAt: string;
  attribution: string;
  license: string;
  articles: WikipediaArticle[];
}
export function validateRegionalWikipedia(data: unknown, regionId: string): WikipediaRegionPackage;
export interface TransitRegionPackage extends TransitNetwork { license: string; }
export function validateRegionalTransit(data: unknown, regionId: string, bounds: readonly number[]): TransitRegionPackage;
