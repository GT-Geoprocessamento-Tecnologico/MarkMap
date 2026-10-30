import type { OriginalRecord } from "../local-repositories";
import { localRepository, type LocalRepository } from "../local-repositories";
import { readBlobBytes } from "../blob-bytes";
import {
  MAX_WORKSPACE_POINT_PHOTO_BYTES, isPhotoMediaType,
  validPointPhotoLink, validatePhotoBytes, validatePhotoOriginalMetadata,
} from "../photo/point-photo-policy.mjs";
import {
  assertPassphrase, deriveBackupKey, digestHex, fromHex, newBackupSalt,
  toHex, workspaceFingerprint,
} from "./crypto";

/** All photo attachments in one workspace, not a full-device or offline-map backup. */
export const PHOTO_BACKUP_FORMAT = "markmap-point-photos-encrypted-v1" as const;
export const MAX_PHOTO_BACKUP_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_PHOTO_PAYLOAD_BYTES = 12 * 1024 * 1024;
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const HASH = /^[0-9a-f]{64}$/i;
const ISO_DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type PhotoLink = NonNullable<OriginalRecord["pointPhoto"]>;
type PhotoInput = Pick<OriginalRecord, "blobId" | "blob" | "mediaType" |
  "bytes" | "sha256" | "originalName" | "createdAt" | "pointPhoto">;
