import { describe, expect, it } from 'vitest';
import { normalizedGeoJSONBlob, parseDatasetFile } from './dataset-store';

function fakeFile(xml: string, name: string): File {
  const file = new File([xml], name, {type:'application/xml'});
  if (typeof file.text !== 'function') Object.defineProperty(file,'text',{value:async()=>xml});
  return file;
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
});
