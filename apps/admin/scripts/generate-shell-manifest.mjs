import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const HASHED_FILE = /(?:[-.])[a-z0-9_-]{8,}\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg)$/i;
const ALWAYS_SHELL = new Set(['index.html', 'manifest.json', 'icons/icon-192x192.png', 'icons/icon-512x512.png']);
const EXCLUDED_PREFIXES = ['map/', 'maps/', 'api/'];

async function filesUnder(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(root, path));
    else result.push(path);
  }
  return result;
}

export async function collectShellAssets(distDirectory) {
  const all = await filesUnder(distDirectory);
  const assets = new Set();
  for (const path of all) {
    const name = relative(distDirectory, path).split(sep).join('/');
    if (ALWAYS_SHELL.has(name) || (name.startsWith('assets/') && HASHED_FILE.test(name)) ||
        (name.startsWith('fonts/') && /\.(?:woff2?|ttf|otf)$/i.test(name)) ||
        (name.startsWith('icons/') && /\.(?:png|svg|webp)$/i.test(name))) {
      if (!EXCLUDED_PREFIXES.some((prefix) => name.startsWith(prefix))) assets.add(`/${name}`);
    }
  }
  return [...assets].sort();
}

export async function generateShellManifest(distDirectory) {
  const assets = await collectShellAssets(distDirectory);
  if (!assets.includes('/index.html')) throw new Error('shell manifest requires index.html');
  const payload = JSON.stringify({ version: createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 16), assets }, null, 2) + '\n';
  await writeFile(join(distDirectory, 'shell-manifest.json'), payload, 'utf8');
  const workerPath = join(distDirectory, 'sw.js');
  try {
    const worker = await readFile(workerPath, 'utf8');
    await writeFile(workerPath, worker
      .replaceAll('__GEONEXO_SHELL_MANIFEST__', JSON.stringify(assets))
      .replaceAll('__GEONEXO_SHELL_VERSION__', JSON.stringify(JSON.parse(payload).version)), 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return { assets, version: JSON.parse(payload).version };
}

if (process.argv[1] && process.argv[1].endsWith('generate-shell-manifest.mjs')) {
  const distDirectory = process.argv[2] ?? join(process.cwd(), 'dist');
  const result = await generateShellManifest(distDirectory);
  process.stdout.write(`Generated shell manifest ${result.version} (${result.assets.length} assets)\n`);
}
