export type Hemisphere = "N" | "S";

export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
}

export interface UtmCoordinate {
  easting: number;
  northing: number;
  zone: number;
  hemisphere: Hemisphere;
}

export interface MgrsCoordinate {
  zone: number;
  band: string;
  gridSquare: string;
  easting: number;
  northing: number;
  precision: number;
  text: string;
}

export interface FormattedCoordinates {
  decimal: string;
  dms: string;
  utm: string;
  mgrs: string;
}
