import { describe, expect, it, vi } from 'vitest';
import { offlineDB } from '../storage/offline-db';
import { exportDataset, getDataset, normalizedGeoJSONBlob, parseDatasetFile, saveDataset } from './dataset-store';

function fakeFile(xml: string, name: string): File {
  const file = new File([xml], name, {type:'application/xml'});
  if (typeof file.text !== 'function') Object.defineProperty(file,'text',{value:async()=>xml});
  if (typeof file.arrayBuffer !== 'function') Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode(xml).buffer});
  return file;
}

async function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('dataset imports from GPX and KML', () => {
  it('keeps original GPX and normalized GeoJSON together', async () => {
    const dataset = await parseDatasetFile(fakeFile('<gpx><wpt lat="-7.2" lon="-48.2"><name>POI</name><ele>340</ele></wpt></gpx>','poi.gpx'));
    expect(dataset.format).toBe('GPX');
    expect(dataset.name).toBe('poi.gpx');
    expect(dataset.featuresCount).toBe(1);
    expect(dataset.geojson.features[0]?.geometry).toEqual({ type:'Point', coordinates:[-48.2,-7.2,340] });
    const exportedBlob = normalizedGeoJSONBlob(dataset);
    const exportedText = typeof exportedBlob.text === 'function'
      ? await exportedBlob.text()
      : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(exportedBlob);
      });
    const exported = JSON.parse(exportedText);
    expect(exported.features[0].properties.name).toBe('POI');
  });
  it('rejects DTD, fake KML and unsupported archives', async () => {
    await expect(parseDatasetFile(fakeFile('<!DOCTYPE foo><gpx><wpt lat="0" lon="0"/></gpx>','a.gpx'))).rejects.toThrow('DTD/ENTITY');
    await expect(parseDatasetFile(fakeFile('<gpx/>','a.kml'))).rejects.toThrow('incompatível');
    await expect(parseDatasetFile(fakeFile('zip','a.kmz'))).rejects.toThrow('KMZ');
  });
  it('accepts KML waypoint as mapped GeoJSON point', async () => {
    const kml='<kml><Document><Placemark><name>Estação</name><Point><coordinates>-48.2,-7.2</coordinates></Point></Placemark></Document></kml>';
    const result=await parseDatasetFile(fakeFile(kml,'estacao.kml'));
    expect(result.format).toBe('KML');
    expect(result.featuresCount).toBe(1);
  });

  it('rejects a KML with valid geometry followed by malformed geometry atomically', async () => {
    const kml = `<kml><Document><Placemark id="mixed.1">
      <name>Misto</name>
      <Point><coordinates>-48.2,-7.2</coordinates></Point>
      <LineString><coordinates>-48.2,-7.2,bad</coordinates></LineString>
    </Placemark></Document></kml>`;
    await expect(parseDatasetFile(fakeFile(kml, 'mixed.kml'))).rejects.toThrow('invalid geometry');
  });

  it('normalizes attributed KML MultiGeometry, saves/reloads it, and keeps the original', async () => {
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark id="survey.1">
      <name>Área de teste</name><ExtendedData><Data name="codigo"><value>A-17</value></Data></ExtendedData>
      <MultiGeometry>
        <Point><coordinates>-48.2,-7.2,340</coordinates></Point>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>-48.21,-7.21,0 -48.19,-7.21,0 -48.19,-7.19,0 -48.21,-7.21,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </MultiGeometry>
    </Placemark></Document></kml>`;
    const source = fakeFile(kml, 'area.kml');
    const dataset = await parseDatasetFile(source);

    expect(dataset.format).toBe('KML');
    expect(dataset.featuresCount).toBe(2);
    expect(dataset.geojson.features[0]?.geometry).toMatchObject({ type: 'Point' });
    expect(dataset.geojson.features[1]?.geometry).toMatchObject({ type: 'Polygon' });
    expect(dataset.geojson.features[0]?.properties).toMatchObject({ name: 'Área de teste', codigo: 'A-17' });

    let stored: Record<string, unknown> | undefined;
    const save = vi.spyOn(offlineDB, 'save').mockImplementation(async (_collection, _id, payload) => {
      stored = payload as Record<string, unknown>;
    });
    // jsdom's ArrayBuffer realm is different from the module realm used by
    // restoreDataset; provide the structured-clone result as a Blob while
    // retaining the saved bytes assertion above.
    const get = vi.spyOn(offlineDB, 'get').mockImplementation(async () => stored ? { ...stored, originalBlob: source } : null);
    try {
      await saveDataset(dataset);
      expect(save).toHaveBeenCalledWith('datasets', dataset.id, expect.objectContaining({
        geojson: dataset.geojson,
      }));
      expect(stored?.originalBytes).toBeTruthy();
      const restored = await getDataset(dataset.id);
      expect(get).toHaveBeenCalledWith('datasets', dataset.id);
      expect(restored?.geojson).toEqual(dataset.geojson);
      expect(await blobText(restored!.originalBlob)).toBe(kml);

      const normalized = JSON.parse(await blobText(normalizedGeoJSONBlob(dataset)));
      expect(normalized.features).toHaveLength(2);

      const anchor = { click: vi.fn(), href: '', download: '' };
      vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLElement);
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dataset');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      await exportDataset(dataset.id);
      expect(anchor.download).toBe('area.kml');
      expect(anchor.click).toHaveBeenCalledOnce();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
