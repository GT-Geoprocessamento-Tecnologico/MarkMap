import { describe, expect, it } from 'vitest';
import { digestHex, decryptBackupEntry } from './crypto';
import { exportEncryptedWorkspace } from './export';
import { validateBackupManifest } from './manifest';
import { makePortableLocalFirst, type RawLocalFirstSnapshot } from './snapshot';
import { MemoryLocalDb } from '../local-db/memory';
import { dryRunRestore, restoreWorkspaceSnapshot } from './restore';

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
    expect(Uint8Array.from(fromBase64(snapshot.stores.originals[0].originalBytesBase64))).toEqual(Uint8Array.from(pdf));
  });

  it('exporta PDF legado quando Blob.arrayBuffer nao existe (WebKit)', async () => {
    const data = input();
    const pdf = new TextEncoder().encode('%PDF-1.4\nlegado\n%%EOF');
    const blob = new Blob([pdf], { type: 'application/pdf' });
    Object.defineProperty(blob, 'arrayBuffer', { value: undefined });
    data.stores.originals.push({ key: 'workspace-de-teste:webkit', workspaceId: data.workspaceId,
      blobId: 'webkit', bytes: pdf.byteLength, mediaType: 'application/pdf',
      sha256: await digestHex(pdf), blob });
    const result = await exportTest(data);
    const opened = await openTestArchive(result.bytes);
    const row = (opened.snapshot as unknown as { stores: { originals: Array<{ originalBytesBase64: string }> } })
      .stores.originals[0];
    expect(Uint8Array.from(fromBase64(row.originalBytesBase64))).toEqual(Uint8Array.from(pdf));
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

  it('exporta ACK de sync com predecessor opcional sem copiar undefined', async () => {
    const data = input();
    data.stores.acks.push({
      key: 'ack-1', workspaceId: data.workspaceId, operationId: 'ack-1',
      version: 1, sequence: '1', predecessorOperationId: undefined,
    });
    const opened = await openTestArchive((await exportTest(data)).bytes);
    const row = (opened.snapshot as unknown as { stores: { acks: Array<Record<string, unknown>> } })
      .stores.acks[0];
    expect(row.sequence).toBe('1');
    expect(Object.hasOwn(row, 'predecessorOperationId')).toBe(false);
  });

  it('exporta entidade tombstone com payload opcional indefinido', async () => {
    const data = input();
    const entity = data.stores.entities[0] as Record<string, unknown>;
    entity.deleted = true;
    entity.payload = undefined;
    const opened = await openTestArchive((await exportTest(data)).bytes);
    const row = (opened.snapshot as unknown as { stores: { entities: Array<Record<string, unknown>> } })
      .stores.entities[0];
    expect(row.deleted).toBe(true);
    expect(Object.hasOwn(row, 'payload')).toBe(false);
  });

  it('continua recusando undefined em campos nao documentados', async () => {
    const data = input();
    data.stores.acks.push({
      key: 'ack-1', workspaceId: data.workspaceId, operationId: 'ack-1',
      version: 1, sequence: '1', predecessorOperationId: undefined,
      campoDesconhecido: undefined,
    });
    await expect(exportTest(data)).rejects.toThrow(/nao serializavel/);
  });

  it('nao fabrica sequencia de outbox em workspace realmente vazio', async () => {
    const data = input();
    data.outboxSequence = null;
    data.stores.outbox = [];
    const portable = await makePortableLocalFirst(data);
    expect(portable.metadata.outboxSequence).toBe(null);
  });
});

