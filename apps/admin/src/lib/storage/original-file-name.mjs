/** The displayed name changes, never the original bytes or its MIME type. */
export function normalizeImportedOriginalName(rawName, mediaType, previousName) {
  if (typeof rawName !== 'string' || (mediaType !== 'application/pdf' && mediaType !== 'image/tiff')) {
    throw new Error('Formato de arquivo local inválido.');
  }
  const value = rawName.normalize('NFC').trim();
  if (!value || /[\\/:*?"<>|\u0000-\u001F\u007F]/u.test(value) || value === '.' || value === '..') {
    throw new Error('Informe um nome válido, sem caracteres reservados.');
  }
  const previousSuffix = mediaType === 'application/pdf' ? 'pdf'
    : /\.tiff$/i.test(previousName ?? '') ? 'tiff' : 'tif';
  const suffix = /\.(pdf|tiff|tif)$/i.exec(value);
  if (suffix && (mediaType === 'application/pdf') !== (suffix[1].toLowerCase() === 'pdf')) {
    throw new Error('A extensão não pode mudar o tipo do arquivo original.');
  }
  const base = (suffix ? value.slice(0, -suffix[0].length) : value).trim();
  if (!base || base === '.' || base === '..' || /[. ]$/.test(base)) {
    throw new Error('Informe um nome válido antes da extensão.');
  }
  const name = `${base}.${suffix ? suffix[1].toLowerCase() : previousSuffix}`;
  if (name.length > 120) throw new Error('O nome deve ter até 120 caracteres.');
  return name;
}
