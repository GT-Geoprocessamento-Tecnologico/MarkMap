export { inspectPdf } from './metadata.js';
export { resolveIsoMeasure } from './iso-measure.js';
export { resolveOgcLgiDict } from './ogc-lgidict.js';
export { fitAffine, pageToLonLat, lonLatToPage } from './transform.js';
export { PdfError, isPdfError } from './errors.js';
export type { PdfErrorCode } from './errors.js';
export type { PdfCrs } from './crs-registry.js';
export type { Bounds, ControlPoint, GeoReference, InsetSelection, LonLat, PagePoint, PdfAxisOrder, PdfInspection, PdfLimits, PdfPageMetadata, PdfProfile, PdfViewportMetadata } from './types.js';
