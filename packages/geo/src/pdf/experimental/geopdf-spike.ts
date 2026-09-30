/** Experimental bounded GeoPDF reader. PDF syntax/references are delegated to pdf-lib. */
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFObject, PDFString } from 'pdf-lib';
import proj4 from 'proj4';

export type GeoPdfProfile = 'vp-measure' | 'lgidict';
export type GeoPdfPoint = { x: number; y: number };
export type GeographicPoint = { latitude: number; longitude: number };
export type ExperimentalGeoPdfOptions = { pageIndex?: number; viewportName?: string };
export type ExperimentalGeoPdf = {
  profile: GeoPdfProfile; pageIndex: number; pageCount: number;
  page: { mediaBox: [number, number, number, number]; cropBox: [number, number, number, number]; rotate: number };
  viewportName: string | null; sourceCrs: string;
  axisOrder: 'latitude-longitude' | 'longitude-latitude' | 'easting-northing';
  lpts: GeoPdfPoint[]; gpts: GeographicPoint[];
  bounds: { minLatitude: number; minLongitude: number; maxLatitude: number; maxLongitude: number };
  pageToGeo(point: GeoPdfPoint): GeographicPoint; geoToPage(point: GeographicPoint): GeoPdfPoint;
};

const verifiedProjectedCrs = {
  code: 'EPSG:32620',
  wkt: 'PROJCS["WGS_1984_UTM_Zone_20N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-63.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]',
} as const;
const normalizeWkt = (value: string): string => value.replace(/\s+/g, '');
const key = (value: string): PDFName => PDFName.of(value);
type Context = PDFDict['context'];

const resolve = (value: PDFObject | undefined, context: Context): PDFObject | undefined => value === undefined ? undefined : context.lookup(value);

function inherited(page: PDFDict, field: string): PDFObject | undefined {
  let current: PDFDict | undefined = page;
  while (current) {
    const value = current.get(key(field));
    if (value !== undefined) return resolve(value, current.context);
    current = current.lookupMaybe(key('Parent'), PDFDict);
  }
  return undefined;
}

const dict = (value: PDFObject | undefined, context: Context): PDFDict => {
  const result = value === undefined ? undefined : context.lookup(value, PDFDict);
  if (!result) throw new Error('Expected PDF dictionary');
  return result;
};
const array = (value: PDFObject | undefined, context: Context): PDFArray => {
  const result = value === undefined ? undefined : context.lookup(value, PDFArray);
  if (!result) throw new Error('Expected PDF array');
  return result;
};
const nums = (value: PDFObject | undefined, context: Context, label: string): number[] => {
  const result = array(value, context).asArray().map((entry) => context.lookup(entry, PDFNumber).asNumber());
  if (result.some((entry) => !Number.isFinite(entry))) throw new Error(`${label} must contain finite numbers`);
  return result;
};
const four = (values: number[], label: string): [number, number, number, number] => {
  if (values.length !== 4) throw new Error(`${label} must have four numbers`);
  return [values[0]!, values[1]!, values[2]!, values[3]!];
};
const pairs = (values: number[], label: string): GeoPdfPoint[] => {
  if (values.length !== 8) throw new Error(`${label} must contain exactly four points`);
  return Array.from({ length: 4 }, (_, index) => ({ x: values[index * 2]!, y: values[index * 2 + 1]! }));
};
const text = (value: PDFObject | undefined, context: Context): string | undefined => {
  const result = resolve(value, context);
  return result instanceof PDFString || result instanceof PDFHexString ? result.decodeText() : undefined;
};
const pdfName = (value: PDFObject | undefined, context: Context): string | undefined => {
  const result = resolve(value, context);
  return result instanceof PDFName ? result.decodeText() : undefined;
};

