import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFObject, PDFString } from 'pdf-lib';
import { PdfError } from './errors.js';
import { resolveIsoCrs, resolveOgcCrs, type PdfCrs } from './crs-registry.js';
import type { Bounds, PdfInspection, PdfLimits, PdfPageMetadata, PdfViewportMetadata, PagePoint } from './types.js';

const defaults: Required<PdfLimits> = { maxBytes: 25 * 1024 * 1024, maxPages: 100, maxViewports: 64, maxControlValues: 8192, maxCoordinateMagnitude: 1_100_000_000 };
const key = (value: string): PDFName => PDFName.of(value);
type Context = PDFDict['context'];
const resolve = (value: PDFObject | undefined, context: Context): PDFObject | undefined => value === undefined ? undefined : context.lookup(value);
const array = (value: PDFObject | undefined, context: Context): PDFArray | undefined => value === undefined ? undefined : context.lookup(value, PDFArray);
const text = (value: PDFObject | undefined, context: Context): string | undefined => { const object = resolve(value, context); return object instanceof PDFString || object instanceof PDFHexString ? object.decodeText() : undefined; };
const name = (value: PDFObject | undefined, context: Context): string | undefined => { const object = resolve(value, context); return object instanceof PDFName ? object.decodeText() : undefined; };
const numbers = (value: PDFObject | undefined, context: Context, label: string, limit: number, maxMagnitude = defaults.maxCoordinateMagnitude): number[] => {
  const object = array(value, context);
  if (!object || object.size() > limit) throw new PdfError('metadata-limit', `${label} exceeds the metadata limit`);
  const result = object.asArray().map((entry) => context.lookup(entry, PDFNumber).asNumber());
  if (!result.every((value) => Number.isFinite(value) && Math.abs(value) <= maxMagnitude)) throw new PdfError('invalid-control-points', `${label} contains an invalid coordinate`);
  return result;
};
const bounds = (value: number[], label: string): Bounds => {
  if (value.length !== 4 || value[2]! <= value[0]! || value[3]! <= value[1]!) throw new PdfError('invalid-page-geometry', `${label} must be a normalized lower-left/upper-right box`);
  return [value[0]!, value[1]!, value[2]!, value[3]!];
};
const pairs = (value: number[], label: string): PagePoint[] => {
  if (value.length < 6 || value.length % 2 !== 0) throw new PdfError('invalid-control-points', `${label} must contain at least three pairs`);
  return Array.from({ length: value.length / 2 }, (_, index) => [value[index * 2]!, value[index * 2 + 1]!] as PagePoint);
};
function inherited(page: PDFDict, field: string): PDFObject | undefined {
  let current: PDFDict | undefined = page;
  while (current) {
    const value = current.get(key(field));
    if (value !== undefined) return resolve(value, current.context);
    current = current.lookupMaybe(key('Parent'), PDFDict);
  }
  return undefined;
}
function crsFromGcs(gcs: PDFDict, context: Context): PdfCrs {
  const type = name(gcs.get(key('Type')), context);
  const epsgValue = gcs.get(key('EPSG'));
  const epsg = epsgValue === undefined ? undefined : context.lookup(epsgValue, PDFNumber).asNumber();
  const wkt = text(gcs.get(key('WKT')), context);
  return resolveIsoCrs({ ...(type === undefined ? {} : { type }), ...(epsg === undefined ? {} : { epsg }), ...(wkt === undefined ? {} : { wkt }) });
}
function parseIso(viewport: PDFDict, context: Context, limits: Required<PdfLimits>): PdfViewportMetadata {
  const bbox = bounds(numbers(viewport.get(key('BBox')), context, '/BBox', 4, limits.maxCoordinateMagnitude), '/BBox');
  const measure = context.lookup(viewport.get(key('Measure'))!, PDFDict);
  if (name(measure.get(key('Type')), context) !== 'Measure' || name(measure.get(key('Subtype')), context) !== 'GEO') throw new PdfError('unsupported-profile', 'Viewport is not an ISO GEO measure');
  const gcs = context.lookup(measure.get(key('GCS'))!, PDFDict);
  const crs = crsFromGcs(gcs, context);
  const lptValues = numbers(measure.get(key('LPTS')), context, '/LPTS', limits.maxControlValues, limits.maxCoordinateMagnitude);
  const gptValues = numbers(measure.get(key('GPTS')), context, '/GPTS', limits.maxControlValues, limits.maxCoordinateMagnitude);
  if (lptValues.length !== gptValues.length) throw new PdfError('inconsistent-crs-controls', 'LPTS and GPTS have different lengths');
  const normalized = pairs(lptValues, '/LPTS');
  const rawGround = pairs(gptValues, '/GPTS');
  if (normalized.some(([x, y]) => x < -1e-5 || x > 1 + 1e-5 || y < -1e-5 || y > 1 + 1e-5)) throw new PdfError('invalid-control-points', 'LPTS is outside the unit square');
  const controls = normalized.map(([x, y]) => [bbox[0] + x * (bbox[2] - bbox[0]), bbox[1] + y * (bbox[3] - bbox[1])] as PagePoint);
  const ground = rawGround.map((point) => { const converted = crs.fromPdf(point); if (crs.nativeBounds && (converted[0] < crs.nativeBounds[0] || converted[0] > crs.nativeBounds[2] || converted[1] < crs.nativeBounds[1] || converted[1] > crs.nativeBounds[3])) throw new PdfError('invalid-control-points', 'GPTS is outside the CRS area of use'); return converted; });
  return { name: text(viewport.get(key('Name')), context) ?? null, bbox, profile: 'iso-measure-geo', sourceCrs: crs.id, axisOrder: crs.axisOrder, controls, ground, neatline: controls };
}
function parseLgi(lgi: PDFDict, context: Context, limits: Required<PdfLimits>): PdfViewportMetadata {
  if (lgi.has(key('Display')) || lgi.has(key('LGIT:Info'))) throw new PdfError('unsupported-profile', 'LGIDict Display/LGIT:Info variants are unsupported');
  const ctm = numbers(lgi.get(key('CTM')), context, '/CTM', 6, limits.maxCoordinateMagnitude); const neatline = numbers(lgi.get(key('Neatline')), context, '/Neatline', limits.maxControlValues, limits.maxCoordinateMagnitude);
  if (ctm.length !== 6) throw new PdfError('unsupported-profile', 'LGIDict CTM must contain six values');
  const projection = context.lookup(lgi.get(key('Projection'))!, PDFDict);
  const crs = resolveOgcCrs(name(projection.get(key('ProjectionType')), context), name(projection.get(key('Datum')), context));
  const points = pairs(neatline, '/Neatline');
  const ground = points.map(([x, y]) => [ctm[0]! * x + ctm[2]! * y + ctm[4]!, ctm[1]! * x + ctm[3]! * y + ctm[5]!] as PagePoint);
  ground.forEach((point) => { if (point[0] <= -180 || point[0] >= 180 || point[1] < -90 || point[1] > 90) throw new PdfError('invalid-control-points', 'LGIDict ground point is outside WGS84'); });
  const xs = points.map((point) => point[0]); const ys = points.map((point) => point[1]);
  return { name: null, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], profile: 'ogc-lgidict', sourceCrs: crs.id, axisOrder: crs.axisOrder, controls: points, ground, neatline: points };
}

