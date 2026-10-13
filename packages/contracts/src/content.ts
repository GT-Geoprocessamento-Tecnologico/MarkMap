import { z } from "zod";

export const wikipediaArticleSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string(),
  language: z.string().min(2).max(10),
  url: z.string().url().optional(),
  osmId: z.string().optional(),
  wikidataId: z.string().optional(),
  attribution: z.string().min(1),
  license: z.string().min(1),
});

export type WikipediaArticle = z.infer<typeof wikipediaArticleSchema>;

export const transitStationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  lon: z.number(),
  lat: z.number(),
  lines: z.array(z.string()),
  operator: z.string().optional(),
  wheelchair: z.enum(["yes", "no", "limited"]).optional(),
});

export type TransitStation = z.infer<typeof transitStationSchema>;

export const transitLineSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().regex(/^#[A-Fa-f0-9]{6}$/),
  mode: z.enum(["metro", "bus", "tram", "train", "ferry"]),
  operator: z.string().optional(),
  stationIds: z.array(z.string()),
});

export type TransitLine = z.infer<typeof transitLineSchema>;

export const transitNetworkSchema = z.object({
  version: z.string(),
  regionId: z.string(),
  generatedAt: z.string().datetime(),
  stations: z.array(transitStationSchema),
  lines: z.array(transitLineSchema),
  attribution: z.string(),
});

export type TransitNetwork = z.infer<typeof transitNetworkSchema>;
