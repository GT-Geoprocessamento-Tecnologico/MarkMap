export interface GeoPdfMetadata {
  isGeoreferenced: boolean;
  epsgCode?: number;
  wkt?: string;
  bbox?: [number, number, number, number];
  neatline?: Array<[number, number]>;
  scaleDenominator?: number;
}

export async function parseGeoPdfMetadata(buffer: ArrayBuffer): Promise<GeoPdfMetadata> {
  const text = new TextDecoder("ascii").decode(new Uint8Array(buffer.slice(0, 15000)));
  const isGeo = text.includes("/Measure") || text.includes("/LGIDict") || text.includes("/GEO") || text.includes("/SpatialReferences");

  if (!isGeo) {
    return { isGeoreferenced: false };
  }

  const epsgMatch = text.match(/\/EPSG\s+(\d+)/i) || text.match(/AUTHORITY\["EPSG","(\d+)"\]/i);
  const bboxMatch = text.match(/\/BBox\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/);

  return {
    isGeoreferenced: true,
    epsgCode: epsgMatch ? parseInt(epsgMatch[1], 10) : 4326,
    bbox: bboxMatch
      ? [parseFloat(bboxMatch[1]), parseFloat(bboxMatch[2]), parseFloat(bboxMatch[3]), parseFloat(bboxMatch[4])]
      : undefined,
  };
}
