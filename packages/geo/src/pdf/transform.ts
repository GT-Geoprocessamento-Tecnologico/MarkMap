import { PdfError } from './errors.js';
import { resolveCrsId, validateNativePoint, type PdfCrs } from './crs-registry.js';
import type { ControlPoint, GeoReference, LonLat, PagePoint } from './types.js';

type Coefficients = [number, number, number, number, number, number];

const finite = (value: number): boolean => Number.isFinite(value);
const apply = (coefficients: Coefficients, point: PagePoint): PagePoint => [
  coefficients[0] * point[0] + coefficients[1] * point[1] + coefficients[2],
  coefficients[3] * point[0] + coefficients[4] * point[1] + coefficients[5],
];

function solve3(matrix: number[][], rhs: number[]): [number, number, number] {
  const a = matrix.map((row, index) => [...row, rhs[index]!]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) if (Math.abs(a[row]![column]!) > Math.abs(a[pivot]![column]!)) pivot = row;
    if (!Number.isFinite(a[pivot]![column]) || Math.abs(a[pivot]![column]!) < 1e-14) throw new PdfError('degenerate-transform', 'Affine control points are singular');
    [a[column], a[pivot]] = [a[pivot]!, a[column]!];
    const divisor = a[column]![column]!;
    for (let j = column; j < 4; j += 1) a[column]![j]! /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = a[row]![column]!;
      for (let j = column; j < 4; j += 1) a[row]![j]! -= factor * a[column]![j]!;
    }
  }
  const result = [a[0]![3]!, a[1]![3]!, a[2]![3]!] as [number, number, number];
  if (!result.every(finite)) throw new PdfError('degenerate-transform', 'Affine coefficients are not finite');
  return result;
}

export function fitAffine(controlPoints: readonly ControlPoint[]): Coefficients {
  if (controlPoints.length < 3) throw new PdfError('invalid-control-points', 'At least three control points are required');
  if (isDegeneratePageGeometry(controlPoints)) throw new PdfError('degenerate-transform', 'Affine page control points are collinear or ill-conditioned');
  const meanX = controlPoints.reduce((sum, control) => sum + control.page[0], 0) / controlPoints.length;
  const meanY = controlPoints.reduce((sum, control) => sum + control.page[1], 0) / controlPoints.length;
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, controlPoints.length]];
  const bx = [0, 0, 0]; const by = [0, 0, 0];
  for (const control of controlPoints) {
    const x = control.page[0] - meanX; const y = control.page[1] - meanY;
    matrix[0]![0]! += x * x; matrix[0]![1]! += x * y; matrix[1]![0]! += x * y; matrix[1]![1]! += y * y;
    bx[0]! += x * control.ground[0]; bx[1]! += y * control.ground[0]; bx[2]! += control.ground[0];
    by[0]! += x * control.ground[1]; by[1]! += y * control.ground[1]; by[2]! += control.ground[1];
  }
  const x = solve3(matrix, bx); const y = solve3(matrix, by);
  return [x[0], x[1], x[2] - x[0] * meanX - x[1] * meanY, y[0], y[1], y[2] - y[0] * meanX - y[1] * meanY];
}

// Adapted algorithmically from TacMap's MIT-licensed
// ios/TacticalMaps/Calibration/AffineTransform2D.swift
// (SHA-256 CB347A2D4B66273388BA5E9C7A9E0E0E44C6984DBC962063617AF3B1D419521C).
function isDegeneratePageGeometry(controlPoints: readonly ControlPoint[]): boolean {
  const count = controlPoints.length;
  const meanX = controlPoints.reduce((sum, control) => sum + control.page[0], 0) / count;
  const meanY = controlPoints.reduce((sum, control) => sum + control.page[1], 0) / count;
  let xx = 0; let yy = 0; let xy = 0;
  for (const control of controlPoints) {
    const x = control.page[0] - meanX; const y = control.page[1] - meanY;
    xx += x * x; yy += y * y; xy += x * y;
  }
  const trace = xx + yy; const discriminant = Math.max(0, trace * trace - 4 * (xx * yy - xy * xy));
  const largest = (trace + Math.sqrt(discriminant)) / 2; const smallest = (trace - Math.sqrt(discriminant)) / 2;
  return !Number.isFinite(largest) || largest <= 0 || !Number.isFinite(smallest) || smallest / largest < 1e-6;
}

function inverse(coefficients: Coefficients, point: PagePoint): PagePoint | null {
  const determinant = coefficients[0] * coefficients[4] - coefficients[1] * coefficients[3];
  const scale = Math.hypot(coefficients[0], coefficients[1]) * Math.hypot(coefficients[3], coefficients[4]);
  if (!finite(determinant) || !finite(scale) || scale <= 0 || Math.abs(determinant) <= 1e-12 * scale) return null;
  const dx = point[0] - coefficients[2]; const dy = point[1] - coefficients[5];
  const result: PagePoint = [(coefficients[4] * dx - coefficients[1] * dy) / determinant, (-coefficients[3] * dx + coefficients[0] * dy) / determinant];
  return result.every(finite) ? result : null;
}

