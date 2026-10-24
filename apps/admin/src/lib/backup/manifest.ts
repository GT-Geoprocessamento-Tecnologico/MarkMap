/** T3a backup metadata. A workspace export is NEVER a full-device backup. */
export const BACKUP_FORMAT = 'markmap-offline-backup' as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_ENCRYPTION_PROFILE = 'pbkdf2-sha256-310000-aes256gcm-v1' as const;
export const BACKUP_PBKDF2_ITERATIONS = 310_000 as const;
export const BACKUP_SECTION_IDS = [
  'local-first', 'local-engine', 'meshes', 'offline-maps', 'large-blobs', 'legacy-mock',
] as const;
export type BackupSectionId = (typeof BACKUP_SECTION_IDS)[number];
export type BackupSectionStatus = 'included' | 'absent' | 'excluded' | 'pending';
export interface BackupCoverage {
  status: BackupSectionStatus;
  schemaVersion: number | null;
  recordCount: number | null;
  reason?: string;
}
export interface BackupEntry {
  path: string;
  section: BackupSectionId;
  sizeBytes: number;
  sha256: string;
}
export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  appVersion: string;
  createdAt: string;
  mode: 'workspace' | 'device';
  /** SHA-256(salt || UTF-8 workspaceId), for correlation only within this archive. */
  sourceWorkspaceFingerprint: string;
  encryption: {
    mode: 'required';
    profile: typeof BACKUP_ENCRYPTION_PROFILE;
    saltHex: string;
    iterations: typeof BACKUP_PBKDF2_ITERATIONS;
  };
  coverage: Record<BackupSectionId, BackupCoverage>;
  excludedMetaKeys: string[];
  entries: BackupEntry[];
}

export const EXCLUDED_META_KEYS = [
  'workspaceCapability', 'workspaceBootstrapProof', 'installationId',
  'syncCursor', 'address-search-cache:v1',
] as const;
const sha = /^[a-f0-9]{64}$/;
const salt = /^[a-f0-9]{32}$/;
const semver = /^\d+\.\d+\.\d+$/;
const sectionNames = new Set<string>(BACKUP_SECTION_IDS);
const allowedStatuses = new Set<string>(['included', 'absent', 'excluded', 'pending']);
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

export function safeBackupPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('payload/') || value.length > 300 ||
      value.includes('\\') || value.includes('//') || /[\x00-\x1f\x7f?#]/.test(value) ||
      !value.endsWith('.enc')) return false;
  const segments = value.split('/');
  return segments.length >= 3 && segments.every(s => s !== '' && s !== '.' && s !== '..' && !s.startsWith('.'));
}

export function validateBackupManifest(raw: unknown): { valid: true; manifest: BackupManifest } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(raw)) return { valid: false, errors: ['expected object'] };
  if (raw.format !== BACKUP_FORMAT || raw.formatVersion !== BACKUP_FORMAT_VERSION)
    errors.push('unknown format or version');
  if (typeof raw.appVersion !== 'string' || !semver.test(raw.appVersion)) errors.push('appVersion must be stable semver');
  if (typeof raw.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(raw.createdAt) ||
      Number.isNaN(Date.parse(raw.createdAt))) errors.push('createdAt must be a UTC timestamp');
  if (raw.mode !== 'workspace' && raw.mode !== 'device') errors.push('invalid mode');
  if (typeof raw.sourceWorkspaceFingerprint !== 'string' || !sha.test(raw.sourceWorkspaceFingerprint))
    errors.push('invalid workspace fingerprint');
  const e = raw.encryption;
  if (!isObject(e) || e.mode !== 'required' || e.profile !== BACKUP_ENCRYPTION_PROFILE ||
      e.iterations !== BACKUP_PBKDF2_ITERATIONS || typeof e.saltHex !== 'string' || !salt.test(e.saltHex))
    errors.push('unknown encryption profile or KDF parameters');
  if (!isObject(raw.coverage)) errors.push('coverage required');
  else {
    for (const id of BACKUP_SECTION_IDS) {
      const item = raw.coverage[id];
      if (!isObject(item) || !allowedStatuses.has(String(item.status)) ||
          (item.recordCount !== null && !count(item.recordCount)) ||
          (item.schemaVersion !== null && !count(item.schemaVersion))) {
        errors.push(`invalid coverage ${id}`);
        continue;
      }
      if (item.status === 'absent' && item.recordCount !== 0) errors.push(`absent count ${id}`);
      if (['excluded', 'pending'].includes(String(item.status)) &&
          (typeof item.reason !== 'string' || !item.reason.trim())) errors.push(`exclusion reason ${id}`);
      if (['included', 'absent'].includes(String(item.status)) && item.recordCount === null)
        errors.push(`missing record count ${id}`);
      if (raw.mode === 'device' && !['included', 'absent'].includes(String(item.status)))
        errors.push(`incomplete device backup ${id}`);
      if (id === 'local-first' && item.status !== 'included') errors.push('local-first must be included');
    }
    for (const section of Object.keys(raw.coverage)) if (!sectionNames.has(section)) errors.push(`unknown section ${section}`);
  }
  const excludedKeys = raw.excludedMetaKeys;
  if (!Array.isArray(excludedKeys) ||
      !EXCLUDED_META_KEYS.every(s => excludedKeys.includes(s)) ||
      !excludedKeys.every((s: unknown) => typeof s === 'string' && s.length > 0))
    errors.push('required meta exclusions missing');
  if (!Array.isArray(raw.entries) || raw.entries.length > 10_000) errors.push('invalid entries');
  else {
    const paths = new Set<string>();
    for (const entry of raw.entries) {
      if (!isObject(entry) || !safeBackupPath(entry.path) ||
          !sectionNames.has(String(entry.section)) || !count(entry.sizeBytes) ||
          typeof entry.sha256 !== 'string' || !sha.test(entry.sha256)) {
        errors.push('invalid entry');
        continue;
      }
      if (paths.has(entry.path)) errors.push('duplicate path');
      paths.add(entry.path);
      const coverage = isObject(raw.coverage) ? raw.coverage[String(entry.section)] : null;
      if (!isObject(coverage) || coverage.status !== 'included') errors.push('entry in excluded section');
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true, manifest: raw as unknown as BackupManifest };
}
