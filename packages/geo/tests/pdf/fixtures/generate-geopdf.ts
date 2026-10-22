const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const encodePdf = (objects: string[]): Uint8Array => {
  let pdf = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
};

/** Generates a deterministic, lawful, minimal PDF fixture for the P0 spike. */
export function generateGeoPdfFixture(options: { includeLgiDict?: boolean; projectedCrs?: boolean; unsupportedLgi?: boolean; unknownCrs?: boolean; unsupportedEpsg?: number; insetViewport?: boolean } = {}): Uint8Array {
  const lgiDict = options.includeLgiDict === false ? '' : ' /LGIDict 7 0 R';
  const lgiObject = options.includeLgiDict === false
    ? '<< /Version 1.0 /Projection << /EPSG 4326 >> /Registration [10 20 110 20 10 120 110 120] >>'
    : options.unsupportedLgi
      ? '<< /Type /LGIDict /Version 2.1 /Display << /Name (unsupported) >> >>'
      : '<< /Type /LGIDict /Version 2.1 /CTM [0.05 0 0 0.05 2 48] /Projection << /Datum /WGE /ProjectionType /GEOGRAPHIC >> /Neatline [10 120 10 20 210 20 210 120] >>';
  const gcs = options.unknownCrs
    ? '/GCS << /Type /GEOGCS /EPSG 9999 >>'
    : options.unsupportedEpsg !== undefined
      ? `/GCS << /Type /PROJCS /EPSG ${options.unsupportedEpsg} >>`
    : options.projectedCrs
      ? '/GCS << /Type /PROJCS /WKT (PROJCS["WGS_1984_UTM_Zone_20N",GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-63.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]) >>'
    : '/GCS << /Type /GEOGCS /EPSG 4326 >>';
  const bbox = options.insetViewport ? '[60 40 170 100]' : '[10 20 210 120]';
  const lpts = options.insetViewport ? '[0.1 0.9 0.1 0.1 0.9 0.1 0.9 0.9]' : '[0 1 0 0 1 0 1 1]';
  const gpts = options.projectedCrs ? '[500000.125 4900000.125 500000.125 4900100.125 500100.125 4900100.125 500100.125 4900000.125]' : '[10 -69 10 -70 11 -70 11 -69]';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 140] /CropBox [10 20 210 120] /Rotate 90 /VP [5 0 R] /Contents 4 0 R >>',
    `<< /Length ${escape('BT /F1 12 Tf 20 40 Td (GeoNexo feasibility fixture) Tj ET').length} >>\nstream\nBT /F1 12 Tf 20 40 Td (${escape('GeoNexo feasibility fixture')}) Tj ET\nendstream`,
    `<< /Type /Viewport /BBox ${bbox} /Measure 6 0 R${lgiDict} >>`,
    `<< /Type /Measure /Subtype /GEO /GPTS ${gpts} /LPTS ${lpts} ${gcs} >>`,
    lgiObject,
  ];
  return encodePdf(objects);
}

/** Two-page fixture for inherited page attributes, indirect viewports and ambiguity. */
export function generateInheritedMultiPageFixture(): Uint8Array {
  return encodePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 /MediaBox [0 0 240 140] /CropBox [10 20 210 120] /Rotate 90 >>',
    '<< /Type /Page /Parent 2 0 R /VP [5 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /VP [6 0 R 7 0 R] >>',
    '<< /Type /Viewport /Name (First) /BBox [10 20 210 120] /Measure 8 0 R >>',
    '<< /Type /Viewport /Name (Map A) /BBox [0 0 200 100] /Measure 8 0 R >>',
    '<< /Type /Viewport /Name (Map B) /BBox [0 0 200 100] /Measure 9 0 R >>',
    '<< /Type /Measure /Subtype /GEO /GPTS [10 -69 10 -70 11 -70 11 -69] /LPTS [0 1 0 0 1 0 1 1] /GCS << /Type /GEOGCS /EPSG 4326 >> >>',
    '<< /Type /Measure /Subtype /GEO /GPTS [20 -69 20 -70 21 -70 21 -69] /LPTS [0 1 0 0 1 0 1 1] /GCS << /Type /GEOGCS /EPSG 4326 >> >>',
  ]);
}
