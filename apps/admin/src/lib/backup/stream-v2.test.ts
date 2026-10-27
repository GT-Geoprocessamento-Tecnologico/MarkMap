import { describe, expect, it } from 'vitest';
import { encodeExperimentalStreamV2, verifyExperimentalStreamV2, STREAM_V2_MAX_BLOCK_BYTES } from './stream-v2';
import { deriveBackupKey } from './crypto';

const password = 'frase-experimental-de-teste-2026';
const chunks = async function* (parts: Uint8Array[]) { for (const part of parts) yield part; };
const collect = async (parts: AsyncIterable<Uint8Array>): Promise<Uint8Array[]> => {
  const result: Uint8Array[] = [];
  for await (const part of parts) result.push(part);
  return result;
};
const archive = async () => collect(encodeExperimentalStreamV2(chunks([
  new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]),
]), password));

describe('formato experimental v2: autenticação incremental sem escrita', () => {
  it('verifica blocos fragmentados arbitrariamente, inclusive cabeçalho e trailer', async () => {
    const parts = await archive();
    const fragmented = async function* () {
      for (const part of parts) for (let offset = 0; offset < part.length; offset += 7)
        yield part.subarray(offset, offset + 7);
    };
    await expect(verifyExperimentalStreamV2(fragmented(), password)).resolves.toEqual({ blocks: 2, bytes: 5 });
  });

  it('confere um bloco no limite sem materializar arquivo completo no verificador', async () => {
    const payload = new Uint8Array(STREAM_V2_MAX_BLOCK_BYTES).fill(37);
    const stream = encodeExperimentalStreamV2(chunks([payload]), password);
    await expect(verifyExperimentalStreamV2(stream, password)).resolves.toEqual({ blocks: 1, bytes: payload.length });
  });

  it('aceita fluxo vazio somente com trailer autenticado', async () => {
    await expect(verifyExperimentalStreamV2(encodeExperimentalStreamV2(chunks([]), password), password))
      .resolves.toEqual({ blocks: 0, bytes: 0 });
  });

  it('cifra os bytes exatos de uma view com offset, sem incluir o buffer adjacente', async () => {
    const data = new Uint8Array([90, 91, 1, 2, 3, 92]).subarray(2, 5);
    const [header, frame] = await collect(encodeExperimentalStreamV2(chunks([data]), password));
    const key = await deriveBackupKey(password, header.subarray(8, 24));
    const iv = new Uint8Array(12);
    iv.set(header.subarray(24, 32));
    const associated = new Uint8Array(header.length + 9);
    associated.set(header);
    associated.set(frame.subarray(0, 9), header.length);
    const ciphertext = new ArrayBuffer(frame.byteLength - 9);
    new Uint8Array(ciphertext).set(frame.subarray(9));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: associated }, key, ciphertext);
    expect(Array.from(new Uint8Array(decrypted))).toEqual([1, 2, 3]);
  });

  it('rejeita senha incorreta e alteração de ciphertext', async () => {
    const parts = await archive();
    await expect(verifyExperimentalStreamV2(chunks(parts), 'outra-senha-experimental-2026')).rejects.toThrow();
    const modified = parts.map(part => part.slice());
    modified[1][10] ^= 1;
    await expect(verifyExperimentalStreamV2(chunks(modified), password)).rejects.toThrow();
  });

  it('rejeita blocos removidos, duplicados ou reordenados', async () => {
    const [header, first, second, end] = await archive();
    for (const invalid of [
      [header, second, end], [header, first, first, second, end], [header, second, first, end],
    ]) await expect(verifyExperimentalStreamV2(chunks(invalid), password)).rejects.toThrow();
  });

  it('rejeita trailer ausente, truncado, duplicado ou com bytes posteriores', async () => {
    const [header, first, second, end] = await archive();
    for (const invalid of [
      [header, first, second], [header, first, second, end.subarray(0, end.length - 1)],
      [header, first, second, end, end], [header, first, second, end, new Uint8Array([1])],
    ]) await expect(verifyExperimentalStreamV2(chunks(invalid), password)).rejects.toThrow();
  });

  it('rejeita header alterado e tamanho não confiável antes de alocar payload', async () => {
    const parts = await archive();
    const badHeader = parts.map(part => part.slice());
    badHeader[0][0] ^= 1;
    await expect(verifyExperimentalStreamV2(chunks(badHeader), password)).rejects.toThrow();
    const alteredArchiveId = parts.map(part => part.slice());
    alteredArchiveId[0][32] ^= 1;
    await expect(verifyExperimentalStreamV2(chunks(alteredArchiveId), password)).rejects.toThrow();
    const badTrailer = parts.map(part => part.slice());
    badTrailer[3][badTrailer[3].length - 1] ^= 1;
    await expect(verifyExperimentalStreamV2(chunks(badTrailer), password)).rejects.toThrow();
    const badLength = parts.map(part => part.slice());
    new DataView(badLength[1].buffer).setUint32(5, 0xffffffff);
    await expect(verifyExperimentalStreamV2(chunks(badLength), password)).rejects.toThrow(/tamanho/);
  });

  it('rejeita blocos de entrada ou fragmentos de arquivo maiores que o limite', async () => {
    await expect(collect(encodeExperimentalStreamV2(chunks([new Uint8Array(STREAM_V2_MAX_BLOCK_BYTES + 1)]), password)))
      .rejects.toThrow(/limite/);
    await expect(verifyExperimentalStreamV2(chunks([new Uint8Array(STREAM_V2_MAX_BLOCK_BYTES + 26)]), password))
      .rejects.toThrow(/limite/);
  });

  it('usa salt e identificador diferentes em exportações distintas', async () => {
    const first = await archive();
    const second = await archive();
    expect(Array.from(first[0])).not.toEqual(Array.from(second[0]));
    await expect(verifyExperimentalStreamV2(chunks([first[0], second[1], first[2], first[3]]), password)).rejects.toThrow();
  });

  it('propaga falha ou interrupção da origem sem gerar trailer', async () => {
    const source = async function* () { yield new Uint8Array([1]); throw new Error('origem interrompida'); };
    const output: Uint8Array[] = [];
    await expect((async () => {
      for await (const part of encodeExperimentalStreamV2(source(), password)) output.push(part);
    })()).rejects.toThrow('origem interrompida');
    await expect(verifyExperimentalStreamV2(chunks(output), password)).rejects.toThrow(/truncado/);
  });

  it('fecha a origem quando o consumidor cancela a exportação', async () => {
    let closed = false;
    const source = async function* () {
      try { yield new Uint8Array([1]); yield new Uint8Array([2]); }
      finally { closed = true; }
    };
    const output = encodeExperimentalStreamV2(source(), password);
    await output.next(); // header
    await output.next(); // primeiro frame; origem ainda ativa
    expect(closed).toBe(false);
    await output.return(undefined);
    expect(closed).toBe(true);
  });

  it('fecha a origem do arquivo quando a verificação falha', async () => {
    const parts = await archive();
    let closed = false;
    const source = async function* () {
      try { for (const part of parts) yield part; }
      finally { closed = true; }
    };
    await expect(verifyExperimentalStreamV2(source(), 'senha-incorreta-experimental-2026')).rejects.toThrow();
    expect(closed).toBe(true);
  });
});