type PhotoEntry = Omit<PhotoInput, "blob"> & { originalBytesBase64: string; pointPhoto: PhotoLink };
interface PhotoPayload { workspaceId: string; photos: PhotoEntry[] }
interface PhotoArchiveHeader {
  format: typeof PHOTO_BACKUP_FORMAT;
  version: 1;
  createdAt: string;
  workspaceFingerprint: string;
  count: number;
  saltHex: string;
  ivHex: string;
}
interface PhotoArchive extends PhotoArchiveHeader {
  encryptedBase64: string;
  ciphertextSha256: string;
}
export interface PhotoBackupResult {
  filename: string;
  bytes: Uint8Array;
  photoCount: number;
  totalBytes: number;
  sha256: string;
}
export interface InspectedPhotoBackup {
  count: number;
  totalBytes: number;
  workspaceId: string;
  originals: PhotoInput[];
}
function own(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
function encode64(bytes: Uint8Array): string {
  let output = "";
  for (let start = 0; start < bytes.length; start += 12_288) {
    const part = bytes.subarray(start, start + 12_288);
    let text = "";
    for (let i = 0; i < part.length; i++) text += String.fromCharCode(part[i]!);
    output += btoa(text);
  }
  return output;
}
function decode64(raw: unknown): Uint8Array {
  if (typeof raw !== "string" || raw.length > MAX_PHOTO_BACKUP_ARCHIVE_BYTES ||
      !B64.test(raw) || raw.length % 4 !== 0)
    throw new Error("Conteúdo codificado do backup inválido.");
  return Uint8Array.from(atob(raw), (char) => char.charCodeAt(0));
}
function aad(header: PhotoArchiveHeader): ArrayBuffer {
  return own(ENCODER.encode(JSON.stringify(header)));
}
function parseArchive(raw: unknown): PhotoArchive {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Arquivo de fotos inválido.");
  const object = raw as Record<string, unknown>;
  if (object.format !== PHOTO_BACKUP_FORMAT || object.version !== 1 ||
      typeof object.createdAt !== "string" || !ISO_DATE.test(object.createdAt) ||
      Number.isNaN(Date.parse(object.createdAt)) ||
      typeof object.workspaceFingerprint !== "string" || !HASH.test(object.workspaceFingerprint) ||
      !Number.isSafeInteger(object.count) || (object.count as number) < 0 ||
      (object.count as number) > 10_000 ||
      typeof object.saltHex !== "string" || !/^[0-9a-f]{32}$/i.test(object.saltHex) ||
      typeof object.ivHex !== "string" || !/^[0-9a-f]{24}$/i.test(object.ivHex) ||
      typeof object.ciphertextSha256 !== "string" || !HASH.test(object.ciphertextSha256))
    throw new Error("Metadados do backup de fotos inválidos.");
  const expected = ["format", "version", "createdAt", "workspaceFingerprint", "count", "saltHex", "ivHex", "encryptedBase64", "ciphertextSha256"];
  if (Object.keys(object).length !== expected.length ||
      Object.keys(object).some((key) => !expected.includes(key)))
    throw new Error("Formato de backup de fotos inesperado.");
  return object as unknown as PhotoArchive;
}
function photoSignature(rows: OriginalRecord[]): string[] {
  return rows.filter((row) => isPhotoMediaType(row.mediaType))
    .map((row) => `${row.blobId}:${row.sha256}:${row.bytes}:${row.createdAt}`)
    .sort();
}

/** Always encrypt ALL photo originals from one consistent IndexedDB snapshot. */
export async function exportFullPointPhotoBackup(
  passphrase: string, repo: LocalRepository = localRepository,
): Promise<PhotoBackupResult> {
  assertPassphrase(passphrase);
  const workspaceId = await repo.workspaceId();
  const originals = await repo.listOriginals();
  const photos = originals.filter((row) => isPhotoMediaType(row.mediaType));
  if (!photos.length) throw new Error("Não há fotos de pontos para salvar neste workspace.");
  const rows: PhotoEntry[] = [];
  let totalBytes = 0;
  for (const photo of photos) {
    validatePhotoOriginalMetadata(photo);
    if (!validPointPhotoLink(photo.pointPhoto) || typeof photo.blobId !== "string" ||
        !photo.blobId.trim() || photo.blobId.length > 128)
      throw new Error("Foto sem vínculo válido: backup cancelado sem omissões.");
    const raw = new Uint8Array(await readBlobBytes(photo.blob));
    validatePhotoBytes(photo.mediaType, raw);
    if (raw.byteLength !== photo.bytes || await digestHex(raw) !== photo.sha256.toLowerCase())
      throw new Error("Foto local incompleta ou com hash inválido.");
    totalBytes += raw.byteLength;
    if (totalBytes > MAX_WORKSPACE_POINT_PHOTO_BYTES)
      throw new Error("Fotos excedem o limite do workspace. Backup cancelado.");
    rows.push({
      blobId: photo.blobId, mediaType: photo.mediaType, bytes: photo.bytes,
      sha256: photo.sha256.toLowerCase(), originalName: photo.originalName,
      createdAt: photo.createdAt, pointPhoto: photo.pointPhoto!,
      originalBytesBase64: encode64(raw),
    });
  }
  const payload = ENCODER.encode(JSON.stringify({ workspaceId, photos: rows } satisfies PhotoPayload));
  if (payload.byteLength > MAX_PHOTO_PAYLOAD_BYTES)
    throw new Error("Dados de fotos excedem o limite de memória segura para exportação.");
  const salt = newBackupSalt();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header: PhotoArchiveHeader = {
    format: PHOTO_BACKUP_FORMAT, version: 1, createdAt: new Date().toISOString(),
    workspaceFingerprint: await workspaceFingerprint(workspaceId, salt),
    count: rows.length, saltHex: toHex(salt), ivHex: toHex(iv),
  };
  const key = await deriveBackupKey(passphrase, salt);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({
    name: "AES-GCM", iv: own(iv), additionalData: aad(header), tagLength: 128,
  }, key, own(payload)));
  const archive: PhotoArchive = {
    ...header, encryptedBase64: encode64(encrypted),
    ciphertextSha256: await digestHex(encrypted),
  };
  const bytes = ENCODER.encode(JSON.stringify(archive));
  if (bytes.byteLength > MAX_PHOTO_BACKUP_ARCHIVE_BYTES)
    throw new Error("Arquivo de fotos excede o limite de exportação.");
  // Fail closed on writes/deletes in another tab during this export.
  const after = await repo.listOriginals();
  if (JSON.stringify(photoSignature(after)) !== JSON.stringify(photoSignature(originals)))
    throw new Error("Fotos mudaram durante o backup; repita a exportação.");
  return {
    filename: `markmap-fotos-completo-${header.createdAt.slice(0, 10)}.markmapfotos`,
    bytes, photoCount: rows.length, totalBytes, sha256: await digestHex(bytes),
  };
}

