export const MAX_REGIONAL_DEM_BYTES: number;
export const MAX_REGIONAL_DEM_CELLS: number;
export const REGIONAL_DEM_NODATA: number;

export interface RegionalDemGrid {
  schemaVersion: 1;
  regionId: string;
  metadata: {
    source: 'srtm' | 'copernicus-dem' | 'alos-dem';
    verticalDatum: 'EGM96' | 'WGS84' | 'EGM2008';
    attribution: string;
    license: string;
    sourceUrl: string;
    resolutionMeters: number;
    noDataValue: number;
    dataType: 'int16';
    width: number;
    height: number;
    bounds: [number, number, number, number];
  };
  values: number[];
}

export interface DemSampleGrid {
  values: number[];
  metadata: {
    width: number;
    height: number;
    bounds: [number, number, number, number];
    noDataValue?: number;
    resolutionMeters: number;
    verticalDatum: string;
    attribution: string;
    license: string;
    sourceUrl: string;
  };
}

export interface RegionalElevationSample {
  distanceMeters: number;
  elevationMeters: number | null;
}
export interface RegionalElevationProfile {
  samples: RegionalElevationSample[];
  totalMeters: number;
  gainMeters: number;
  lossMeters: number;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  coveragePercent: number;
  missingCount: number;
}

export function validateRegionalDem(value: unknown, regionId: string, expectedBounds?: number[]): RegionalDemGrid;
export function sampleRegionalDem(grid: RegionalDemGrid | DemSampleGrid, lon: number, lat: number): number | null;
export function computeRegionalElevationProfile(
  geometry: Array<[number, number]>, grid: RegionalDemGrid | DemSampleGrid, maxSamples?: number,
): RegionalElevationProfile | null;