function affine(source: GeoPdfPoint[], target: GeographicPoint[]) {
  if (source.length !== 4 || target.length !== 4) throw new Error('Exactly four corner points are required');
  const [p0, p1, p2] = source;
  const determinant = (p1!.x - p0!.x) * (p2!.y - p0!.y) - (p2!.x - p0!.x) * (p1!.y - p0!.y);
  if (determinant === 0) throw new Error('Degenerate georeference extent');
  const solve = (v0: number, v1: number, v2: number): [number, number, number] => {
    const a = ((v1 - v0) * (p2!.y - p0!.y) - (v2 - v0) * (p1!.y - p0!.y)) / determinant;
    const b = ((p1!.x - p0!.x) * (v2 - v0) - (p2!.x - p0!.x) * (v1 - v0)) / determinant;
    return [a, b, v0 - a * p0!.x - b * p0!.y];
  };
  const [lonX, lonY, lonOrigin] = solve(target[0]!.longitude, target[1]!.longitude, target[2]!.longitude);
  const [latX, latY, latOrigin] = solve(target[0]!.latitude, target[1]!.latitude, target[2]!.latitude);
  const inverseDeterminant = lonX * latY - lonY * latX;
  if (!Number.isFinite(inverseDeterminant) || inverseDeterminant === 0) throw new Error('Degenerate georeference scale');
  for (const [index, point] of source.entries()) {
    const actual = { latitude: latX * point.x + latY * point.y + latOrigin, longitude: lonX * point.x + lonY * point.y + lonOrigin };
    if (Math.abs(actual.latitude - target[index]!.latitude) > 1e-5 || Math.abs(actual.longitude - target[index]!.longitude) > 1e-5) throw new Error('Non-affine or unsupported point order');
  }
  return {
    pageToGeo: (point: GeoPdfPoint): GeographicPoint => ({ latitude: latX * point.x + latY * point.y + latOrigin, longitude: lonX * point.x + lonY * point.y + lonOrigin }),
    geoToPage: (point: GeographicPoint): GeoPdfPoint => ({ x: (latY * (point.longitude - lonOrigin) - lonY * (point.latitude - latOrigin)) / inverseDeterminant, y: (-latX * (point.longitude - lonOrigin) + lonX * (point.latitude - latOrigin)) / inverseDeterminant }),
  };
}

function parseLgi(raw: PDFObject, context: Context): { profile: GeoPdfProfile; name: string | null; lpts: GeoPdfPoint[]; gpts: GeographicPoint[]; sourceCrs: string; axisOrder: ExperimentalGeoPdf['axisOrder'] } {
  const lgi = dict(raw, context);
  if (lgi.has(key('Display')) || lgi.has(key('LGIT:Info'))) throw new Error('Unsupported LGIDict variant');
  const ctm = nums(lgi.get(key('CTM')), context, '/CTM');
  const neatline = nums(lgi.get(key('Neatline')), context, '/Neatline');
  if (ctm.length !== 6 || neatline.length !== 8) throw new Error('Unsupported LGIDict geometry');
  const projection = dict(lgi.get(key('Projection')), context);
  if (pdfName(projection.get(key('ProjectionType')), context) !== 'GEOGRAPHIC' || pdfName(projection.get(key('Datum')), context) !== 'WGE') throw new Error('Unsupported LGIDict CRS');
  const lpts = pairs(neatline, '/Neatline');
  const gpts = lpts.map((point) => ({ latitude: ctm[1]! * point.x + ctm[3]! * point.y + ctm[5]!, longitude: ctm[0]! * point.x + ctm[2]! * point.y + ctm[4]! }));
  return { profile: 'lgidict', name: null, lpts, gpts, sourceCrs: 'EPSG:4326', axisOrder: 'longitude-latitude' };
}

