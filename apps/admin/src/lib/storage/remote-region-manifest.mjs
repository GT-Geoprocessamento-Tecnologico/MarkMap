/**
 * Fetch a bounded, public HTTPS region manifest without credentials or redirects.
 * Only data is returned; the caller must validate it with the canonical schema.
 */
export async function fetchRemoteRegionManifest(manifestUrl, fetcher = fetch, signal) {
  let url;
  try { url = new URL(manifestUrl); }
  catch { throw new Error('Informe uma URL absoluta para manifest.json'); }
  if (url.username || url.password || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')) ||
      !url.pathname.endsWith('/manifest.json')) {
    throw new Error('A URL deve terminar em /manifest.json e usar HTTPS (ou localhost) sem credenciais');
  }
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
  const response = await fetcher(url.href, {
    method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok || !response.body) throw new Error('Manifest remoto indisponível ou não acessível via CORS');
  const bytes = [];
  const reader = response.body.getReader();
  let length = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 64 * 1024) throw new Error('Manifest excede 64 KiB');
      bytes.push(value);
    }
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  } finally { reader.releaseLock(); }
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
  const full = new Uint8Array(length);
  let offset = 0;
  for (const bytesPart of bytes) { full.set(bytesPart, offset); offset += bytesPart.length; }
  let manifest;
  try { manifest = JSON.parse(new TextDecoder().decode(full)); }
  catch { throw new Error('O manifest remoto não é JSON válido'); }
  return { manifest, baseUrl: new URL('./', url).href };
}
