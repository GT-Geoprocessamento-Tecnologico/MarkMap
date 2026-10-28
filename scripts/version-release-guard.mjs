import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_PUBLISHED_URL = 'https://appmarkmap.mtsferreira.dev/version.json';

/** Pages build variables are authoritative on Cloudflare; never treat generic CI as production. */
export function releaseBuildContext(env = process.env) {
  const cloudflarePages = env.CF_PAGES === '1';
  return {
    production: env.VERCEL_ENV === 'production' ||
      (cloudflarePages && env.CF_PAGES_BRANCH === 'main'),
    buildSha: cloudflarePages
      ? env.CF_PAGES_COMMIT_SHA
      : (env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA),
  };
}

const SHA40 = /^[0-9a-f]{40}$/i;
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const MAX_METADATA_BYTES = 64 * 1024;
const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export class VersionGuardError extends Error {
  constructor(message, code = 'VERSION_GUARD') { super(message); this.name = 'VersionGuardError'; this.code = code; }
}

export function parseVersion(value, { stable = false } = {}) {
  if (typeof value !== 'string') throw new VersionGuardError('version must be a string', 'INVALID_VERSION');
  const match = value.match(stable ? STABLE : SEMVER);
  if (!match) throw new VersionGuardError(`invalid ${stable ? 'stable ' : ''}SemVer: ${value}`, 'INVALID_VERSION');
  const numbers = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (numbers.some(number => !Number.isSafeInteger(number))) throw new VersionGuardError(`version numeric component is unsafe: ${value}`, 'INVALID_VERSION');
  return { raw: value, major: numbers[0], minor: numbers[1], patch: numbers[2], prerelease: match[4] ?? null };
}

function compareCore(a, b) {
  for (const key of ['major', 'minor', 'patch']) if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  return 0;
}

export function compareVersions(a, b) {
  const left = typeof a === 'string' ? parseVersion(a) : a;
  const right = typeof b === 'string' ? parseVersion(b) : b;
  for (const key of ['major', 'minor', 'patch']) if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  if (left.prerelease === right.prerelease) return 0;
  if (left.prerelease === null) return 1;
  if (right.prerelease === null) return -1;
  return left.prerelease > right.prerelease ? 1 : -1;
}

function assertSha(value, label) {
  if (typeof value !== 'string' || !SHA40.test(value)) throw new VersionGuardError(`${label} must be a 40-character hexadecimal SHA`, 'INVALID_SHA');
}

export function validatePolicy({ appVersion, publishedVersion, buildSha, publishedBuildSha }) {
  const current = parseVersion(appVersion, { stable: true });
  const published = parseVersion(publishedVersion);
  assertSha(buildSha, 'build SHA');
  assertSha(publishedBuildSha, 'published build SHA');
  const comparison = compareCore(current, published);
  if (comparison < 0) throw new VersionGuardError(`version ${appVersion} is lower than published ${publishedVersion}`, 'VERSION_NOT_MONOTONIC');
  if (comparison === 0 && (appVersion !== publishedVersion || buildSha.toLowerCase() !== publishedBuildSha.toLowerCase())) {
    throw new VersionGuardError(`version ${appVersion} already published from another build`, 'VERSION_NOT_BUMPED');
  }
  return { ok: true, comparison, sameBuild: buildSha.toLowerCase() === publishedBuildSha.toLowerCase() };
}

