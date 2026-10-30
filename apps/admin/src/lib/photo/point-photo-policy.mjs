/** Photo metadata is stored next to the original bytes, not in feature/outbox JSON. */
export const MAX_POINT_PHOTO_SOURCE_BYTES = 16 * 1024 * 1024;
export const MAX_POINT_PHOTO_STORED_BYTES = 1_500_000;
export const MAX_POINT_PHOTOS = 5;
export const POINT_PHOTO_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPhotoMediaType(value) {
  return POINT_PHOTO_MIME_TYPES.includes(value);
}
export function isSupportedBackupOriginalMediaType(value) {
  return value === 'application/pdf' || value === 'image/tiff' || isPhotoMediaType(value);
}
export function validPointPhotoLink(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    UUID.test(value.projectId ?? '') && UUID.test(value.featureId ?? '') &&
    UUID.test(value.layerId ?? '') && Object.keys(value).length === 3;
}
export function validatePhotoBytes(mime, bytes) {
  if (!isPhotoMediaType(mime)) throw new Error('Foto deve ser JPEG, PNG ou WebP.');
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 ||
      bytes.byteLength > MAX_POINT_PHOTO_STORED_BYTES)
    throw new Error('Foto vazia ou maior que 1,5 MB após conversão.');
  if (mime === 'image/jpeg' && !(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff))
    throw new Error('Assinatura JPEG inválida.');
  if (mime === 'image/png' && !([137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)))
    throw new Error('Assinatura PNG inválida.');
  if (mime === 'image/webp' && !(String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'))
    throw new Error('Assinatura WebP inválida.');
}
export function validatePhotoOriginalMetadata(record) {
  const photo = isPhotoMediaType(record?.mediaType);
  if (!photo) {
    if (record?.pointPhoto !== undefined) throw new Error('Referência de foto em arquivo não fotográfico.');
    return;
  }
  if (!validPointPhotoLink(record.pointPhoto)) throw new Error('Foto sem vínculo válido de projeto, camada e ponto.');
  if (!Number.isInteger(record.bytes) || record.bytes < 1 || record.bytes > MAX_POINT_PHOTO_STORED_BYTES)
    throw new Error('Tamanho da foto fora do limite de backup.');
}