export async function inspectPdf(bytes: Uint8Array, inputLimits: PdfLimits = {}): Promise<PdfInspection> {
  const limits = { ...defaults, ...inputLimits };
  if (bytes.byteLength > limits.maxBytes) throw new PdfError('input-too-large', 'PDF exceeds the byte limit');
  if (bytes.length < 5 || new TextDecoder('latin1').decode(bytes.subarray(0, 5)) !== '%PDF-') throw new PdfError('not-pdf', 'Input does not have a PDF signature');
  let document: PDFDocument;
  try { document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true }); } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    throw new PdfError(message.includes('password') || message.includes('encrypt') ? 'encrypted-pdf' : 'corrupt-pdf', 'PDF cannot be parsed', { cause: error });
  }
  if (document.getPageCount() > limits.maxPages) throw new PdfError('too-many-pages', 'PDF exceeds the page limit');
  const pages: PdfPageMetadata[] = [];
  let totalViewports = 0;
  for (const [pageIndex, page] of document.getPages().entries()) {
    const context = page.node.context;
    try {
      const mediaBox = bounds(numbers(inherited(page.node, 'MediaBox'), context, '/MediaBox', 4, limits.maxCoordinateMagnitude), '/MediaBox');
      const cropBox = bounds(numbers(inherited(page.node, 'CropBox') ?? inherited(page.node, 'MediaBox'), context, '/CropBox', 4, limits.maxCoordinateMagnitude), '/CropBox');
    const rawRotate = inherited(page.node, 'Rotate'); const rotate = rawRotate === undefined ? 0 : context.lookup(rawRotate, PDFNumber).asNumber();
    if (![0, 90, 180, 270].includes(((rotate % 360) + 360) % 360)) throw new PdfError('invalid-page-geometry', 'Page rotation is unsupported');
    const rawLgi = inherited(page.node, 'LGIDict'); const rawVp = inherited(page.node, 'VP');
    const viewports: PdfViewportMetadata[] = [];
    if (rawLgi !== undefined) { totalViewports += 1; if (totalViewports > limits.maxViewports) throw new PdfError('metadata-limit', 'Viewport count exceeds the metadata limit'); viewports.push(parseLgi(context.lookup(rawLgi, PDFDict), context, limits)); }
    if (rawVp !== undefined) {
      const vp = context.lookup(rawVp, PDFArray);
      totalViewports += vp.size(); if (totalViewports > limits.maxViewports) throw new PdfError('metadata-limit', 'Viewport count exceeds the metadata limit');
      for (const entry of vp.asArray()) {
        const viewport = context.lookup(entry, PDFDict);
        const nested = viewport.get(key('LGIDict'));
        viewports.push(nested !== undefined ? parseLgi(context.lookup(nested, PDFDict), context, limits) : parseIso(viewport, context, limits));
      }
    }
      pages.push({ pageIndex, mediaBox, cropBox, rotation: (((rotate % 360) + 360) % 360) as PdfPageMetadata['rotation'], viewports });
    } catch (error) {
      if (error instanceof PdfError) throw error;
      throw new PdfError('corrupt-pdf', 'PDF metadata object cannot be traversed', { cause: error });
    }
  }
  return { pageCount: document.getPageCount(), pages };
}
