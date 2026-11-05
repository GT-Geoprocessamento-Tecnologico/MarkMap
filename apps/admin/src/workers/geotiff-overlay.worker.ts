import { readGeoTiffRasterPreview, type GeoTiffInputLimits } from '@markmap/maps';

type Request = { blob: Blob; limits: GeoTiffInputLimits };
type Scope = { postMessage(message: unknown, transfer?: Transferable[]): void };
const scope = self as unknown as Scope;

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const { blob, limits } = event.data ?? {};
  if (!(blob instanceof Blob)) return;
  void (async () => {
    try {
      // Decode on a dedicated worker; do not copy the large RGBA payload back.
      const preview = await readGeoTiffRasterPreview(await blob.arrayBuffer(), limits);
      scope.postMessage({ kind: 'result', preview }, [preview.rgba.buffer as ArrayBuffer]);
    } catch (error) {
      scope.postMessage({ kind: 'error', message: error instanceof Error ? error.message : 'GeoTIFF inválido' });
    }
  })();
});
