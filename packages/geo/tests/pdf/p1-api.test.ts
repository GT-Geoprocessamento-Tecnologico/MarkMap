import { describe, expect, it } from 'vitest';
import type { GeoReference as ContractGeoReference } from '@geonexo/contracts';
import { PdfError, inspectPdf, lonLatToPage, pageToLonLat, resolveIsoMeasure, resolveOgcLgiDict } from '../../src/pdf/index';
import { createGeoReference, fitAffine } from '../../src/pdf/transform';
import { resolveCrsId } from '../../src/pdf/crs-registry';
import { generateGeoPdfFixture } from './fixtures/generate-geopdf';

describe('GEO P1 bounded parser and native CRS transform', () => {
  it('keeps WGS84 GPTS axis conversion and PDF BBox mapping at the public edge', async () => {
    const inspection = await inspectPdf(generateGeoPdfFixture({ includeLgiDict: false }));
    const reference = resolveIsoMeasure(inspection.pages[0]!);
    const canonical: ContractGeoReference = reference;
    expect(Object.keys(canonical).sort()).toEqual(['controls', 'cropBox', 'neatline', 'pageIndex', 'profile', 'residual', 'rotation', 'sourceCrs', 'transform']);
    expect(reference.sourceCrs).toBe('EPSG:4326');
    expect(reference.controls[0]!.page).toEqual([10, 120]);
    expect(reference.controls[0]!.ground).toEqual([-69, 10]);
    expect(pageToLonLat(reference, [110, 70])).toEqual([-69.5, 10.5]);
    expect(lonLatToPage(reference, [-69.5, 10.5])?.[0]).toBeCloseTo(110, 10);
    expect(lonLatToPage(reference, [-69.5, 10.5])?.[1]).toBeCloseTo(70, 10);
  });

  it('fits UTM controls in metres and only converts at the WGS84 boundary', async () => {
    const inspection = await inspectPdf(generateGeoPdfFixture({ includeLgiDict: false, projectedCrs: true }));
    const reference = resolveIsoMeasure(inspection.pages[0]!);
    expect(reference.sourceCrs).toBe('EPSG:32620');
    expect(reference.controls[0]!.ground).toEqual([500000.125, 4900000.125]);
    expect(reference.residual.independentCheck).toBe(true);
    expect(reference.residual.maxMeters).toBeLessThan(1);
    expect(pageToLonLat(reference, [10, 120])[0]).toBeCloseTo(-62.999998434218, 10);
    expect(pageToLonLat(reference, [10, 120])[1]).toBeCloseTo(44.2532386441, 10);
  });

  it('keeps the bounded OGC LGIDict profile separate from ISO measure', async () => {
    const inspection = await inspectPdf(generateGeoPdfFixture());
    const reference = resolveOgcLgiDict(inspection.pages[0]!);
    expect(reference.profile).toBe('ogc-lgidict');
    expect(reference.sourceCrs).toBe('EPSG:4326');
    expect(pageToLonLat(reference, [10, 120])).toEqual([2.5, 54]);
  });

  it('rejects unsupported projected CRS and oversized native UTM extents', async () => {
    await expect(inspectPdf(generateGeoPdfFixture({ includeLgiDict: false, unknownCrs: true }))).rejects.toMatchObject({ code: 'unsupported-crs' });
    await expect(inspectPdf(generateGeoPdfFixture({ includeLgiDict: false, unsupportedEpsg: 3857 }))).rejects.toMatchObject({ code: 'unsupported-crs' });
    const crs = resolveCrsId('EPSG:32620');
    expect(() => createGeoReference({ profile: 'iso-measure-geo', sourceCrs: crs.id, pageIndex: 0, cropBox: [0, 0, 200, 200], rotation: 0, neatline: [[0, 0], [200, 0], [200, 200], [0, 200]], controls: [{ page: [0, 0], ground: [500000, 4900000] }, { page: [100, 0], ground: [500200, 4900000] }, { page: [0, 100], ground: [500000, 4900100] }] }, crs)).toThrowError(PdfError);
  });

  it('limits the transformed neatline even when the fitted controls cover a small area', () => {
    const crs = resolveCrsId('EPSG:32620');
    expect(() => createGeoReference({ profile: 'iso-measure-geo', sourceCrs: crs.id, pageIndex: 0, cropBox: [0, 0, 200, 200], rotation: 0, neatline: [[0, 0], [200, 0], [200, 200], [0, 200]], controls: [{ page: [10, 10], ground: [500000, 4900000] }, { page: [20, 10], ground: [500010, 4900000] }, { page: [10, 20], ground: [500000, 4900010] }] }, crs)).toThrowError(PdfError);
  });

  it('checks transformed UTM coordinates against the published longitude/latitude area', () => {
    const crs = resolveCrsId('EPSG:32620');
    expect(() => createGeoReference({ profile: 'iso-measure-geo', sourceCrs: crs.id, pageIndex: 0, cropBox: [0, 0, 100, 100], rotation: 0, neatline: [[0, 0], [10, 0], [0, 10]], controls: [{ page: [0, 0], ground: [166021, 9328000] }, { page: [10, 0], ground: [166031, 9328000] }, { page: [0, 10], ground: [166021, 9328010] }] }, crs)).toThrowError(PdfError);
  });

  it('rejects scale-invariant near-collinear page controls', () => {
    expect(() => fitAffine([
      { page: [0, 0], ground: [500000, 4900000] },
      { page: [1_000_000, 1], ground: [500010, 4900010] },
      { page: [2_000_000, 2.000001], ground: [500020, 4900020] },
    ])).toThrowError(PdfError);
  });

  it('honors a stricter metadata coordinate magnitude limit', async () => {
    await expect(inspectPdf(generateGeoPdfFixture({ includeLgiDict: false }), { maxCoordinateMagnitude: 10 })).rejects.toMatchObject({ code: 'invalid-control-points' });
  });

  it('maps malformed dictionary references to a deterministic PdfError code', async () => {
    const original = new TextDecoder().decode(generateGeoPdfFixture({ includeLgiDict: false }));
    const bytes = new TextEncoder().encode(original.replace('/Measure 6 0 R', '/Measure 99 0 R'));
    await expect(inspectPdf(bytes)).rejects.toMatchObject({ code: 'corrupt-pdf' });
  });

  it('does not auto-position a PDF with no geospatial dictionaries', async () => {
    const original = new TextDecoder().decode(generateGeoPdfFixture({ includeLgiDict: false }));
    const bytes = new TextEncoder().encode(original.replace('/VP [5 0 R]', '           '));
    const inspection = await inspectPdf(bytes);
    expect(inspection.pages[0]!.viewports).toHaveLength(0);
    expect(() => resolveIsoMeasure(inspection.pages[0]!)).toThrowError(PdfError);
  });
});