async function readBounded(response, signal) {
  const contentType = response?.headers?.get?.('content-type');
  if (!contentType || !/application\/json(?:\s*;|$)|\+json(?:\s*;|$)/i.test(contentType)) throw new VersionGuardError('published metadata must be JSON', 'INVALID_METADATA');
  if (!response || typeof response.body?.getReader !== 'function') {
    const length = Number(response?.headers?.get?.('content-length'));
    if (Number.isFinite(length) && length > MAX_METADATA_BYTES) throw new VersionGuardError('published metadata exceeds 64 KiB', 'METADATA_TOO_LARGE');
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_METADATA_BYTES) throw new VersionGuardError('published metadata exceeds 64 KiB', 'METADATA_TOO_LARGE');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = []; let total = 0;
  const cancel = () => { void reader.cancel(); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new VersionGuardError('published metadata request timed out', 'METADATA_TIMEOUT');
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_METADATA_BYTES) { await reader.cancel(); throw new VersionGuardError('published metadata exceeds 64 KiB', 'METADATA_TOO_LARGE'); }
      chunks.push(value);
    }
  } catch (error) { try { await reader.cancel(); } catch {} throw error; }
  finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function validateProductionRelease({ appVersion, buildSha, fetcher = globalThis.fetch, publishedUrl = DEFAULT_PUBLISHED_URL }) {
  if (typeof fetcher !== 'function') throw new VersionGuardError('fetcher unavailable', 'FETCH_UNAVAILABLE');
  assertSha(buildSha, 'build SHA');
  const controller = new AbortController();
  let timeoutReject;
  const timeout = new Promise((_, reject) => { timeoutReject = reject; });
  const timer = setTimeout(() => { controller.abort(); timeoutReject(new VersionGuardError('published metadata request timed out', 'METADATA_TIMEOUT')); }, 10_000);
  try {
    const work = (async () => {
      const freshUrl = new URL(publishedUrl);
      freshUrl.searchParams.set('version-check', String(Date.now()));
      const response = await fetcher(freshUrl.href, { credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal: controller.signal });
      if (!response?.ok) throw new VersionGuardError(`published metadata HTTP failure: ${response?.status ?? 'unknown'}`, 'BASELINE_UNAVAILABLE');
      const text = await readBounded(response, controller.signal);
      let metadata;
      try { metadata = JSON.parse(text); } catch { throw new VersionGuardError('published metadata is invalid JSON', 'INVALID_METADATA'); }
      const publishedVersion = metadata?.appVersion ?? metadata?.version;
      const publishedBuildSha = metadata?.buildSha;
      parseVersion(publishedVersion);
      assertSha(publishedBuildSha, 'published build SHA');
      return validatePolicy({ appVersion, publishedVersion, buildSha, publishedBuildSha });
    })();
    return await Promise.race([work, timeout]);
  } catch (error) {
    if (error?.name === 'AbortError') throw new VersionGuardError('published metadata request timed out', 'METADATA_TIMEOUT');
    if (error instanceof VersionGuardError) throw error;
    throw new VersionGuardError(`published metadata unavailable: ${error?.message ?? error}`, 'BASELINE_UNAVAILABLE');
  } finally { clearTimeout(timer); }
}

export function isAppRelevantPath(path) {
  const normalized = path.replaceAll('\\', '/');
  return normalized === 'package.json' || normalized === 'pnpm-lock.yaml' || normalized === 'turbo.json' ||
    normalized.startsWith('apps/admin/') || normalized.startsWith('packages/') || normalized.startsWith('services/');
}

export function validateChangedFiles({ appVersion, baseVersion, changedFiles }) {
  parseVersion(appVersion, { stable: true });
  parseVersion(baseVersion);
  if (!(changedFiles ?? []).some(isAppRelevantPath)) return { ok: true, appRelevant: false };
  if (compareVersions(appVersion, baseVersion) <= 0) throw new VersionGuardError(`app-relevant changes require version > ${baseVersion}`, 'VERSION_NOT_MONOTONIC');
  return { ok: true, appRelevant: true };
}

