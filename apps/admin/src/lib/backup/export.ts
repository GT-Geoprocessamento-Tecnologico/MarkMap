import {
  BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BACKUP_ENCRYPTION_PROFILE, BACKUP_PBKDF2_ITERATIONS,
  BACKUP_SECTION_IDS, EXCLUDED_META_KEYS, validateBackupManifest,
  type BackupManifest, type BackupSectionId, type BackupCoverage,
} from './manifest';
import {
  assertPassphrase, deriveBackupKey, digestHex, encryptBackupEntry,
  newBackupSalt, toHex, workspaceFingerprint,
} from './crypto';
import {
  LOCAL_FIRST_DATA_STORES, MAX_LOCAL_FIRST_SNAPSHOT_BYTES, makePortableLocalFirst,
  readLocalFirstSnapshot, type SnapshotReader,
} from './snapshot';
import { LOCAL_DB_VERSION } from '../local-db/types';

const encoder = new TextEncoder();
const ENTRY_PATH = 'payload/local-first/snapshot.enc';
export const BACKUP_ARCHIVE_TYPE = 'markmap-encrypted-workspace-export' as const;
export const BACKUP_ARCHIVE_VERSION = 1 as const;

/** T3a: one encrypted, bounded workspace snapshot, NOT a full-device backup. */
export interface EncryptedWorkspaceArchive {
  type: typeof BACKUP_ARCHIVE_TYPE;
  version: typeof BACKUP_ARCHIVE_VERSION;
  manifest: BackupManifest;
  files: Array<{ path: string; base64: string }>;
}

export interface BackupExportResult {
  /** Save to a user-chosen external file via T5; never cache inside IndexedDB. */
  filename: string;
  bytes: Uint8Array;
  manifest: BackupManifest;
  /** SHA-256 of the final archive, for independent verification. */
  sha256: string;
}

export interface BackupExportOptions {
  appVersion: string;
  passphrase: string;
  /** Test-only or approved alternative: read must be a single consistent readonly transaction. */
  reader?: SnapshotReader;
}

function encodeBase64(bytes: Uint8Array): string {
  let result = '';
  for (let offset = 0; offset < bytes.length; offset += 12_288) {
    const part = bytes.subarray(offset, offset + 12_288);
    let binary = '';
    for (let i = 0; i < part.length; i++) binary += String.fromCharCode(part[i]);
    result += btoa(binary);
  }
  return result;
}

function excluded(reason: string): BackupCoverage {
  return { status: 'excluded', schemaVersion: null, recordCount: null, reason };
}

function coverageForLocalFirst(recordCount: number): Record<BackupSectionId, BackupCoverage> {
  const coverage = Object.fromEntries(BACKUP_SECTION_IDS.map(id => [id, excluded('Fora do escopo do exportador T3a: nao e backup integral do dispositivo.')])) as Record<BackupSectionId, BackupCoverage>;
  coverage['local-first'] = { status: 'included', schemaVersion: LOCAL_DB_VERSION, recordCount };
  return coverage;
}

/**
 * Creates an offline-only AES-GCM encrypted archive in memory, without any write
 * to IndexedDB, API, caches, localStorage or the service worker.
 *
 * Fail-closed on unknown records, missing workspace, mismatched PDF hashes,
 * snapshots >16 MiB and missing WebCrypto. T3b will provide streaming and the
 * other database sections; T4/T5 will provide restore/UI and external saving.
 */
export async function exportEncryptedWorkspace(options: BackupExportOptions): Promise<BackupExportResult> {
  assertPassphrase(options.passphrase);
  if (!/^\d+\.\d+\.\d+$/.test(options.appVersion))
    throw new Error('Versao de aplicativo invalida.');
  const raw = await (options.reader ?? { read: readLocalFirstSnapshot }).read();
  const portable = await makePortableLocalFirst(raw);
  const payloadBytes = encoder.encode(JSON.stringify(portable));
  if (payloadBytes.byteLength > MAX_LOCAL_FIRST_SNAPSHOT_BYTES)
    throw new Error('Payload maior que 16 MiB: aguardando exportacao por streaming T3b.');

  const salt = newBackupSalt();
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: options.appVersion, createdAt: new Date().toISOString(), mode: 'workspace',
    sourceWorkspaceFingerprint: await workspaceFingerprint(raw.workspaceId, salt),
    encryption: { mode: 'required', profile: BACKUP_ENCRYPTION_PROFILE,
      saltHex: toHex(salt), iterations: BACKUP_PBKDF2_ITERATIONS },
    coverage: coverageForLocalFirst(LOCAL_FIRST_DATA_STORES.reduce((sum, store) => sum + raw.stores[store].length, 0)),
    excludedMetaKeys: [...EXCLUDED_META_KEYS],
    // Placeholder fields are excluded from AES-GCM AAD to avoid hash circularity.
    entries: [{ path: ENTRY_PATH, section: 'local-first', sizeBytes: 0, sha256: '0'.repeat(64) }],
  };
  const key = await deriveBackupKey(options.passphrase, salt);
  const ciphertext = await encryptBackupEntry(key, manifest, ENTRY_PATH, payloadBytes);
  manifest.entries[0] = { path: ENTRY_PATH, section: 'local-first',
    sizeBytes: ciphertext.byteLength, sha256: await digestHex(ciphertext) };
  if (!validateBackupManifest(manifest).valid)
    throw new Error('Manifesto invalido; exportacao bloqueada.');
  const archive: EncryptedWorkspaceArchive = {
    type: BACKUP_ARCHIVE_TYPE, version: BACKUP_ARCHIVE_VERSION,
    manifest, files: [{ path: ENTRY_PATH, base64: encodeBase64(ciphertext) }],
  };
  const bytes = encoder.encode(JSON.stringify(archive));
  if (bytes.byteLength > 32 * 1024 * 1024)
    throw new Error('Arquivo T3a excede o limite de 32 MiB.');
  return {
    filename: `markmap-workspace-parcial-${manifest.createdAt.slice(0, 10)}.markmapbackup`,
    bytes, manifest, sha256: await digestHex(bytes),
  };
}
