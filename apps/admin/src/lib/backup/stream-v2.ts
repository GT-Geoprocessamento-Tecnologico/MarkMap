/** Experimental framing only: not a workspace export or a device backup. */
import { deriveBackupKey, newBackupSalt } from './crypto';

const MAGIC = new Uint8Array([0x4d, 0x4d, 0x42, 0x4b, 0x00, 0x00, 0x00, 0x02]);
const HEADER_BYTES = 48; // magic(8), salt(16), nonce prefix(8), archive ID(16)
const FRAME_HEADER_BYTES = 9; // type(1), sequence(4), plaintext length(4)
const TAG_BYTES = 16;
const END_BYTES = 12; // block count(4), total plaintext bytes(8)
export const STREAM_V2_MAX_BLOCK_BYTES = 1024 * 1024;
export const STREAM_V2_MAX_BLOCKS = 65_536;
export const STREAM_V2_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_INPUT_FRAGMENT = STREAM_V2_MAX_BLOCK_BYTES + FRAME_HEADER_BYTES + TAG_BYTES;

function owned(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function frameHeader(type: number, sequence: number, length: number): Uint8Array {
  const frame = new Uint8Array(FRAME_HEADER_BYTES);
  const view = new DataView(frame.buffer);
  view.setUint8(0, type);
  view.setUint32(1, sequence);
  view.setUint32(5, length);
  return frame;
}

function nonce(header: Uint8Array, sequence: number): Uint8Array {
  const iv = new Uint8Array(12);
  iv.set(header.subarray(24, 32));
  new DataView(iv.buffer).setUint32(8, sequence);
  return iv;
}

function aad(header: Uint8Array, frame: Uint8Array): ArrayBuffer {
  const data = new Uint8Array(HEADER_BYTES + FRAME_HEADER_BYTES);
  data.set(header);
  data.set(frame, HEADER_BYTES);
  return data.buffer;
}

async function seal(key: CryptoKey, header: Uint8Array, frame: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const sequence = new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(1);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: owned(nonce(header, sequence)),
    additionalData: aad(header, frame), tagLength: 128 }, key, owned(plaintext));
  const result = new Uint8Array(FRAME_HEADER_BYTES + encrypted.byteLength);
  result.set(frame);
  result.set(new Uint8Array(encrypted), FRAME_HEADER_BYTES);
  return result;
}

/**
 * Writes one authenticated block per source item; callers must batch small
 * fragments themselves. An interrupted stream has no valid trailer.
 */
export async function* encodeExperimentalStreamV2(
  source: AsyncIterable<Uint8Array>, passphrase: string,
): AsyncGenerator<Uint8Array> {
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC);
  header.set(newBackupSalt(), 8);
  crypto.getRandomValues(header.subarray(24, 32));
  crypto.getRandomValues(header.subarray(32, 48));
  const key = await deriveBackupKey(passphrase, header.subarray(8, 24));
  yield header.slice();
  let sequence = 0;
  let total = 0;
  for await (const block of source) {
    if (!(block instanceof Uint8Array) || block.byteLength === 0 || block.byteLength > STREAM_V2_MAX_BLOCK_BYTES)
      throw new Error('Bloco de entrada inválido ou acima do limite.');
    if (sequence >= STREAM_V2_MAX_BLOCKS || total + block.byteLength > STREAM_V2_MAX_BYTES)
      throw new Error('Fluxo excede o limite experimental.');
    const frame = frameHeader(1, sequence, block.byteLength);
    yield await seal(key, header, frame, block);
    total += block.byteLength;
    sequence++;
  }
  const trailer = new Uint8Array(END_BYTES);
  const view = new DataView(trailer.buffer);
  view.setUint32(0, sequence);
  view.setBigUint64(4, BigInt(total));
  yield await seal(key, header, frameHeader(2, sequence, END_BYTES), trailer);
}

/** A bounded reader: no concatenation of the archive and no untrusted length allocation. */
class StreamReader {
  private readonly iterator: AsyncIterator<Uint8Array>;
  private fragment: Uint8Array = new Uint8Array(0);
  private offset = 0;

  constructor(source: AsyncIterable<Uint8Array>) { this.iterator = source[Symbol.asyncIterator](); }

  private async next(): Promise<boolean> {
    const part = await this.iterator.next();
    if (part.done) return false;
    if (!(part.value instanceof Uint8Array) || part.value.byteLength === 0 || part.value.byteLength > MAX_INPUT_FRAGMENT)
      throw new Error('Fragmento de arquivo inválido ou acima do limite.');
    this.fragment = part.value;
    this.offset = 0;
    return true;
  }

  async read(length: number): Promise<Uint8Array> {
    const result = new Uint8Array(length);
    let written = 0;
    while (written < length) {
      if (this.offset === this.fragment.length && !(await this.next()))
        throw new Error('Fluxo truncado.');
      const take = Math.min(length - written, this.fragment.length - this.offset);
      result.set(this.fragment.subarray(this.offset, this.offset + take), written);
      this.offset += take;
      written += take;
    }
    return result;
  }

  async assertEnd(): Promise<void> {
    if (this.offset < this.fragment.length || await this.next())
      throw new Error('Dados após o término autenticado.');
  }

  async close(): Promise<void> { await this.iterator.return?.(); }
}

/** Validates the complete stream without storing, returning, or restoring plaintext. */
export async function verifyExperimentalStreamV2(
  source: AsyncIterable<Uint8Array>, passphrase: string,
): Promise<{ blocks: number; bytes: number }> {
  const reader = new StreamReader(source);
  try {
    const header = await reader.read(HEADER_BYTES);
    if (!MAGIC.every((byte, index) => header[index] === byte)) throw new Error('Formato experimental desconhecido.');
    const key = await deriveBackupKey(passphrase, header.subarray(8, 24));
    let sequence = 0;
    let total = 0;
    for (;;) {
      const frame = await reader.read(FRAME_HEADER_BYTES);
      const view = new DataView(frame.buffer);
      const type = view.getUint8(0);
      const index = view.getUint32(1);
      const length = view.getUint32(5);
      if (index !== sequence || sequence > STREAM_V2_MAX_BLOCKS ||
          (type === 1 && (sequence >= STREAM_V2_MAX_BLOCKS || length === 0 || length > STREAM_V2_MAX_BLOCK_BYTES || total + length > STREAM_V2_MAX_BYTES)) ||
          (type === 2 && length !== END_BYTES) || (type !== 1 && type !== 2))
        throw new Error('Ordem, tipo ou tamanho do bloco inválido.');
      const ciphertext = await reader.read(length + TAG_BYTES);
      let clear: ArrayBuffer;
      try {
        clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: owned(nonce(header, index)),
          additionalData: aad(header, frame), tagLength: 128 }, key, owned(ciphertext));
      } catch {
        throw new Error('Senha incorreta ou bloco adulterado.');
      }
      if (type === 2) {
        const end = new DataView(clear);
        if (end.getUint32(0) !== sequence || end.getBigUint64(4) !== BigInt(total))
          throw new Error('Término inconsistente.');
        await reader.assertEnd();
        return { blocks: sequence, bytes: total };
      }
      total += length;
      sequence++;
    }
  } finally {
    await reader.close();
  }
}
