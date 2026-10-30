import { useEffect, useRef, useState } from 'react';
import {
  addPointPhoto, listPointPhotos, removePointPhoto,
  type SavedPointPhoto,
} from './point-photo-store';
import type { PointPhotoLink } from './point-photo-policy.mjs';

interface Props {
  link: PointPhotoLink;
  onVerify: () => Promise<void>;
}
type PhotoView = { id: string; url: string; title: string };

/** Client-only originals: no photo bytes in feature properties or sync outbox. */
export function ProjectPointPhotos({ link, onVerify }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState(0);
  const [photos, setPhotos] = useState<PhotoView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setLoading(true);
    void listPointPhotos(link).then((records: SavedPointPhoto[]) => {
      if (cancelled) return;
      const views = records.map((record) => {
        const url = URL.createObjectURL(record.blob);
        urls.push(url);
        return { id: record.blobId, url, title: record.originalName || 'Foto do ponto' };
      });
      setPhotos(views);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setPhotos([]);
        setError(cause instanceof Error ? cause.message : 'Falha ao ler fotos locais.');
        setLoading(false);
      }
    });
    return () => { cancelled = true; for (const url of urls) URL.revokeObjectURL(url); };
  }, [link.projectId, link.layerId, link.featureId, revision]);

  const handleFile = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await onVerify();
      await addPointPhoto(link, file);
      setRevision((n) => n + 1);
      setNotice('Foto salva no dispositivo. Confira o limite do backup parcial.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a foto.');
    } finally { setBusy(false); }
  };
  const deletePhoto = async (id: string) => {
    if (busy || deleteId !== id) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await onVerify();
      await removePointPhoto(link, id);
      setRevision((n) => n + 1);
      setDeleteId(null);
      setNotice('Foto removida deste dispositivo.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao remover foto.');
    } finally { setBusy(false); }
  };
  return (
    <section aria-label="Fotos do ponto" className="min-w-0 max-w-full space-y-3 border-t border-outline-variant pt-3">
      <p className="text-sm font-semibold">Fotos do ponto ({photos.length})</p>
      <div className="flex min-w-0 flex-wrap gap-2">
        <button type="button" disabled={busy || loading} onClick={() => galleryRef.current?.click()}
          className="min-h-[44px] min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold disabled:opacity-50">
          Da galeria
        </button>
        <button type="button" disabled={busy || loading} onClick={() => cameraRef.current?.click()}
          className="min-h-[44px] min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold disabled:opacity-50">
          Tirar foto
        </button>
        <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only" tabIndex={-1} aria-label="Escolher foto da galeria"
          onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void handleFile(file); }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          className="sr-only" tabIndex={-1} aria-label="Fotografar local do ponto"
          onChange={(e) => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void handleFile(file); }} />
      </div>
      <p className="text-xs text-on-surface-variant break-words">
        Fotos ficam offline neste aparelho e entram no backup parcial, sujeito ao limite de 16 MiB. Ainda não são sincronizadas entre dispositivos.
      </p>
      {loading && <p role="status" className="text-xs">Carregando fotos…</p>}
      {!loading && photos.length === 0 && <p className="text-xs text-on-surface-variant">Nenhuma foto anexada.</p>}
      {!loading && <ul className="grid min-w-0 grid-cols-2 gap-3" aria-label="Fotos do ponto">
        {photos.map((photo) => (
          <li key={photo.id} className="min-w-0 max-w-full space-y-1 overflow-hidden rounded-lg border border-outline-variant p-2">
            <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${photo.title}`}>
              <img src={photo.url} alt={photo.title} loading="lazy" className="h-28 w-full rounded-md object-cover" />
            </a>
            <p className="truncate text-xs" title={photo.title}>{photo.title}</p>
            {deleteId !== photo.id ? (
              <button type="button" disabled={busy} onClick={() => setDeleteId(photo.id)}
                className="min-h-[44px] w-full rounded-md border border-error px-2 py-2 text-xs text-error">Excluir foto</button>
            ) : <div className="flex min-w-0 flex-wrap gap-1">
              <button type="button" disabled={busy} onClick={() => void deletePhoto(photo.id)}
                className="min-h-[44px] flex-1 rounded-md bg-error px-2 py-1 text-xs text-on-error">Confirmar</button>
              <button type="button" disabled={busy} onClick={() => setDeleteId(null)}
                className="min-h-[44px] flex-1 rounded-md border border-outline-variant px-2 py-1 text-xs">Cancelar</button>
            </div>}
          </li>
        ))}
      </ul>}
      {notice && <p role="status" className="text-xs text-secondary break-words">{notice}</p>}
      {error && <p role="alert" className="text-xs text-error break-words">{error}</p>}
    </section>
  );
}