export async function validateLocalReleaseMetadata({ root = DEFAULT_ROOT, changedFiles, baseVersion } = {}) {
  const packagePath = join(root, 'apps/admin/package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  parseVersion(packageJson.version, { stable: true });
  const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf8').catch(() => '');
  const escapedVersion = packageJson.version.replaceAll('.', '\\.');
  const heading = new RegExp(`^##\\s+\\[${escapedVersion}\\]\\s+-\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`, 'm');
  const headingMatch = heading.exec(changelog);
  if (!headingMatch) {
    throw new VersionGuardError(`CHANGELOG.md lacks heading for ${packageJson.version}`, 'CHANGELOG_MISSING');
  }
  const body = changelog.slice(headingMatch.index + headingMatch[0].length).split(/^##\s+/m, 1)[0];
  const section = (name) => {
    const marker = new RegExp(`^###\\s+${name}\\s*$`, 'm').exec(body);
    if (!marker) return '';
    const start = marker.index + marker[0].length;
    const remainder = body.slice(start);
    const next = /^###\s+/m.exec(remainder);
    return (next ? remainder.slice(0, next.index) : remainder).trim();
  };
  const changes = section('(?:Changes|Alterações)');
  const evidence = section('(?:Evidence|Validação)');
  if (!changes || !evidence) throw new VersionGuardError(`CHANGELOG.md requires nonempty Changes and Evidence sections for ${packageJson.version}`, 'CHANGELOG_EMPTY');
  if (/\b(?:pending|todo|not validated|pendente|não validado)\b/i.test(evidence)) throw new VersionGuardError(`CHANGELOG.md evidence for ${packageJson.version} is not validated`, 'CHANGELOG_PLACEHOLDER');
  if (baseVersion !== undefined) validateChangedFiles({ appVersion: packageJson.version, baseVersion, changedFiles: changedFiles ?? [] });
  return { ok: true, version: packageJson.version };
}

export async function validateArtifacts({ root = DEFAULT_ROOT, dist, production = false, expectedBuildSha } = {}) {
  if (!dist) return { ok: true, checked: false };
  const packageJson = JSON.parse(await readFile(join(root, 'apps/admin/package.json'), 'utf8'));
  const versionPath = join(dist, 'version.json');
  const metadata = JSON.parse(await readFile(versionPath, 'utf8'));
  if (metadata.appVersion !== packageJson.version) throw new VersionGuardError('dist/version.json appVersion differs from apps/admin/package.json', 'ARTIFACT_DRIFT');
  if (production) {
    assertSha(metadata.buildSha, 'artifact build SHA');
    if (expectedBuildSha !== undefined && metadata.buildSha.toLowerCase() !== expectedBuildSha.toLowerCase()) throw new VersionGuardError('artifact build SHA differs from current build SHA', 'ARTIFACT_DRIFT');
  } else if (metadata.buildSha !== undefined && metadata.buildSha !== 'unavailable') {
    assertSha(metadata.buildSha, 'artifact build SHA');
  }
  if (metadata.version !== undefined && typeof metadata.version !== 'string') throw new VersionGuardError('artifact version must be a string', 'ARTIFACT_DRIFT');
  return { ok: true, checked: true, version: packageJson.version };
}

function gitBaseVersion(root, ref) {
  const raw = execFileSync('git', ['show', `${ref}:apps/admin/package.json`], { cwd: root, encoding: 'utf8' });
  return JSON.parse(raw).version;
}

function gitChangedFiles(root, ref) {
  const tracked = execFileSync('git', ['diff', '--name-only', ref, '--'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

export async function verifyRelease({ root = DEFAULT_ROOT, production = false, buildSha, fetcher, publishedUrl, baseRef, dist } = {}) {
  const local = await validateLocalReleaseMetadata({ root });
  if (baseRef) validateChangedFiles({ appVersion: local.version, baseVersion: gitBaseVersion(root, baseRef), changedFiles: gitChangedFiles(root, baseRef) });
  const artifacts = await validateArtifacts({ root, dist, production, expectedBuildSha: buildSha });
  const remote = production ? await validateProductionRelease({ appVersion: local.version, buildSha, fetcher, publishedUrl }) : null;
  return { ok: true, version: local.version, artifacts, remote };
}

if (process.argv[1] && process.argv[1].endsWith('version-release-guard.mjs')) {
  const args = process.argv.slice(2); const flags = new Set(['--base-ref', '--dist', '--production']);
  for (let i = 0; i < args.length; i++) {
    if (!flags.has(args[i])) throw new VersionGuardError(`unknown CLI option: ${args[i]}`, 'CLI_USAGE');
    if (args[i] !== '--production' && (!args[i + 1] || args[i + 1].startsWith('--'))) throw new VersionGuardError(`missing value for ${args[i]}`, 'CLI_USAGE');
    if (args[i] !== '--production') i++;
  }
  const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  try {
    const gitSha = () => { try { const s = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); return /^[0-9a-f]{40}$/i.test(s) ? s : undefined; } catch { return undefined; } };
    const root = DEFAULT_ROOT; const result = await verifyRelease({ root, production: args.includes('--production'), buildSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || gitSha(), baseRef: value('--base-ref'), dist: value('--dist') });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, code: error.code ?? 'VERSION_GUARD', error: error.message })}\n`); process.exitCode = 1; }
}
