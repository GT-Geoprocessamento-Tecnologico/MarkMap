import { PdfError } from './errors.js';
import { createGeoReference } from './transform.js';
import { resolveCrsId } from './crs-registry.js';
import type { GeoReference, InsetSelection, PdfPageMetadata } from './types.js';

export function resolveIsoMeasure(page: PdfPageMetadata, selection?: InsetSelection): GeoReference {
  const candidates = page.viewports.filter((viewport) => viewport.profile === 'iso-measure-geo');
  const selected = selection === undefined ? candidates : candidates.filter((viewport) => viewport.name === selection.viewportName);
  if (selected.length === 0) throw new PdfError('unsupported-profile', selection === undefined ? 'No ISO GeoPDF viewport is available' : 'Requested viewport was not found');
  if (selected.length !== 1) throw new PdfError('ambiguous-viewport', 'An explicit viewport selection is required');
  const viewport = selected[0]!;
  const crs = resolveCrsId(viewport.sourceCrs!);
  return createGeoReference({ profile: 'iso-measure-geo', sourceCrs: crs.id, pageIndex: page.pageIndex, cropBox: page.cropBox, rotation: page.rotation, controls: viewport.controls.map((point, index) => ({ page: point, ground: viewport.ground[index]! })), neatline: viewport.neatline }, crs);
}