describe('T4: restauracao e dry-run seguro', () => {
  it('executa dry-run seguro e calcula estatisticas sem escrita local', async () => {
    const data = input();
    const pdf = new TextEncoder().encode('%PDF-1.4\nconteudo-pdf\n%%EOF');
    data.stores.originals.push({
      key: 'workspace-de-teste:blob1',
      workspaceId: data.workspaceId,
      blobId: 'blob1',
      bytes: pdf.byteLength,
      mediaType: 'application/pdf',
      sha256: await digestHex(pdf),
      originalBytes: pdf.buffer,
    });
    data.stores.entities.push({
      key: 'workspace-de-teste:feature:f1',
      workspaceId: data.workspaceId,
      entity: 'feature',
      entityId: 'f1',
      version: 0,
      deleted: false,
      payload: { name: 'Feicao 1' },
    });
    const result = await exportTest(data);
    const dryRun = await dryRunRestore(result.bytes, passphrase);

    expect(dryRun.valid).toBe(true);
    expect(dryRun.workspaceId).toBe('workspace-de-teste');
    expect(dryRun.summary.projectsCount).toBe(1);
    expect(dryRun.summary.featuresCount).toBe(1);
    expect(dryRun.summary.originalsCount).toBe(1);
    expect(dryRun.summary.totalOriginalsBytes).toBe(pdf.byteLength);
  });

  it('bloqueia dry-run com senha incorreta', async () => {
    const result = await exportTest();
    await expect(dryRunRestore(result.bytes, 'senha-totalmente-errada-12345')).rejects.toThrow();
  });

  it('bloqueia dry-run com payload corrompido ou JSON invalido', async () => {
    const result = await exportTest();
    const corruptedBytes = new Uint8Array(result.bytes);
    corruptedBytes[10] = 0; // corrompe JSON
    await expect(dryRunRestore(corruptedBytes, passphrase)).rejects.toThrow();

    // Corrompe hash do arquivo interno
    const archive = JSON.parse(new TextDecoder().decode(result.bytes));
    archive.manifest.entries[0].sha256 = '0'.repeat(64);
    await expect(
      dryRunRestore(new TextEncoder().encode(JSON.stringify(archive)), passphrase)
    ).rejects.toThrow(/hash SHA-256|corrompido/i);
  });

  it('restaura snapshot com sucesso quando confirmado', async () => {
    const data = input();
    const pdf = new TextEncoder().encode('%PDF-1.4\ndocumento-restaurado\n%%EOF');
    data.stores.originals.push({
      key: 'workspace-de-teste:pdf1',
      workspaceId: data.workspaceId,
      blobId: 'pdf1',
      bytes: pdf.byteLength,
      mediaType: 'application/pdf',
      sha256: await digestHex(pdf),
      originalBytes: pdf.buffer,
    });
    const exportResult = await exportTest(data);
    const dryRun = await dryRunRestore(exportResult.bytes, passphrase);

    const db = new MemoryLocalDb();
    const restoreResult = await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });

    expect(restoreResult.workspaceId).toBe('workspace-de-teste');
    expect(restoreResult.restoredCounts.entities).toBe(1);
    expect(restoreResult.restoredCounts.originals).toBe(1);

    // Verificar se os dados estao no banco
    await db.transact(['entities', 'originals', 'meta'], 'readonly', async (tx) => {
      const meta = await new Promise((res) => {
        const req = tx.store('meta').get('workspaceId');
        req.onsuccess = () => res(req.result);
      }) as { value: string };
      expect(meta.value).toBe('workspace-de-teste');

      const entity = await new Promise((res) => {
        const req = tx.store('entities').get('workspace-de-teste:project:p1');
        req.onsuccess = () => res(req.result);
      }) as Record<string, unknown>;
      expect(entity.entityId).toBe('p1');

      const orig = await new Promise((res) => {
        const req = tx.store('originals').get('workspace-de-teste:pdf1');
        req.onsuccess = () => res(req.result);
      }) as { blob: Blob; originalBytes: ArrayBuffer };
      expect(orig.blob).toBeInstanceOf(Blob);
      expect(orig.originalBytes.byteLength).toBe(pdf.byteLength);
    });
  });

  it('exige confirmacao explicita para restaurar', async () => {
    const exportResult = await exportTest();
    const dryRun = await dryRunRestore(exportResult.bytes, passphrase);
    const db = new MemoryLocalDb();
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db)).rejects.toThrow(
      /Confirmação obrigatória/i,
    );
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: false })).rejects.toThrow(
      /Confirmação obrigatória/i,
    );
  });

  it('salvaguarda estrita: bloqueia restauracao se houver outbox pendente no banco', async () => {
    const exportResult = await exportTest();
    const dryRun = await dryRunRestore(exportResult.bytes, passphrase);
    const db = new MemoryLocalDb();

    // Inserir operacao pendente na outbox
    await db.transact(['outbox', 'meta'], 'readwrite', (tx) => {
      tx.store('meta').put({ key: 'workspaceId', value: 'workspace-de-teste' });
      tx.store('outbox').put({
        key: 'op-pendente-1',
        workspaceId: 'workspace-de-teste',
        localSequence: 1,
        immutable: true,
        operationId: 'op-pendente-1',
      });
    });

    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true })).rejects.toThrow(
      /outbox/i,
    );
  });

  it('bloqueia restauracao em workspace populado diferente para evitar colisao', async () => {
    const exportResult = await exportTest();
    const dryRun = await dryRunRestore(exportResult.bytes, passphrase);
    const db = new MemoryLocalDb();

    // Configurar banco com outro workspace com dados
    await db.transact(['entities', 'meta'], 'readwrite', (tx) => {
      tx.store('meta').put({ key: 'workspaceId', value: 'outro-workspace-ativo' });
      tx.store('entities').put({
        key: 'outro-workspace-ativo:project:p99',
        workspaceId: 'outro-workspace-ativo',
        entity: 'project',
        entityId: 'p99',
        version: 0,
        deleted: false,
      });
    });

    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true })).rejects.toThrow(
      /workspace/i,
    );
  });
});

describe('T3b: leitura multi-banco opcional (local-engine, large-blobs, offline-packages)', () => {
  it('retorna cobertura ausente com seguranca quando os bancos opcionais nao estao populados', async () => {
    const { readLocalEngineSnapshot, readLargeBlobsSnapshot, readOfflineMapsSnapshot } = await import('./multi-db');

    const engine = await readLocalEngineSnapshot();
    expect(engine.coverage.status).toBe('absent');
    expect(engine.records).toEqual([]);

    const blobs = await readLargeBlobsSnapshot();
    expect(blobs.coverage.status).toBe('absent');
    expect(blobs.records).toEqual([]);

    const maps = await readOfflineMapsSnapshot();
    expect(maps.coverage.status).toBe('absent');
    expect(maps.records).toEqual([]);
  });
});
