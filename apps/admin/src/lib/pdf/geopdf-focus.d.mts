export type GeoPdfGpsFix = Readonly<{ lon: number; lat: number; accuracyM: number }>;
export type GeoPdfCorner = readonly [number, number];
export type GeoPdfGpsOutcome =
  | { status: "inside"; center: [number, number]; accuracyM: number }
  | { status: "outside" | "imprecise"; accuracyM: number }
  | { status: "unavailable" };
export declare const MAX_GEO_PDF_GPS_ACCURACY_METERS: number;
export declare function evaluateGeoPdfGps(
  fix: GeoPdfGpsFix | null,
  corners: readonly GeoPdfCorner[],
): GeoPdfGpsOutcome;
export declare function describeGeoPdfGps(result: GeoPdfGpsOutcome): string;
