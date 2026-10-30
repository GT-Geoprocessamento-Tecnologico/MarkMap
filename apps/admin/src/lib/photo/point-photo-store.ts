import { localRepository, type OriginalRecord } from '../local-repositories';
import { readBlobBytes } from '../blob-bytes';
import {
  MAX_POINT_PHOTO_SOURCE_BYTES,
  MAX_POINT_PHOTO_STORED_BYTES,
  MAX_POINT_PHOTOS,
  isPhotoMediaType,
  validPointPhotoLink,
  validatePhotoBytes,
  type PointPhotoLink,
} from './point-photo-policy.mjs';

const MAX_WORKSPACE_PHOTO_BYTES = 6_000_000; // bounded by the existing 16 MiB partial backup

export type SavedPointPhoto = OriginalRecord & { pointPhoto: PointPhotoLink };
function isPhoto(record: OriginalRecord): record is SavedPointPhoto {
  return isPhotoMediaType(record.mediaType) && validPointPhotoLink(record.pointPhoto);
}
function linked(record: SavedPointPhoto, link: PointPhotoLink) {
  return record.pointPhoto.featureId === link.featureId &&
    record.pointPhoto.layerId === link.layerId &&
    record.pointPhoto.projectId === link.projectId;
}
export async function listPointPhotos(link: PointPhotoLink): Promise<SavedPointPhoto[]> {
  if (!validPointPhotoLink(link)) throw new Error('Ponto inválido para fotos.');
  return (await localRepository.listOriginals()).filter((record): record is SavedPointPhoto =>
    isPhoto(record) && linked(record, link)).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
}

async function openPhotoImage(blob: Blob): Promise<{ image: CanvasImageSource; width: number; height: number; dispose(): void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return { image: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch { /* Older WebKit may need the Image fallback. */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight,
      dispose: () => { image.src = ''; URL.revokeObjectURL(url); } });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('O dispositivo não conseguiu abrir a imagem.')); };
    image.src = url;
  });
}

/** Rasterize to JPEG to remove location EXIF metadata and bound device storage. */
export async function encodePrivatePointPhoto(file: Blob): Promise<Blob> {
  if (!(file instanceof Blob) || file.size < 1 || file.size > MAX_POINT_PHOTO_SOURCE_BYTES ||
      !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type))
    throw new Error('Selecione uma foto JPEG, PNG, WebP ou HEIC de até 16 MB.');
  const source = await openPhotoImage(file);
  try {
    if (!(source.width > 0 && source.height > 0) || source.width * source.height > 85_000_000)
      throw new Error('Dimensões da imagem inválidas ou excessivas.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não disponibilizou processamento de fotos.');
    for (const maxEdge of [1600, 1280, 1024, 800]) {
      const ratio = Math.min(1, maxEdge / Math.max(source.width, source.height));
      canvas.width = Math.max(1, Math.round(source.width * ratio));
      canvas.height = Math.max(1, Math.round(source.height * ratio));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
      const photo = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Conversão de foto falhou.')),
          'image/jpeg', 0.78));
      if (photo.type === 'image/jpeg' && photo.size <= MAX_POINT_PHOTO_STORED_BYTES && photo.size > 0) {
        validatePhotoBytes('image/jpeg', new Uint8Array(await readBlobBytes(photo)));
        return photo;
      }
    }
    throw new Error('Foto muito grande mesmo após compressão. Tente outra imagem.');
  } finally { source.dispose(); }
}

export async function addPointPhoto(link: PointPhotoLink, file: File): Promise<void> {
  if (!validPointPhotoLink(link)) throw new Error('Projeto ou ponto inválido.');
  const stored = await localRepository.listOriginals();
  const allPhotos = stored.filter(isPhoto);
  if (allPhotos.filter((photo) => linked(photo, link)).length >= MAX_POINT_PHOTOS)
    throw new Error(`Limite de ${MAX_POINT_PHOTOS} fotos por ponto neste dispositivo.`);
  const photo = await encodePrivatePointPhoto(file);
  if (allPhotos.reduce((sum, row) => sum + row.bytes, 0) + photo.size > MAX_WORKSPACE_PHOTO_BYTES)
    throw new Error('Espaço reservado para fotos do workspace atingiu o limite do backup parcial (6 MB).');
  const bytes = await readBlobBytes(photo);
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await localRepository.saveOriginal({
    blobId: crypto.randomUUID(), blob: photo, mediaType: 'image/jpeg',
    bytes: photo.size, sha256, originalName: (file.name || 'foto.jpg').replace(/[\\/\x00-\x1f]/g, '_').slice(0, 120),
    pointPhoto: { ...link },
  });
}
export async function removePointPhoto(link: PointPhotoLink, photoId: string): Promise<void> {
  if (!validPointPhotoLink(link)) throw new Error('Ponto inválido.');
  await localRepository.deletePointPhoto(photoId, link);
}