function profileFromPage(page: PDFDict, options: ExperimentalGeoPdfOptions) {
  const context = page.context;
  const rawLgi = inherited(page, 'LGIDict');
  if (rawLgi !== undefined) return parseLgi(rawLgi, context);
  const vpValue = inherited(page, 'VP');
  if (vpValue === undefined) throw new Error('Unsupported GeoPDF profile');
  const viewports = array(vpValue, context).asArray().map((entry) => dict(entry, context));
  const selected = options.viewportName === undefined ? viewports : viewports.filter((entry) => text(entry.get(key('Name')), context) === options.viewportName);
  if (selected.length === 0) throw new Error(options.viewportName === undefined ? 'No viewport found' : `Viewport not found: ${options.viewportName}`);
  if (selected.length !== 1) throw new Error('Ambiguous viewport; explicit viewportName required');
  const viewport = selected[0]!;
  const viewportName = text(viewport.get(key('Name')), context) ?? null;
  const viewportLgi = viewport.get(key('LGIDict'));
  if (viewportLgi !== undefined) return parseLgi(viewportLgi, context);
  const measure = dict(viewport.get(key('Measure')), context);
  const nestedLgi = measure.get(key('LGIDict'));
  if (nestedLgi !== undefined) return parseLgi(nestedLgi, context);
  if (pdfName(measure.get(key('Type')), context) !== 'Measure' || pdfName(measure.get(key('Subtype')), context) !== 'GEO') throw new Error('Unsupported viewport measure');
  const normalizedLpts = pairs(nums(measure.get(key('LPTS')), context, '/LPTS'), '/LPTS');
  const gptValues = nums(measure.get(key('GPTS')), context, '/GPTS');
  if (gptValues.length !== 8) throw new Error('/GPTS must contain exactly four points');
  const gcs = dict(measure.get(key('GCS')), context);
  const wkt = text(gcs.get(key('WKT')), context);
  const sourceCrs = wkt !== undefined && normalizeWkt(wkt) === normalizeWkt(verifiedProjectedCrs.wkt) ? verifiedProjectedCrs.code : gcs.lookupMaybe(key('EPSG'), PDFNumber)?.asNumber() === 4326 ? 'EPSG:4326' : 'UNKNOWN';
  if (sourceCrs === 'UNKNOWN') throw new Error('Unsupported CRS');
  const bbox = four(nums(viewport.get(key('BBox')), context, '/BBox'), '/BBox');
  const lpts = normalizedLpts.map((point) => ({ x: bbox[0] + point.x * (bbox[2] - bbox[0]), y: bbox[1] + point.y * (bbox[3] - bbox[1]) }));
  if (sourceCrs === 'EPSG:4326') {
    const gpts = Array.from({ length: 4 }, (_, index) => ({ latitude: gptValues[index * 2]!, longitude: gptValues[index * 2 + 1]! }));
    if (gpts.some((point) => Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180)) throw new Error('Invalid WGS84 GPTS');
    return { profile: 'vp-measure' as const, name: viewportName, lpts, gpts, sourceCrs, axisOrder: 'latitude-longitude' as const };
  }
  const gpts = Array.from({ length: 4 }, (_, index) => { const [longitude, latitude] = proj4(sourceCrs, 'EPSG:4326', [gptValues[index * 2]!, gptValues[index * 2 + 1]!]); return { latitude, longitude }; });
  return { profile: 'vp-measure' as const, name: viewportName, lpts, gpts, sourceCrs, axisOrder: 'easting-northing' as const };
}

export async function parseExperimentalGeoPdf(bytes: Uint8Array, options: ExperimentalGeoPdfOptions = {}): Promise<ExperimentalGeoPdf> {
  const source = new TextDecoder('latin1').decode(bytes);
  if (!source.startsWith('%PDF-')) throw new Error('Not a PDF');
  const document = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  const pageIndex = options.pageIndex ?? 0;
  const page = document.getPages()[pageIndex];
  if (!page) throw new Error(`Page out of range: ${pageIndex}`);
  const context = page.node.context;
  const mediaBox = four(nums(inherited(page.node, 'MediaBox'), context, '/MediaBox'), '/MediaBox');
  const cropBox = four(nums(inherited(page.node, 'CropBox') ?? inherited(page.node, 'MediaBox'), context, '/CropBox'), '/CropBox');
  const rotateValue = inherited(page.node, 'Rotate');
  const rotate = rotateValue === undefined ? 0 : context.lookup(rotateValue, PDFNumber).asNumber();
  const normalizedRotate = ((rotate % 360) + 360) % 360;
  if (![0, 90, 180, 270].includes(normalizedRotate)) throw new Error('Unsupported page rotation');
  const profile = profileFromPage(page.node, options);
  const transform = affine(profile.lpts, profile.gpts);
  const latitudes = profile.gpts.map((point) => point.latitude); const longitudes = profile.gpts.map((point) => point.longitude);
  return { profile: profile.profile, pageIndex, pageCount: document.getPageCount(), page: { mediaBox, cropBox, rotate: normalizedRotate }, viewportName: profile.name, sourceCrs: profile.sourceCrs, axisOrder: profile.axisOrder, lpts: profile.lpts, gpts: profile.gpts, bounds: { minLatitude: Math.min(...latitudes), minLongitude: Math.min(...longitudes), maxLatitude: Math.max(...latitudes), maxLongitude: Math.max(...longitudes) }, ...transform };
}

export function rasterizationFeasibility(): { status: 'PENDING'; reason: string } {
  return { status: 'PENDING', reason: 'PDF.js worker/render integration remains outside this experimental geo adapter.' };
}
