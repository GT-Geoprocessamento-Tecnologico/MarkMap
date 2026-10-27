import { describe, expect, it, vi } from 'vitest';
import { digestHex, decryptBackupEntry, deriveBackupKey, encryptBackupEntry, fromHex } from './crypto';
import { exportEncryptedWorkspace } from './export';
import { validateBackupManifest } from './manifest';
import { makePortableLocalFirst, type PortableLocalFirstSnapshot, type RawLocalFirstSnapshot } from './snapshot';
import { MemoryLocalDb } from '../local-db/memory';
import { LocalRepository } from '../local-repositories';
import { readBlobBytes } from '../blob-bytes';
import { dryRunRestore, restoreWorkspaceSnapshot } from './restore';

const passphrase = 'senha-de-teste-sintetica-2026';
const input = (): RawLocalFirstSnapshot => ({
  workspaceId: '11111111-1111-4111-8111-111111111111',
  outboxSequence: 1,
  stores: {
    entities: [{ key: '11111111-1111-4111-8111-111111111111:project:p1', workspaceId: '11111111-1111-4111-8111-111111111111',
      entity: 'project', entityId: 'p1', version: 0, deleted: false, payload: { name: 'Teste offline' } }],
    originals: [],
    outbox: [{ key: '22222222-2222-4222-8222-222222222222', workspaceId: '11111111-1111-4111-8111-111111111111', localSequence: 1,
      immutable: true, operationId: '22222222-2222-4222-8222-222222222222',
      entity: 'project', entityId: '33333333-3333-4333-8333-333333333333',
      operation: 'delete', baseVersion: null, createdAt: '2026-01-01T00:00:00.000Z' }],
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

// Build an authenticated legacy/bad archive to exercise import independently of the export guard.
async function archiveWithModifiedSnapshot(
  bytes: Uint8Array,
  modify: (snapshot: PortableLocalFirstSnapshot) => void,
): Promise<Uint8Array> {
  const { archive, snapshot } = await openTestArchive(bytes);
  modify(snapshot as unknown as PortableLocalFirstSnapshot);
  const file = archive.files[0];
  const key = await deriveBackupKey(passphrase, fromHex(archive.manifest.encryption.saltHex));
  const ciphertext = await encryptBackupEntry(key, archive.manifest, file.path,
    new TextEncoder().encode(JSON.stringify(snapshot)));
  archive.manifest.entries[0].sizeBytes = ciphertext.byteLength;
  archive.manifest.entries[0].sha256 = await digestHex(ciphertext);
  file.base64 = btoa(Array.from(ciphertext, byte => String.fromCharCode(byte)).join(''));
  return new TextEncoder().encode(JSON.stringify(archive));
}

describe('T3a: exportacao criptografada do workspace (sem escrita local)', () => {
  it('rejeita arquivo acima de 32 MiB antes de analisar JSON', async () => {
    await expect(dryRunRestore(new Uint8Array(32 * 1024 * 1024 + 1), passphrase))
      .rejects.toThrow(/limite de 32 MiB/);
  });

  it('cria somente backup parcial e nao revela registros em texto aberto', async () => {
    const result = await exportTest();
    const text = new TextDecoder().decode(result.bytes);
    expect(text).not.toContain('Teste offline');
    expect(text).not.toContain('11111111-1111-4111-8111-111111111111');
    expect(result.manifest.mode).toBe('workspace');
    expect(result.manifest.coverage['offline-maps'].status).toBe('excluded');
    expect(result.manifest.coverage['local-first'].status).toBe('included');
    expect(validateBackupManifest(result.manifest).valid).toBe(true);
    expect(result.sha256).toBe(await digestHex(result.bytes));
    const opened = await openTestArchive(result.bytes);
    expect((opened.snapshot.metadata as { workspaceId: string }).workspaceId).toBe('11111111-1111-4111-8111-111111111111');
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
    data.stores.originals.push({ key: '11111111-1111-4111-8111-111111111111:1', workspaceId: data.workspaceId,
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
    data.stores.originals.push({ key: '11111111-1111-4111-8111-111111111111:webkit', workspaceId: data.workspaceId,
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
    data.stores.originals.push({ key: '11111111-1111-4111-8111-111111111111:1', workspaceId: data.workspaceId,
      blobId: '1', bytes: pdf.byteLength, mediaType: 'application/pdf', sha256: '0'.repeat(64),
      originalBytes: pdf.buffer });
    await expect(exportTest(data)).rejects.toThrow(/SHA-256/);
    const mixed = input();
    (mixed.stores.entities[0] as Record<string, unknown>).workspaceId = 'outro-workspace';
    await expect(exportTest(mixed)).rejects.toThrow(/outro workspace/);
  });

  it('bloqueia chaves inconsistentes em entidades, originais, outbox, conflitos e ACKs', async () => {
    const examples: Array<{ store: keyof RawLocalFirstSnapshot['stores']; row: Record<string, unknown> }> = [
      { store: 'entities', row: { key: 'chave-errada', workspaceId: '11111111-1111-4111-8111-111111111111', entity: 'project', entityId: 'p2' } },
      { store: 'originals', row: { key: 'chave-errada', workspaceId: '11111111-1111-4111-8111-111111111111', blobId: 'doc' } },
      { store: 'outbox', row: { key: 'chave-errada', workspaceId: '11111111-1111-4111-8111-111111111111', operationId: 'op2', localSequence: 1 } },
      { store: 'conflicts', row: { key: 'chave-errada', workspaceId: '11111111-1111-4111-8111-111111111111', operationId: 'op2' } },
      { store: 'acks', row: { key: 'chave-errada', workspaceId: '11111111-1111-4111-8111-111111111111', operationId: 'op2' } },
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

  it('grava pausa de sync junto com o restore e não a cria em rollback', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    const db = new MemoryLocalDb();
    const pause = () => db.transact(['meta'], 'readonly', tx =>
      new Promise<unknown>((resolve, reject) => {
        const request = tx.store('meta').get('syncPausedAfterRestore');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
    );
    db.quotaBytes = 1;
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true })).rejects.toThrow();
    db.quotaBytes = undefined;
    expect(await pause()).toBeUndefined();
    await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });
    expect(await pause()).toMatchObject({ value: { kind: 'restore', generation: expect.any(String) } });
  });



  it('preserva ACK e envelope legado coexistentes sem reenviar operação reconhecida', async () => {
    // Before 823720c9, acknowledge() persisted the receipt without deleting the envelope.
    const data = input();
    data.stores.entities = [];
    data.outboxSequence = 2;
    const acknowledgedId = '22222222-2222-4222-8222-222222222222';
    const pendingId = '44444444-4444-4444-8444-444444444444';
    data.stores.acks.push({
      key: acknowledgedId, workspaceId: data.workspaceId, operationId: acknowledgedId,
      version: 1, sequence: '1',
    });
    data.stores.outbox.push({
      ...(data.stores.outbox[0] as Record<string, unknown>),
      key: pendingId, operationId: pendingId, localSequence: 2,
    });

    const exported = await exportTest(data);
    const inspected = await dryRunRestore(exported.bytes, passphrase);
    const db = new MemoryLocalDb();
    const restored = await restoreWorkspaceSnapshot(inspected.snapshot, db, { confirmed: true });
    expect(restored.restoredCounts).toMatchObject({ outbox: 2, acks: 1 });
    await db.transact(['outbox', 'acks'], 'readonly', async (tx) => {
      const read = (store: 'outbox' | 'acks') => new Promise<unknown>((resolve, reject) => {
        const request = tx.store(store).get(acknowledgedId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const [envelope, receipt] = await Promise.all([read('outbox'), read('acks')]);
      expect(envelope).toMatchObject({ operationId: acknowledgedId, localSequence: 1 });
      expect(receipt).toMatchObject({ operationId: acknowledgedId, version: 1, sequence: '1' });
    });
    const pending = await new LocalRepository(db).listOutbox(data.workspaceId);
    expect(pending.map(operation => operation.operationId)).toEqual([pendingId]);
  });


  it('executa dry-run seguro e calcula estatisticas sem escrita local', async () => {
    const data = input();
    const pdf = new TextEncoder().encode('%PDF-1.4\nconteudo-pdf\n%%EOF');
    data.stores.originals.push({
      key: '11111111-1111-4111-8111-111111111111:blob1',
      workspaceId: data.workspaceId,
      blobId: 'blob1',
      bytes: pdf.byteLength,
      mediaType: 'application/pdf',
      sha256: await digestHex(pdf),
      originalBytes: pdf.buffer,
    });
    data.stores.entities.push({
      key: '11111111-1111-4111-8111-111111111111:feature:f1',
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
    expect(dryRun.workspaceId).toBe('11111111-1111-4111-8111-111111111111');
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
      key: '11111111-1111-4111-8111-111111111111:pdf1',
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

    expect(restoreResult.workspaceId).toBe('11111111-1111-4111-8111-111111111111');
    expect(restoreResult.restoredCounts.entities).toBe(1);
    expect(restoreResult.restoredCounts.originals).toBe(1);

    // Verificar se os dados estao no banco
    await db.transact(['entities', 'originals', 'meta'], 'readonly', async (tx) => {
      const meta = await new Promise((res) => {
        const req = tx.store('meta').get('workspaceId');
        req.onsuccess = () => res(req.result);
      }) as { value: string };
      expect(meta.value).toBe('11111111-1111-4111-8111-111111111111');

      const entity = await new Promise((res) => {
        const req = tx.store('entities').get('11111111-1111-4111-8111-111111111111:project:p1');
        req.onsuccess = () => res(req.result);
      }) as Record<string, unknown>;
      expect(entity.entityId).toBe('p1');

      const orig = await new Promise((res) => {
        const req = tx.store('originals').get('11111111-1111-4111-8111-111111111111:pdf1');
        req.onsuccess = () => res(req.result);
      }) as { blob?: Blob; originalBytes: ArrayBuffer };
      expect(orig.blob).toBeUndefined();
      expect(Array.from(new Uint8Array(orig.originalBytes))).toEqual(Array.from(pdf));
    });
    const restoredPdf = await new LocalRepository(db).getOriginal('pdf1', data.workspaceId);
    expect(restoredPdf?.blob).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await readBlobBytes(restoredPdf!.blob)))).toEqual(Array.from(pdf));
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
      tx.store('meta').put({ key: 'workspaceId', value: '11111111-1111-4111-8111-111111111111' });
      tx.store('outbox').put({
        key: 'op-pendente-1',
        workspaceId: '11111111-1111-4111-8111-111111111111',
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

  it('restaura outbox, conflitos e sequencia do backup sem descartar trabalho offline', async () => {
    const data = input();
    data.stores.conflicts.push({
      key: '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      operationId: '22222222-2222-4222-8222-222222222222',
      entity: 'project',
      entityId: '33333333-3333-4333-8333-333333333333',
      baseVersion: null,
      serverVersion: 1,
      reason: 'VERSION_CONFLICT',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const dryRun = await dryRunRestore((await exportTest(data)).bytes, passphrase);
    expect(dryRun.summary.outboxCount).toBe(1);
    expect(dryRun.summary.conflictsCount).toBe(1);
    expect(dryRun.summary.totalRecords).toBe(3);

    const db = new MemoryLocalDb();
    const result = await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });
    expect(result.restoredCounts.outbox).toBe(1);
    expect(result.restoredCounts.conflicts).toBe(1);
    await db.transact(['outbox', 'conflicts', 'meta'], 'readonly', async (tx) => {
      const read = (store: 'outbox' | 'conflicts' | 'meta', key: string) =>
        new Promise<unknown>((resolve, reject) => {
          const request = tx.store(store).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const [pending, conflict, sequence] = await Promise.all([
        read('outbox', '22222222-2222-4222-8222-222222222222'),
        read('conflicts', '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222'),
        read('meta', 'outboxSequence'),
      ]);
      expect(pending).toMatchObject({
        operationId: '22222222-2222-4222-8222-222222222222', localSequence: 1, immutable: true,
      });
      expect(conflict).toMatchObject({
        operationId: '22222222-2222-4222-8222-222222222222', reason: 'VERSION_CONFLICT',
      });
      expect(sequence).toMatchObject({ value: 1 });
    });
  });

  it('rejeita outbox adulterada antes de abrir a transacao de escrita', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    dryRun.snapshot.metadata.outboxSequence = 0;
    const db = new MemoryLocalDb();
    db.failNextTransaction = true;
    await expect(
      restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }),
    ).rejects.toThrow(/sequência/i);
    expect(db.failNextTransaction).toBe(true);
  });

  it('rejeita operação inválida no dry-run e antes de iniciar a escrita', async () => {
    const data = input();
    (data.stores.outbox[0] as Record<string, unknown>).operation = 'invalida';
    await expect(exportTest(data))
      .rejects.toThrow(/conteúdo da operação/i);
    const goodArchive = (await exportTest()).bytes;
    const malformedArchive = await archiveWithModifiedSnapshot(goodArchive, snapshot => {
      snapshot.stores.outbox[0].operation = 'invalida';
    });
    await expect(dryRunRestore(malformedArchive, passphrase)).rejects.toThrow(/conteúdo da operação/i);
    const dryRun = await dryRunRestore(goodArchive, passphrase);
    dryRun.snapshot.stores.outbox[0].operation = 'invalida';
    const db = new MemoryLocalDb();
    db.failNextTransaction = true;
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
      .rejects.toThrow(/conteúdo da operação/i);
    expect(db.failNextTransaction).toBe(true);
  });

  it('rejeita conflito inválido no dry-run e antes de iniciar a escrita', async () => {
    const data = input();
    data.stores.conflicts.push({
      key: '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
      workspaceId: data.workspaceId, operationId: '22222222-2222-4222-8222-222222222222',
      entity: 'project', entityId: '33333333-3333-4333-8333-333333333333',
      baseVersion: null, serverVersion: 0, reason: 'VERSION_CONFLICT',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await expect(exportTest(data))
      .rejects.toThrow(/conteúdo do conflito/i);
    (data.stores.conflicts[0] as Record<string, unknown>).serverVersion = 1;
    const goodArchive = (await exportTest(data)).bytes;
    const malformedArchive = await archiveWithModifiedSnapshot(goodArchive, snapshot => {
      snapshot.stores.conflicts[0].serverVersion = 0;
    });
    await expect(dryRunRestore(malformedArchive, passphrase)).rejects.toThrow(/conteúdo do conflito/i);
    const dryRun = await dryRunRestore(goodArchive, passphrase);
    dryRun.snapshot.stores.conflicts[0].serverVersion = 0;
    const db = new MemoryLocalDb();
    db.failNextTransaction = true;
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
      .rejects.toThrow(/conteúdo do conflito/i);
    expect(db.failNextTransaction).toBe(true);
  });

  it('rejeita operacoes duplicadas na outbox do snapshot', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    dryRun.snapshot.stores.outbox.push({ ...dryRun.snapshot.stores.outbox[0] });
    const db = new MemoryLocalDb();
    await expect(
      restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }),
    ).rejects.toThrow(/duplicada/i);
  });

  it('nao mescla backup sobre originais de outro workspace sem entidades', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    const db = new MemoryLocalDb();
    await db.transact(['meta', 'originals'], 'readwrite', (tx) => {
      tx.store('meta').put({ key: 'workspaceId', value: 'workspace-diferente' });
      tx.store('originals').put({
        key: 'workspace-diferente:pdf1',
        workspaceId: 'workspace-diferente',
        blobId: 'pdf1',
      });
    });
    await expect(
      restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }),
    ).rejects.toThrow(/workspace/i);
  });

  it('nao substitui workspace diferente mesmo se os stores estiverem vazios', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    const db = new MemoryLocalDb();
    await db.transact(['meta'], 'readwrite', tx => {
      tx.store('meta').put({ key: 'workspaceId', value: 'outro-workspace' });
    });
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
      .rejects.toThrow(/workspace existente difere/i);
    await db.transact(['meta', 'entities'], 'readonly', async tx => {
      const read = (store: 'meta' | 'entities', key: string) =>
        new Promise<unknown>((resolve, reject) => {
          const request = tx.store(store).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      expect(await read('meta', 'workspaceId')).toMatchObject({ value: 'outro-workspace' });
      expect(await read('entities', '11111111-1111-4111-8111-111111111111:project:p1')).toBeUndefined();
    });
  });

  it.each(['workspaceCapability', 'workspaceBootstrapProof', 'installationId', 'syncCursor'])(
    'nao adota workspace sem identidade quando existe %s', async key => {
      const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
      const db = new MemoryLocalDb();
      await db.transact(['meta'], 'readwrite', tx => tx.store('meta').put({ key, value: 'preservar' }));
      await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
        .rejects.toThrow(/metadados de sincronização/i);
      await db.transact(['meta'], 'readonly', async tx => {
        const result = await new Promise<unknown>((resolve, reject) => {
          const request = tx.store('meta').get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        expect(result).toMatchObject({ value: 'preservar' });
      });
    },
  );

  it('permite restaurar em banco vazio com a mesma identidade', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    const db = new MemoryLocalDb();
    await db.transact(['meta'], 'readwrite', tx => {
      tx.store('meta').put({ key: 'workspaceId', value: '11111111-1111-4111-8111-111111111111' });
    });
    const restored = await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });
    expect(restored.restoredCounts.entities).toBe(1);
    expect(restored.restoredCounts.outbox).toBe(1);
  });

  it('bloqueia segunda restauração vazia enquanto pausa anterior aguarda decisão', async () => {
    const data = input();
    data.stores.entities = [];
    data.stores.outbox = [];
    data.outboxSequence = null;
    const dryRun = await dryRunRestore((await exportTest(data)).bytes, passphrase);
    const db = new MemoryLocalDb();
    await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
      .rejects.toThrow(/restauração anterior ainda aguarda/i);
    await db.transact(['meta', 'entities', 'outbox'], 'readonly', async tx => {
      const get = (key: string) => new Promise<unknown>((resolve, reject) => {
        const request = tx.store('meta').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(await get('syncPausedAfterRestore')).toMatchObject({ key: 'syncPausedAfterRestore', value: { kind: 'restore', generation: expect.any(String) } });
      expect(await get('workspaceId')).toEqual({ key: 'workspaceId', value: data.workspaceId });
    });
  });

  it('permite restauração vazia após a pausa anterior ser explicitamente removida', async () => {
    const data = input();
    data.stores.entities = [];
    data.stores.outbox = [];
    data.outboxSequence = null;
    const dryRun = await dryRunRestore((await exportTest(data)).bytes, passphrase);
    const db = new MemoryLocalDb();
    await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });
    await db.transact(['meta'], 'readwrite', tx => {
      tx.store('meta').put({ key: 'syncPausedAfterRestore', value: false });
    });
    const result = await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });
    expect(result.restoredCounts.entities).toBe(0);
    await db.transact(['meta'], 'readonly', async tx => {
      const pause = await new Promise<unknown>((resolve, reject) => {
        const request = tx.store('meta').get('syncPausedAfterRestore');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(pause).toMatchObject({ key: 'syncPausedAfterRestore', value: { kind: 'restore', generation: expect.any(String) } });
    });
  });

  it('bloqueia cursor anterior no mesmo workspace e o preserva', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    const db = new MemoryLocalDb();
    await db.transact(['meta'], 'readwrite', tx => {
      tx.store('meta').put({ key: 'workspaceId', value: dryRun.workspaceId });
      tx.store('meta').put({ key: 'syncCursor', value: 'cursor-anterior' });
    });
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
      .rejects.toThrow(/cursor de sincronização/i);
    await db.transact(['meta', 'entities'], 'readonly', async tx => {
      const get = (store: 'meta' | 'entities', key: string) => new Promise<unknown>((resolve, reject) => {
        const request = tx.store(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(await get('meta', 'syncCursor')).toMatchObject({ value: 'cursor-anterior' });
      expect(await get('entities', `${dryRun.workspaceId}:project:p1`)).toBeUndefined();
    });
  });

  it.each(['token-de-outra-aba', null, false])(
    'bloqueia restauração com claim de sync presente sem modificar dados (%s)', async value => {
      const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
      const db = new MemoryLocalDb();
      await db.transact(['meta'], 'readwrite', tx => {
        tx.store('meta').put({ key: 'syncInProgress', value });
      });
      await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
        .rejects.toThrow(/sincronização em andamento ou não finalizada/i);
      await db.transact(['meta', 'entities'], 'readonly', async tx => {
        const get = (store: 'meta' | 'entities', key: string) => new Promise<unknown>((resolve, reject) => {
          const request = tx.store(store).get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        expect(await get('meta', 'syncInProgress')).toEqual({ key: 'syncInProgress', value });
        expect(await get('meta', 'workspaceId')).toBeUndefined();
        expect(await get('entities', `${dryRun.workspaceId}:project:p1`)).toBeUndefined();
      });
    },
  );

  it.each([
    { workspaceId: 'workspace-divergente' },
    { workspaceId: null },
    'credencial-invalida',
  ])('bloqueia capability divergente ou malformada sem sobrescrever o destino', async value => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    const db = new MemoryLocalDb();
    await db.transact(['meta'], 'readwrite', tx => {
      tx.store('meta').put({ key: 'workspaceId', value: dryRun.workspaceId });
      tx.store('meta').put({ key: 'workspaceCapability', value });
    });
    await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
      .rejects.toThrow(/credencial de workspace/i);
    await db.transact(['meta'], 'readonly', async tx => {
      const row = await new Promise<unknown>((resolve, reject) => {
        const request = tx.store('meta').get('workspaceCapability');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(row).toEqual({ key: 'workspaceCapability', value });
    });
  });

  it('permite capability do mesmo workspace sem cursor e a preserva', async () => {
    const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
    const db = new MemoryLocalDb();
    const value = { workspaceId: dryRun.workspaceId, token: 'ficticio' };
    await db.transact(['meta'], 'readwrite', tx => {
      tx.store('meta').put({ key: 'workspaceId', value: dryRun.workspaceId });
      tx.store('meta').put({ key: 'workspaceCapability', value });
    });
    await restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true });
    await db.transact(['meta'], 'readonly', async tx => {
      const row = await new Promise<unknown>((resolve, reject) => {
        const request = tx.store('meta').get('workspaceCapability');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      expect(row).toEqual({ key: 'workspaceCapability', value });
    });
  });

  it.each([null, '5', -1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    'bloqueia sequência local inválida sem alterá-la: %s', async value => {
      const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
      const db = new MemoryLocalDb();
      await db.transact(['meta'], 'readwrite', tx => {
        tx.store('meta').put({ key: 'workspaceId', value: dryRun.workspaceId });
        tx.store('meta').put({ key: 'outboxSequence', value });
      });
      await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
        .rejects.toThrow(/sequência local da outbox/i);
      await db.transact(['meta'], 'readonly', async tx => {
        const row = await new Promise<unknown>((resolve, reject) => {
          const request = tx.store('meta').get('outboxSequence');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        expect(row).toEqual({ key: 'outboxSequence', value });
      });
    },
  );

  it('verifica o hash de PDFs antes de iniciar a escrita IndexedDB', async () => {
    const data = input();
    const pdf = new TextEncoder().encode('%PDF-1.4\noriginal-testado\n%%EOF');
    data.stores.originals.push({
      key: '11111111-1111-4111-8111-111111111111:pdf-verificado',
      workspaceId: data.workspaceId,
      blobId: 'pdf-verificado',
      bytes: pdf.byteLength,
      mediaType: 'application/pdf',
      sha256: await digestHex(pdf),
      originalBytes: pdf.buffer,
    });
    const dryRun = await dryRunRestore((await exportTest(data)).bytes, passphrase);
    dryRun.snapshot.stores.originals[0].sha256 = '0'.repeat(64);
    const db = new MemoryLocalDb();
    db.failNextTransaction = true;
    await expect(
      restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }),
    ).rejects.toThrow(/SHA-256/);
    expect(db.failNextTransaction).toBe(true);
  });
  it.each(['entities', 'originals', 'outbox', 'conflicts', 'acks'] as const)(
    'bloqueia dados residuais de terceiro workspace no store %s sem alterar o destino',
    async (store) => {
      const dryRun = await dryRunRestore((await exportTest()).bytes, passphrase);
      const db = new MemoryLocalDb();
      await db.transact(['meta', store], 'readwrite', (tx) => {
        tx.store('meta').put({ key: 'workspaceId', value: 'current-empty' });
        tx.store(store).put({ key: 'registro-residual', workspaceId: 'stale-third' });
      });
      await expect(restoreWorkspaceSnapshot(dryRun.snapshot, db, { confirmed: true }))
        .rejects.toThrow(/destino vazio/i);
      await db.transact(['meta', store], 'readonly', async (tx) => {
        const get = (name: 'meta' | typeof store, key: string) =>
          new Promise<unknown>((resolve, reject) => {
            const req = tx.store(name).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        const [meta, row] = await Promise.all([get('meta', 'workspaceId'), get(store, 'registro-residual')]);
        expect(meta).toMatchObject({ value: 'current-empty' });
        expect(row).toMatchObject({ workspaceId: 'stale-third' });
      });
    },
  );

});

describe('T3b: leitura multi-banco opcional (local-engine, large-blobs, offline-packages)', () => {
  it('rejeita quando a API IndexedDB esta indisponivel em vez de declarar bancos ausentes', async () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      const { readLocalEngineSnapshot, readMeshesSnapshot, readLargeBlobsSnapshot, readOfflineMapsSnapshot } = await import('./multi-db');
      for (const read of [readLocalEngineSnapshot, readMeshesSnapshot, readLargeBlobsSnapshot, readOfflineMapsSnapshot]) {
        await expect(read()).rejects.toThrow(/IndexedDB indisponivel/);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
