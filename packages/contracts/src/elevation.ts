import { z } from "zod";

export const demMetadataSchema = z.object({
  source: z.enum(["srtm", "copernicus-dem", "alos-dem"]),
  resolutionMeters: z.number().positive(),
  verticalDatum: z.enum(["EGM96", "WGS84", "EGM2008"]),
  license: z.string().min(1),
  attribution: z.string().min(1),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  noDataValue: z.number(),
  dataType: z.enum(["int16", "float32"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type DemMetadata = z.infer<typeof demMetadataSchema>;

export const contourSchema = z.object({
  elevation: z.number().finite(),
  interval: z.number().positive(),
  isMajor: z.boolean(),
  geometry: z.array(z.tuple([z.number(), z.number()])),
});

export type Contour = z.infer<typeof contourSchema>;

export const contourLayerSchema = z.object({
  interval: z.number().positive(),
  majorInterval: z.number().positive(),
  minElevation: z.number(),
  maxElevation: z.number(),
  contours: z.array(contourSchema),
});

export type ContourLayer = z.infer<typeof contourLayerSchema>;

export const elevationProfilePointSchema = z.object({
  distance: z.number().min(0),
  elevation: z.number().finite(),
  lon: z.number(),
  lat: z.number(),
});

export const elevationProfileSchema = z.object({
  points: z.array(elevationProfilePointSchema).min(2),
  totalDistance: z.number().min(0),
  minElevation: z.number(),
  maxElevation: z.number(),
  gain: z.number().min(0),
  loss: z.number().min(0),
});

export type ElevationProfile = z.infer<typeof elevationProfileSchema>;
