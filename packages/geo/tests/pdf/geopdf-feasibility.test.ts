import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { parseExperimentalGeoPdf, rasterizationFeasibility } from '../../src/pdf/experimental/geopdf-spike';
import { generateGeoPdfFixture, generateInheritedMultiPageFixture } from './fixtures/generate-geopdf';

describe('GEO-G0.3 P0 GeoPDF feasibility', () => {
  it('parses generated ISO VP/Measure/GPTS/LPTS/GCS metadata offline and maps both directions', async () => {
    const parsed = await parseExperimentalGeoPdf(generateGeoPdfFixture({ includeLgiDict: false }));
    expect(parsed.profile).toBe('vp-measure');
    expect(parsed.page).toEqual({ mediaBox: [0, 0, 240, 140], cropBox: [10, 20, 210, 120], rotate: 90 });
    expect(parsed.bounds).toEqual({ minLatitude: 10, minLongitude: -70, maxLatitude: 11, maxLongitude: -69 });
    expect(parsed.pageToGeo({ x: 110, y: 70 })).toEqual({ latitude: 10.5, longitude: -69.5 });
    expect(parsed.geoToPage({ latitude: 10.5, longitude: -69.5 }).x).toBeCloseTo(110, 8);
    expect(parsed.geoToPage({ latitude: 10.5, longitude: -69.5 }).y).toBeCloseTo(70, 8);
  });

  it('recognizes the mandatory OGC LGIDict profile', async () => {
    const parsed = await parseExperimentalGeoPdf(generateGeoPdfFixture());
    expect(parsed.profile).toBe('lgidict');
  });

  it('keeps product rasterization integration pending outside the experimental geo adapter', () => {
    expect(rasterizationFeasibility()).toEqual({ status: 'PENDING', reason: expect.stringContaining('worker/render') });
  });

  it('resolves indirect viewports and inherited page attributes across pages', async () => {
    const bytes = generateInheritedMultiPageFixture();
    const first = await parseExperimentalGeoPdf(bytes, { pageIndex: 0 });
    expect(first.pageCount).toBe(2);
    expect(first.page.cropBox).toEqual([10, 20, 210, 120]);
    expect(first.page.rotate).toBe(90);
    expect(first.viewportName).toBe('First');
    await expect(parseExperimentalGeoPdf(bytes, { pageIndex: 1 })).rejects.toThrow(/Ambiguous viewport/);
    const selected = await parseExperimentalGeoPdf(bytes, { pageIndex: 1, viewportName: 'Map B' });
    expect(selected.viewportName).toBe('Map B');
    expect(selected.gpts[0]).toEqual({ latitude: 20, longitude: -69 });
  });

  it('records the verified projected CRS and axis order without guessing unsupported CRS', async () => {
    const parsed = await parseExperimentalGeoPdf(generateGeoPdfFixture({ includeLgiDict: false, projectedCrs: true }));
    expect(parsed.sourceCrs).toBe('EPSG:32620');
    expect(parsed.axisOrder).toBe('easting-northing');
    await expect(parseExperimentalGeoPdf(generateGeoPdfFixture({ includeLgiDict: false, unknownCrs: true }))).rejects.toThrow(/Unsupported CRS/);
  });

  it('matches projected control points against independent PROJ reference coordinates within one metre', async () => {
    const parsed = await parseExperimentalGeoPdf(generateGeoPdfFixture({ includeLgiDict: false, projectedCrs: true }));
    const controls = [
      { page: { x: 10, y: 120 }, reference: { longitude: -62.99999843421801, latitude: 44.25323864410052 } },
      { page: { x: 10, y: 20 }, reference: { longitude: -62.99999843419411, latitude: 44.25413895493915 } },
      { page: { x: 210, y: 20 }, reference: { longitude: -62.99874578948633, latitude: 44.25413894805406 } },
      { page: { x: 210, y: 120 }, reference: { longitude: -62.99874580862108, latitude: 44.253238637215645 } },
    ];
    const distanceMeters = (a: { longitude: number; latitude: number }, b: { longitude: number; latitude: number }) => {
      const radians = Math.PI / 180;
      const latitudeDelta = (b.latitude - a.latitude) * radians;
      const longitudeDelta = (b.longitude - a.longitude) * radians;
      const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
      return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(haversine)));
    };
    const errors = controls.map(({ page, reference }) => distanceMeters(parsed.pageToGeo(page), reference));
    expect(errors.every((error) => error < 1)).toBe(true);
    expect(Math.max(...errors)).toBeLessThan(0.002);
  });

  it('fails closed for the unsupported LGIDict Display variant', async () => {
    await expect(parseExperimentalGeoPdf(generateGeoPdfFixture({ unsupportedLgi: true }))).rejects.toThrow(/Unsupported LGIDict variant/);
  });

  it('traverses the same candidate metadata after pdf-lib object-stream compression', async () => {
    const source = await PDFDocument.load(generateGeoPdfFixture({ includeLgiDict: false }), { updateMetadata: false });
    const compressed = await source.save({ useObjectStreams: true });
    const parsed = await parseExperimentalGeoPdf(compressed);
    expect(parsed.profile).toBe('vp-measure');
    expect(parsed.pageToGeo({ x: 110, y: 70 })).toEqual({ latitude: 10.5, longitude: -69.5 });
  });
});
