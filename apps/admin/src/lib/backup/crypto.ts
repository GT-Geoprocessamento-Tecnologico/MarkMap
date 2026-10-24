import {
  BACKUP_ENCRYPTION_PROFILE, BACKUP_PBKDF2_ITERATIONS,
  validateBackupManifest, type BackupManifest,
} from './manifest';

const encoder = new TextEncoder();
const IV_BYTES = 12;
const SALT_BYTES = 16;
const HEX = '0123456789abcdef';

/** WebCrypto only: offline secure-origin PWA/Capacitor. Never fall back to plaintext. */
function webCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle || !crypto.getRandomValues)
    throw new Error('WebCrypto seguro indisponivel. Exportacao bloqueada.');
  return crypto;
}
function buffer(bytes: Uint8Array): ArrayBuffer {
  const own = new Uint8Array(bytes.byteLength);
  own.set(bytes);
  return own.buffer;
}
export function toHex(bytes: Uint8Array): string {
  let result = '';
  for (const b of bytes) result += HEX[b >> 4] + HEX[b & 15];
  return result;
}
function fromHex(value: string): Uint8Array {
  if (!/^(?:[a-f0-9]{2})+$/i.test(value)) throw new Error('Hexadecimal invalido.');
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
export function newBackupSalt(): Uint8Array {
  return webCrypto().getRandomValues(new Uint8Array(SALT_BYTES));
}
export async function digestHex(bytes: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await webCrypto().subtle.digest('SHA-256', buffer(bytes))));
}
export async function workspaceFingerprint(workspaceId: string, salt: Uint8Array): Promise<string> {
  const id = encoder.encode(workspaceId);
  const joined = new Uint8Array(salt.byteLength + id.byteLength);
  joined.set(salt);
  joined.set(id, salt.byteLength);
  return digestHex(joined);
}
export function assertPassphrase(passphrase: string): void {
  if (typeof passphrase !== 'string' || passphrase.length < 12 || passphrase.length > 512 || !passphrase.trim())
    throw new Error('Frase de protecao deve conter entre 12 e 512 caracteres.');
}
export async function deriveBackupKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  assertPassphrase(passphrase);
  if (salt.byteLength !== SALT_BYTES) throw new Error('Salt incorreto.');
  const cryptoApi = webCrypto();
  const raw = await cryptoApi.subtle.importKey('raw', buffer(encoder.encode(passphrase)), 'PBKDF2', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey({
    name: 'PBKDF2', salt: buffer(salt), iterations: BACKUP_PBKDF2_ITERATIONS, hash: 'SHA-256',
  }, raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** AAD authenticates all manifest assertions except the ciphertext's own length/hash. */
function associatedData(manifest: BackupManifest, path: string): ArrayBuffer {
  const assertions = {
    format: manifest.format, formatVersion: manifest.formatVersion,
    appVersion: manifest.appVersion, createdAt: manifest.createdAt,
    mode: manifest.mode, sourceWorkspaceFingerprint: manifest.sourceWorkspaceFingerprint,
    encryption: manifest.encryption, coverage: manifest.coverage,
    excludedMetaKeys: manifest.excludedMetaKeys,
    entries: manifest.entries.map(entry => ({ path: entry.path, section: entry.section })),
    path,
  };
  return buffer(encoder.encode(JSON.stringify(assertions)));
}

/** IV(12 bytes) || AES-256-GCM ciphertext and 128-bit authentication tag. */
export async function encryptBackupEntry(
  key: CryptoKey, manifest: BackupManifest, path: string, cleartext: Uint8Array,
): Promise<Uint8Array> {
  if (!manifest.entries.some(entry => entry.path === path)) throw new Error('Path nao previsto no manifesto.');
  const api = webCrypto();
  const iv = api.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = new Uint8Array(await api.subtle.encrypt({
    name: 'AES-GCM', iv: buffer(iv), additionalData: associatedData(manifest, path),
  }, key, buffer(cleartext)));
  const output = new Uint8Array(IV_BYTES + sealed.byteLength);
  output.set(iv);
  output.set(sealed, IV_BYTES);
  return output;
}

/** Test helper / future T4 inspection: never writes or restores local storage. */
export async function decryptBackupEntry(
  passphrase: string, manifest: BackupManifest, path: string, ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const checked = validateBackupManifest(manifest);
  if (!checked.valid || manifest.encryption.profile !== BACKUP_ENCRYPTION_PROFILE ||
      manifest.encryption.iterations !== BACKUP_PBKDF2_ITERATIONS)
    throw new Error('Manifesto ou perfil de criptografia invalido.');
  const entry = manifest.entries.find(e => e.path === path);
  if (!entry || entry.sizeBytes !== ciphertext.byteLength || await digestHex(ciphertext) !== entry.sha256)
    throw new Error('Entrada de backup ausente ou corrompida.');
  if (ciphertext.byteLength < IV_BYTES + 16) throw new Error('Ciphertext incompleto.');
  const key = await deriveBackupKey(passphrase, fromHex(manifest.encryption.saltHex));
  const clear = await webCrypto().subtle.decrypt({
    name: 'AES-GCM', iv: buffer(ciphertext.subarray(0, IV_BYTES)),
    additionalData: associatedData(manifest, path),
  }, key, buffer(ciphertext.subarray(IV_BYTES)));
  return new Uint8Array(clear);
}
