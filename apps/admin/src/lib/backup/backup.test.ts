import { describe, expect, it } from 'vitest';
import { digestHex, decryptBackupEntry } from './crypto';
import { exportEncryptedWorkspace } from './export';
import { validateBackupManifest } from './manifest';
import { makePortableLocalFirst, type RawLocalFirstSnapshot } from './snapshot';

const passphrase = 'senha-de-teste-sintetica-2026';
const input = (): RawLocalFirstSnapshot => ({
  workspaceId: 'workspace-de-teste',
  outboxSequence: 1,
  stores: {
    entities: [{ key: 'workspace-de-teste:project:p1', workspaceId: 'workspace-de-teste',
      entity: 'project', entityId: 'p1', version: 0, deleted: false, payload: { name: 'Teste offline' } }],
    originals: [],
    outbox: [{ key: 'op1', workspaceId: 'workspace-de-teste', localSequence: 1,
      immutable: true, operationId: 'op1' }],
    conflicts: [], acks: [],
  },
});

const exportTest = (data = input()) => exportEncryptedWorkspace({
  passphrase, appVersion: '0.5.7', reader: { read: async () => data },
});

function fromBase64(encoded: string): Uint8Array {
  const decoded = atob(encoded);
  return Uint8Array.from(decoded, ch => ch.charCodeAt(0));
}

async function openTestArchive(bytes: Uint8Array, password = passphrase) {
  const archive = JSON.parse(new TextDecoder().decode(bytes)) as {
    manifest: Awaited<ReturnType<typeof exportTest>>['manifest'];
    files: Array<{ path: string; base64: string }>;
  };
  const [file] = archive.files;
  if (!file) throw new Error('Arquivo incompleto.');
  const clear = await decryptBackupEntry(password, archive.manifest, file.path, fromBase64(file.base64));
  return { archive, snapshot: JSON.parse(new TextDecoder().decode(clear)) as Record<string, unknown> };
}

describe('T3a: exportacao criptografada do workspace (sem escrita local)', () => {
  it('cria somente backup parcial e nao revela registros em texto aberto', async () => {
    const result = await exportTest();
    const text = new TextDecoder().decode(result.bytes);
    expect(text).not.toContain('Teste offline');
    expect(text).not.toContain('workspace-de-teste');
    expect(result.manifest.mode).toBe('workspace');
    expect(result.manifest.coverage['offline-maps'].status).toBe('excluded');
    expect(result.manifest.coverage['local-first'].status).toBe('included');
    expect(validateBackupManifest(result.manifest).valid).toBe(true);
    expect(result.sha256).toBe(await digestHex(result.bytes));
    const opened = await openTestArchive(result.bytes);
    expect((opened.snapshot.metadata as { workspaceId: string }).workspaceId).toBe('workspace-de-teste');
  });

  it('bloqueia senha incorreta e alteracao de manifesto', async () => {
    const result = await exportTest();
    await expect(openTestArchive(result.bytes, 'senha-incorreta-tambem-longa')).rejects.toThrow();
    const archive = JSON.parse(new TextDecoder().decode(result.bytes));
    archive.manifest.coverage['offline-maps'] = { status: 'absent', schemaVersion: null, recordCount: 0 };
    await expect(openTestArchive(new TextEncoder().encode(JSON.stringify(archive)))).rejects.toThrow();
  });

  it('verifica SHA real de PDF Blob legado', async () => {
    const data = input();
    const pdf = new TextEncoder().encode('%PDF-1.4\nsintetico\n%%EOF');
    data.stores.originals.push({ key: 'workspace-de-teste:1', workspaceId: data.workspaceId,
      blobId: '1', bytes: pdf.byteLength, mediaType: 'application/pdf', sha256: await digestHex(pdf),
      blob: new Blob([pdf], { type: 'application/pdf' }) });
    const result = await exportTest(data);
    const opened = await openTestArchive(result.bytes);
    const snapshot = opened.snapshot as unknown as { stores: { originals: Array<{ originalBytesBase64: string }> } };
    expect(fromBase64(snapshot.stores.originals[0].originalBytesBase64)).toEqual(pdf);
  });

  it('rejeita alteracao de conteudo de PDF ou outro workspace', async () => {
    const data = input();
    const pdf = new TextEncoder().encode('dados-corrompidos');
    data.stores.originals.push({ key: 'workspace-de-teste:1', workspaceId: data.workspaceId,
      blobId: '1', bytes: pdf.byteLength, mediaType: 'application/pdf', sha256: '0'.repeat(64),
      originalBytes: pdf.buffer });
    await expect(exportTest(data)).rejects.toThrow(/SHA-256/);
    const mixed = input();
    (mixed.stores.entities[0] as Record<string, unknown>).workspaceId = 'outro-workspace';
    await expect(exportTest(mixed)).rejects.toThrow(/outro workspace/);
  });

  it('bloqueia chaves inconsistentes em entidades, originais, outbox, conflitos e ACKs', async () => {
    const examples: Array<{ store: keyof RawLocalFirstSnapshot['stores']; row: Record<string, unknown> }> = [
      { store: 'entities', row: { key: 'chave-errada', workspaceId: 'workspace-de-teste', entity: 'project', entityId: 'p2' } },
      { store: 'originals', row: { key: 'chave-errada', workspaceId: 'workspace-de-teste', blobId: 'doc' } },
      { store: 'outbox', row: { key: 'chave-errada', workspaceId: 'workspace-de-teste', operationId: 'op2', localSequence: 1 } },
      { store: 'conflicts', row: { key: 'chave-errada', workspaceId: 'workspace-de-teste', operationId: 'op2' } },
      { store: 'acks', row: { key: 'chave-errada', workspaceId: 'workspace-de-teste', operationId: 'op2' } },
    ];
    for (const { store, row } of examples) {
      const data = input();
      data.stores[store].push(row);
      await expect(makePortableLocalFirst(data)).rejects.toThrow(/Chave inconsistente/);
    }
  });

  it('nao fabrica sequencia de outbox em workspace realmente vazio', async () => {
    const data = input();
    data.outboxSequence = null;
    data.stores.outbox = [];
    const portable = await makePortableLocalFirst(data);
    expect(portable.metadata.outboxSequence).toBe(null);
  });
});