function distanceMeters(first: LonLat, second: LonLat): number {
  const radians = Math.PI / 180; const dLat = (second[1] - first[1]) * radians; const dLon = (second[0] - first[0]) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(first[1] * radians) * Math.cos(second[1] * radians) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function residuals(coefficients: Coefficients, controls: readonly ControlPoint[], crs: PdfCrs): number[] {
  return controls.map((control) => distanceMeters(crs.toWgs84(apply(coefficients, control.page)), crs.toWgs84(control.ground)));
}

function independentResidual(controls: readonly ControlPoint[], crs: PdfCrs): number | null {
  if (controls.length < 4) return null;
  let maximum = 0;
  for (let omitted = 0; omitted < controls.length; omitted += 1) {
    const training = controls.filter((_, index) => index !== omitted);
    const fitted = fitAffine(training);
    const predicted = crs.toWgs84(apply(fitted, controls[omitted]!.page));
    const actual = crs.toWgs84(controls[omitted]!.ground);
    maximum = Math.max(maximum, distanceMeters(predicted, actual));
  }
  return maximum;
}

export function createGeoReference(input: {
  profile: GeoReference['profile']; sourceCrs: string; pageIndex: number;
  cropBox: GeoReference['cropBox']; rotation: GeoReference['rotation']; controls: readonly ControlPoint[];
  neatline: readonly PagePoint[];
  maxIndependentErrorMeters?: number;
}, crs: PdfCrs): GeoReference {
  if (input.controls.length > 8192 || input.neatline.length > 8192) throw new PdfError('metadata-limit', 'GeoPDF control metadata exceeds the P1 limit');
  for (const control of input.controls) {
    validateNativePoint(crs, control.ground);
    if (!control.page.every(finite) || control.page[0] < input.cropBox[0] - 1e-5 || control.page[0] > input.cropBox[2] + 1e-5 || control.page[1] < input.cropBox[1] - 1e-5 || control.page[1] > input.cropBox[3] + 1e-5) throw new PdfError('invalid-control-points', 'Page control point is outside the effective CropBox');
  }
  const coefficients = fitAffine(input.controls);
  const nativeNeatline = input.neatline.map((point) => {
    if (!point.every(finite) || point[0] < input.cropBox[0] - 1e-5 || point[0] > input.cropBox[2] + 1e-5 || point[1] < input.cropBox[1] - 1e-5 || point[1] > input.cropBox[3] + 1e-5) throw new PdfError('invalid-control-points', 'Neatline point is outside the effective CropBox');
    const native = apply(coefficients, point); validateNativePoint(crs, native); return native;
  });
  const neatlineWidth = Math.max(...nativeNeatline.map((point) => point[0])) - Math.min(...nativeNeatline.map((point) => point[0]));
  const neatlineHeight = Math.max(...nativeNeatline.map((point) => point[1])) - Math.min(...nativeNeatline.map((point) => point[1]));
  if (crs.id === 'EPSG:32620' && (neatlineWidth > 100 || neatlineHeight > 100)) throw new PdfError('render-limit', 'UTM20N P1 neatline exceeds 100m by 100m');
  if (crs.id === 'EPSG:32620') {
    const minX = Math.min(...input.neatline.map((point) => point[0])); const maxX = Math.max(...input.neatline.map((point) => point[0]));
    const minY = Math.min(...input.neatline.map((point) => point[1])); const maxY = Math.max(...input.neatline.map((point) => point[1]));
    for (const fraction of [0, 0.5, 1]) for (const other of [0, 0.5, 1]) validateNativePoint(crs, apply(coefficients, [minX + (maxX - minX) * fraction, minY + (maxY - minY) * other]));
  }
  const errors = residuals(coefficients, input.controls, crs);
  const max = Math.max(...errors); const rmse = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length);
  const holdout = independentResidual(input.controls, crs);
  const maximumIndependentError = input.maxIndependentErrorMeters ?? 1;
  if (holdout !== null && holdout > maximumIndependentError)
    throw new PdfError(
      'accuracy-check-failed',
      `Independent GeoPDF control error exceeds ${maximumIndependentError} metres`,
    );
  return { profile: input.profile, sourceCrs: input.sourceCrs, pageIndex: input.pageIndex, cropBox: input.cropBox, rotation: input.rotation, controls: [...input.controls], neatline: [...input.neatline], transform: { model: 'affine', coefficients }, residual: { rmseMeters: rmse, maxMeters: holdout ?? max, independentCheck: holdout !== null } };
}

export function pageToLonLat(reference: GeoReference, point: PagePoint): LonLat {
  if (!point.every(finite)) throw new PdfError('invalid-control-points', 'Page point is not finite');
  const crs = resolveCrsId(reference.sourceCrs);
  return crs.toWgs84(apply(reference.transform.coefficients as Coefficients, point));
}

export function lonLatToPage(reference: GeoReference, point: LonLat): PagePoint | null {
  if (!point.every(finite)) return null;
  let crs: PdfCrs;
  try { crs = resolveCrsId(reference.sourceCrs); } catch { return null; }
  return inverse(reference.transform.coefficients as Coefficients, crs.fromWgs84(point));
}
