import { PdfError } from './errors.js';
import { createGeoReference } from './transform.js';
import { resolveCrsId } from './crs-registry.js';
import type { GeoReference, InsetSelection, PdfPageMetadata } from './types.js';

export function resolveOgcLgiDict(page: PdfPageMetadata, selection?: InsetSelection): GeoReference {
  const candidates = page.viewports.filter((viewport) => viewport.profile === 'ogc-lgidict');
  if (selection !== undefined) throw new PdfError('unsupported-profile', 'Named selection is not supported for the single LGIDict frame');
  if (candidates.length !== 1) throw new PdfError(candidates.length > 1 ? 'ambiguous-viewport' : 'unsupported-profile', 'LGIDict frame is absent or ambiguous');
  const viewport = candidates[0]!;
  const crs = resolveCrsId(viewport.sourceCrs!);
  return createGeoReference({ profile: 'ogc-lgidict', sourceCrs: crs.id, pageIndex: page.pageIndex, cropBox: page.cropBox, rotation: page.rotation, controls: viewport.controls.map((point, index) => ({ page: point, ground: viewport.ground[index]! })), neatline: viewport.neatline }, crs);
}
