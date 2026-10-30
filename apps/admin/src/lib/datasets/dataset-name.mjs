const EXTENSION_BY_FORMAT = Object.freeze({GeoJSON:'geojson',GPX:'gpx',KML:'kml',KMZ:'kmz'});

/** The dataset label is also used as a downloaded filename: preserve its GIS extension. */
export function normalizeDatasetName(raw, format) {
  const extension = EXTENSION_BY_FORMAT[format];
  if (!extension || typeof raw !== 'string') throw new Error('Formato de dataset inválido.');
  const value = raw.normalize('NFC').trim();
  if (!value || /[\\/:*?"<>|\u0000-\u001F\u007F]/u.test(value) || value === '.' || value === '..')
    throw new Error('Informe um nome de arquivo válido, sem caracteres reservados.');
  const suffix = `.${extension}`;
  const lower = value.toLowerCase();
  const base = lower.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
  if (!base.trim()) throw new Error('Informe um nome antes da extensão.');
  const name = `${base}${suffix}`;
  if (name.length > 120) throw new Error('O nome deve ter até 120 caracteres.');
  return name;
}