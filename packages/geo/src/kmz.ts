/** Bounded KMZ (ZIP) reader. No external files, network access or ZIP extraction to disk. */
export const MAX_KMZ_BYTES = 25 * 1024 * 1024;
const MAX_KML_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 128;
const MAX_TOTAL_UNCOMPRESSED = 64 * 1024 * 1024;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const SIG_END = 0x06054b50;

function fail(message: string): never { throw new Error(`KMZ inválido: ${message}`); }

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeZipName(name: string): boolean {
  return name.length > 0 && name.length < 512 && !name.includes('\\') && !name.includes('\0') &&
    !name.startsWith('/') && !name.startsWith('//') && !/^[a-z]:/i.test(name) &&
    name.split('/').every((piece) => piece !== '' && piece !== '.' && piece !== '..');
}

interface Entry {
  name: string;
  offset: number;
  packed: number;
  unpacked: number;
  crc: number;
  method: number;
  flags: number;
}

/** Strictly parse ZIP's central directory before trusting local data offsets. */
export async function extractKmzKml(file: Blob): Promise<string> {
  if (file.size < 22 || file.size > MAX_KMZ_BYTES) fail('tamanho acima do limite ou ZIP vazio');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(i) === SIG_END && i + 22 + u16(i + 20) === bytes.length) { end = i; break; }
  }
  if (end < 0) fail('diretório ZIP não encontrado');
  const count = u16(end + 10);
  const size = u32(end + 12);
  const start = u32(end + 16);
  if (u16(end + 4) !== 0 || u16(end + 6) !== 0 || u16(end + 8) !== count ||
      count === 0 || count > MAX_ENTRIES || count === 0xffff || start === 0xffffffff ||
      size === 0xffffffff || start + size !== end) fail('diretório inconsistente ou ZIP64/multidisco não suportado');
  let cursor = start;
  let unpackedTotal = 0;
  const files: Entry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== SIG_CENTRAL) fail('diretório corrompido');
    const flags = u16(cursor + 8);
    const method = u16(cursor + 10);
    const packed = u32(cursor + 20);
    const unpacked = u32(cursor + 24);
    const nameLength = u16(cursor + 28);
    const extraLength = u16(cursor + 30);
    const commentLength = u16(cursor + 32);
    const offset = u32(cursor + 42);
    const external = u32(cursor + 38) >>> 16;
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || nameLength === 0 || flags & 1 || flags & 0x40 ||
        (method !== 0 && method !== 8) || packed === 0xffffffff || unpacked === 0xffffffff ||
        offset === 0xffffffff) fail('entrada ZIP não suportada');
    let name: string;
    try { name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)); }
    catch { fail('nome de arquivo não é UTF-8'); }
    if (!safeZipName(name.endsWith('/') ? name.slice(0, -1) : name) || seen.has(name.toLowerCase())) fail('caminho inválido ou duplicado');
    seen.add(name.toLowerCase());
    // Reject Unix symlinks, regardless of their displayed path.
    if ((external & 0xf000) === 0xa000) fail('links simbólicos não permitidos');
    unpackedTotal += unpacked;
    if (unpackedTotal > MAX_TOTAL_UNCOMPRESSED) fail('tamanho ZIP expandido excessivo');
    files.push({ name, offset, packed, unpacked, crc: u32(cursor + 16), method, flags });
    cursor = next;
  }
  if (cursor !== end) fail('diretório com bytes extras não previstos');
  const candidates = files.filter((entry) => entry.name.toLowerCase().endsWith('.kml'));
  const preferred = candidates.find((entry) => entry.name.toLowerCase() === 'doc.kml');
  const selected = preferred ?? (candidates.length === 1 ? candidates[0] : null);
  if (!selected) fail('doc.kml ausente ou múltiplos KML ambíguos');
  if (selected.unpacked === 0 || selected.unpacked > MAX_KML_BYTES ||
      (selected.packed > 0 && selected.unpacked / selected.packed > 500)) fail('KML expandido excessivo');
  const local = selected.offset;
  if (local + 30 > start || u32(local) !== SIG_LOCAL ||
      u16(local + 8) !== selected.method || u16(local + 6) !== selected.flags) fail('header ZIP local inválido');
  const nameSize = u16(local + 26);
  const extraSize = u16(local + 28);
  const dataStart = local + 30 + nameSize + extraSize;
  if (dataStart + selected.packed > start) fail('conteúdo ZIP fora dos limites');
  let localName: string;
  try { localName = decoder.decode(bytes.subarray(local + 30, local + 30 + nameSize)); }
  catch { fail('nome local não é UTF-8'); }
  if (localName !== selected.name) fail('headers ZIP divergentes');
  const packedBytes = bytes.subarray(dataStart, dataStart + selected.packed);
  let unpacked: Uint8Array;
  if (selected.method === 0) {
    unpacked = packedBytes;
  } else {
    if (typeof DecompressionStream === 'undefined') fail('este navegador não suporta descompactação ZIP');
    let decompressor: DecompressionStream;
    try { decompressor = new DecompressionStream('deflate-raw'); }
    catch { fail('formato ZIP não suportado neste navegador'); }
    const stream = new Blob([packedBytes]).stream().pipeThrough(decompressor);
    const reader = stream.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_KML_BYTES || total > selected.unpacked) fail('descompactação excedeu o limite');
        parts.push(value);
      }
    } catch (cause) {
      await reader.cancel().catch(() => undefined);
      throw cause;
    } finally { reader.releaseLock(); }
    unpacked = new Uint8Array(total);
    let position = 0;
    for (const part of parts) { unpacked.set(part, position); position += part.length; }
  }
  if (unpacked.byteLength !== selected.unpacked || crc32(unpacked) !== selected.crc)
    fail('tamanho ou CRC32 não confere');
  try { return decoder.decode(unpacked); }
  catch { return fail('KML não está em UTF-8 válido'); }
}