/** Decrypt and verify EVERY photo before performing any IndexedDB write. */
export async function inspectFullPointPhotoBackup(
  archiveBytes: Uint8Array, passphrase: string,
): Promise<InspectedPhotoBackup> {
  assertPassphrase(passphrase);
  if (!(archiveBytes instanceof Uint8Array) || archiveBytes.byteLength < 100 ||
      archiveBytes.byteLength > MAX_PHOTO_BACKUP_ARCHIVE_BYTES)
    throw new Error("Tamanho do arquivo de fotos inválido.");
  let parsed: unknown;
  try { parsed = JSON.parse(DECODER.decode(archiveBytes)); }
  catch { throw new Error("Arquivo de fotos ilegível."); }
  const archive = parseArchive(parsed);
  const encrypted = decode64(archive.encryptedBase64);
  if (encrypted.byteLength < 17 || await digestHex(encrypted) !== archive.ciphertextSha256.toLowerCase())
    throw new Error("Arquivo de fotos corrompido ou alterado.");
  const header: PhotoArchiveHeader = {
    format: PHOTO_BACKUP_FORMAT, version: 1, createdAt: archive.createdAt,
    workspaceFingerprint: archive.workspaceFingerprint, count: archive.count,
    saltHex: archive.saltHex, ivHex: archive.ivHex,
  };
  const key = await deriveBackupKey(passphrase, fromHex(archive.saltHex));
  let clear: ArrayBuffer;
  try {
    clear = await crypto.subtle.decrypt({
      name: "AES-GCM", iv: own(fromHex(archive.ivHex)),
      additionalData: aad(header), tagLength: 128,
    }, key, own(encrypted));
  } catch {
    throw new Error("Frase de proteção incorreta ou arquivo de fotos adulterado.");
  }
  if (clear.byteLength > MAX_PHOTO_PAYLOAD_BYTES) throw new Error("Payload de fotos excessivo.");
  let payload: unknown;
  try { payload = JSON.parse(DECODER.decode(new Uint8Array(clear))); }
  catch { throw new Error("Conteúdo de fotos inválido."); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new Error("Backup de fotos sem conteúdo.");
  const data = payload as Partial<PhotoPayload>;
  if (typeof data.workspaceId !== "string" || !data.workspaceId ||
      !Array.isArray(data.photos) || data.photos.length !== archive.count)
    throw new Error("Quantidade ou workspace do backup de fotos inconsistente.");
  const fp = await workspaceFingerprint(data.workspaceId, fromHex(archive.saltHex));
  if (fp !== archive.workspaceFingerprint) throw new Error("Workspace do backup adulterado.");
  const originals: PhotoInput[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const row of data.photos) {
    if (!row || typeof row !== "object" || typeof row.blobId !== "string" ||
        !row.blobId.trim() || row.blobId.length > 128 || seen.has(row.blobId) ||
        !isPhotoMediaType(row.mediaType) || !validPointPhotoLink(row.pointPhoto) ||
        typeof row.sha256 !== "string" || !HASH.test(row.sha256) ||
        typeof row.createdAt !== "string" || !ISO_DATE.test(row.createdAt) ||
        Number.isNaN(Date.parse(row.createdAt)) || !Number.isInteger(row.bytes) ||
        row.bytes < 1 || row.bytes > 1_500_000 ||
        (row.originalName !== undefined && (typeof row.originalName !== "string" || row.originalName.length > 120)))
      throw new Error("Foto com metadados inválidos no arquivo.");
    seen.add(row.blobId);
    const raw = decode64(row.originalBytesBase64);
    validatePhotoBytes(row.mediaType, raw);
    if (raw.byteLength !== row.bytes || await digestHex(raw) !== row.sha256.toLowerCase())
      throw new Error("Foto do backup corrompida: nada foi restaurado.");
    totalBytes += raw.byteLength;
    if (totalBytes > MAX_WORKSPACE_POINT_PHOTO_BYTES)
      throw new Error("Fotos excedem o limite de armazenamento do workspace.");
    originals.push({
      blobId: row.blobId, mediaType: row.mediaType, bytes: row.bytes,
      sha256: row.sha256.toLowerCase(), originalName: row.originalName,
      createdAt: row.createdAt, pointPhoto: row.pointPhoto,
      blob: new Blob([own(raw)], { type: row.mediaType }),
    });
  }
  return { count: originals.length, totalBytes, workspaceId: data.workspaceId, originals };
}

export async function restoreFullPointPhotoBackup(
  archiveBytes: Uint8Array, passphrase: string, repo: LocalRepository = localRepository,
): Promise<{ added: number; unchanged: number; count: number }> {
  const inspected = await inspectFullPointPhotoBackup(archiveBytes, passphrase);
  const result = await repo.restorePointPhotosAtomically(inspected.workspaceId, inspected.originals);
  return { ...result, count: inspected.count };
}
