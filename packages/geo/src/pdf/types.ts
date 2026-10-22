import type { PdfErrorCode } from './errors.js';
import type { GeoReference, PagePoint } from '@markmap/contracts';

export type { ControlPoint, GeoReference, PagePoint } from '@markmap/contracts';

export type LonLat = readonly [number, number];
export type Bounds = GeoReference['cropBox'];
export type PdfProfile = GeoReference['profile'];
export type PdfAxisOrder = 'latitude-longitude' | 'longitude-latitude' | 'easting-northing';

export type PdfLimits = {
  maxBytes?: number;
  maxPages?: number;
  maxViewports?: number;
  maxControlValues?: number;
  maxCoordinateMagnitude?: number;
};

export type PdfViewportMetadata = {
  name: string | null;
  bbox: Bounds;
  profile: 'iso-measure-geo' | 'ogc-lgidict';
  sourceCrs: string | null;
  axisOrder: PdfAxisOrder | null;
  controls: readonly PagePoint[];
  ground: readonly PagePoint[];
  neatline: readonly PagePoint[];
};

export type PdfPageMetadata = {
  pageIndex: number;
  mediaBox: Bounds;
  cropBox: Bounds;
  rotation: 0 | 90 | 180 | 270;
  viewports: readonly PdfViewportMetadata[];
  errors?: readonly PdfErrorCode[];
};

export type PdfInspection = {
  pageCount: number;
  pages: readonly PdfPageMetadata[];
};

export type InsetSelection = { viewportName: string };
