import { cp, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const release = process.cwd();
const source = 'https://build.protomaps.com/20261019.pmtiles';
const date = '2026-10-19T04:00:00.000Z';
const geographyPath = join(release, 'scripts/data/brazil-region-geography.json');
const outputRoot = join(release, 'apps/admin/public/offline');
const styleSource = join(outputRoot, 'araguaina/style.json');
const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify-only');
function option(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; }
const tool = option('--pmtiles');
const workRoot = option('--work-dir');
if (!verifyOnly && (!tool || !resolve(tool))) throw new Error('Uso: --pmtiles <caminho> é obrigatório; use --verify-only para validar assets existentes');
if (tool && !(await stat(resolve(tool))).isFile()) throw new Error(`Executável PMTiles ausente: ${tool}`);

function run(command, argv, cwd = release) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '', err = '';
    child.stdout.on('data', data => { out += data; }); child.stderr.on('data', data => { err += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveRun({ out, err }) : reject(new Error(`${command} ${argv.join(' ')} exit ${code}\n${err}`)));
  });
}
function validBounds(bounds) {
  return Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite) && bounds[0] < bounds[2] && bounds[1] < bounds[3] && bounds[0] >= -180 && bounds[2] <= 180 && bounds[1] >= -85.051129 && bounds[3] <= 85.051129;
}
function validateGeography(geography) {
  if (!Array.isArray(geography.entries) || geography.entries.length !== 27) throw new Error('Geografia deve conter exatamente 27 UFs');
  const ufs = new Set(), cities = new Set();
  const allowed = new Set(['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']);
  for (const entry of geography.entries) {
    if (!allowed.has(entry.uf) || ufs.has(entry.uf) || !entry.stateName || !validBounds(entry.stateBounds)) throw new Error(`UF inválida: ${entry.uf}`);
    if (!Number.isInteger(entry.cityIbge) || !/^\d{7}$/.test(String(entry.cityIbge)) || cities.has(entry.cityIbge) || !entry.cityName || !validBounds(entry.cityBounds)) throw new Error(`capital inválida: ${entry.cityIbge}`);
    ufs.add(entry.uf); cities.add(entry.cityIbge);
  }
}
const geography = JSON.parse(await readFile(geographyPath, 'utf8'));
validateGeography(geography);
const targets = geography.entries.flatMap(entry => [
  { id: `br-uf-${entry.uf.toLowerCase()}`, kind: 'state', label: `${entry.stateName} — mapa offline`, area: `${entry.stateName} — visão estadual, sem rótulos ou rotas`, bounds: entry.stateBounds, maxZoom: 9, sourceUrl: entry.stateSource, entry },
  { id: `br-city-${entry.cityIbge}`, kind: 'city', label: `${entry.cityName} — mapa offline`, area: `${entry.cityName}, ${entry.stateName} — área municipal, sem rótulos ou rotas`, bounds: entry.cityBounds, maxZoom: 12, sourceUrl: entry.citySource, entry },
]);

async function sha256(path) { const hash = createHash('sha256'); hash.update(await readFile(path)); return hash.digest('hex'); }
async function validatePackage(target, directory) {
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const archive = join(directory, 'package.pmtiles'), style = join(directory, 'style.json');
  const archiveStat = await stat(archive), styleStat = await stat(style);
  const archiveHash = await sha256(archive), styleHash = await sha256(style);
  if (manifest.id !== target.id || JSON.stringify(manifest.bounds) !== JSON.stringify(target.bounds) || manifest.minZoom !== 0 || manifest.maxZoom !== target.maxZoom) throw new Error(`manifest incompatível: ${target.id}`);
  if (manifest.osmDataDate !== date || manifest.packageVersion !== '1.0.0-brazil.20261019') throw new Error(`metadata de fonte/data incompatível: ${target.id}`);
  if (manifest.archive.bytes !== archiveStat.size || manifest.archive.sha256 !== archiveHash || manifest.style.blob.bytes !== styleStat.size || manifest.style.blob.sha256 !== styleHash) throw new Error(`checksum/bytes incompatíveis: ${target.id}`);
  if (archiveStat.size >= 50 * 1024 * 1024 || manifest.totalBytes >= 50 * 1024 * 1024) throw new Error(`pacote excede 50 MiB: ${target.id}`);
  if (!manifest.sources?.osm?.includes('Protomaps Basemap 4.15.2') || !manifest.sources.attributions?.some(item => item.name === 'Protomaps Basemap')) throw new Error(`proveniência Protomaps ausente: ${target.id}`);
  return manifest;
}
async function writeIndexes(manifests) {
  const oldCatalog = JSON.parse(await readFile(join(release, 'apps/admin/public/maps/catalog.json'), 'utf8'));
  const araguaina = oldCatalog.regions.find(region => region.id === 'br-araguaina');
  if (!araguaina || araguaina.manifestUrl !== 'https://appmarkmap.mtsferreira.dev/offline/araguaina/manifest.json') throw new Error('entrada Araguaína ausente ou alterada');
  const regions = [araguaina, ...targets.map(target => { const manifest = manifests.get(target.id); return { sizeBytes: manifest.totalBytes, bounds: manifest.bounds, manifestUrl: `https://appmarkmap.mtsferreira.dev/offline/${target.id}/manifest.json`, attribution: 'OpenStreetMap contributors · Protomaps Basemap', label: target.label, area: target.area, id: target.id }; })];
  if (regions.length !== 55 || JSON.stringify(araguaina) !== JSON.stringify(oldCatalog.regions.find(region => region.id === 'br-araguaina'))) throw new Error('catálogo Araguaína mudou');
  await writeFile(join(release, 'apps/admin/public/maps/catalog.json'), JSON.stringify({ version: 1, regions }, null, 2) + '\n');
  const locations = geography.entries.flatMap(entry => [{ regionId: `br-uf-${entry.uf.toLowerCase()}`, stateCode: entry.uf, stateName: entry.stateName, kind: 'state' }, { regionId: `br-city-${entry.cityIbge}`, stateCode: entry.uf, stateName: entry.stateName, kind: 'city', cityName: entry.cityName }]);
  locations.push({ regionId: 'br-araguaina', stateCode: 'TO', stateName: 'Tocantins', kind: 'city', cityName: 'Araguaína' });
  await writeFile(join(release, 'apps/admin/public/maps/locations.json'), JSON.stringify({ version: 1, locations }, null, 2) + '\n');
  await writeFile(join(release, 'docs/region-package-provenance.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sourceArchive: source, sourceDate: date, license: 'ODbL Produced Work; OpenStreetMap attribution required', geometrySource: 'https://servicodados.ibge.gov.br/api/v3/malhas/', packageCount: 54, totalBytes: [...manifests.values()].reduce((sum, manifest) => sum + manifest.totalBytes, 0), targetCount: 55, tool: 'go-pmtiles 1.31.2', packages: targets.map(target => { const manifest = manifests.get(target.id); return { id: target.id, bounds: manifest.bounds, minZoom: manifest.minZoom, maxZoom: manifest.maxZoom, bytes: manifest.totalBytes, archiveSha256: manifest.archive.sha256, sourceUrl: target.sourceUrl }; }) }, null, 2) + '\n');
}
const manifests = new Map();
if (verifyOnly) {
  for (const target of targets) manifests.set(target.id, await validatePackage(target, join(outputRoot, target.id)));
  const catalogPath = join(release, 'apps/admin/public/maps/catalog.json');
  const locationPath = join(release, 'apps/admin/public/maps/locations.json');
  const catalogRaw = await readFile(catalogPath), locationRaw = await readFile(locationPath);
  const catalog = JSON.parse(catalogRaw.toString('utf8')), locations = JSON.parse(locationRaw.toString('utf8'));
  if (catalogRaw.length > 65536 || locationRaw.length > 65536 || catalog.version !== 1 || locations.version !== 1 || catalog.regions.length !== 55 || locations.locations.length !== 55) throw new Error('Índices publicados incompatíveis');
  if (new Set(catalog.regions.map(item => item.id)).size !== 55 || new Set(locations.locations.map(item => item.regionId)).size !== 55) throw new Error('Índices duplicados');
  for (const target of targets) {
    const manifest = manifests.get(target.id), entry = catalog.regions.find(item => item.id === target.id);
    const place = locations.locations.find(item => item.regionId === target.id);
    if (!entry || !place || entry.sizeBytes !== manifest.totalBytes || JSON.stringify(entry.bounds) !== JSON.stringify(manifest.bounds) || entry.manifestUrl !== 'https://appmarkmap.mtsferreira.dev/offline/' + target.id + '/manifest.json' || entry.area !== target.area) throw new Error('Catálogo divergente: ' + target.id);
    if (place.stateCode !== target.entry.uf || place.stateName !== target.entry.stateName || place.kind !== target.kind || (target.kind === 'city' && place.cityName !== target.entry.cityName)) throw new Error('Localização divergente: ' + target.id);
  }
  const totalBytes = [...manifests.values()].reduce((sum, manifest) => sum + manifest.totalBytes, 0);
  if (totalBytes > 150 * 1024 * 1024) throw new Error('Pacotes excedem o orçamento de publicação');
  console.log(JSON.stringify({ mode: 'verify-only', packages: manifests.size, regions: 55, totalBytes }, null, 2));
  process.exit(0);
}
if (workRoot) await mkdir(resolve(workRoot), { recursive: true });
const work = await mkdtemp(join(workRoot ? resolve(workRoot) : tmpdir(), 'markmap-brazil-regions-'));
try {
  let cursor = 0;
  while (cursor < targets.length) {
    const batch = targets.slice(cursor, cursor + 2);
    await Promise.all(batch.map(async target => {
      const directory = join(outputRoot, target.id);
      try { manifests.set(target.id, await validatePackage(target, directory)); return; } catch { /* materialize below */ }
      const input = join(work, `${target.id}-input`); await mkdir(input, { recursive: true });
      await writeFile(join(input, 'region.json'), JSON.stringify({ id: target.id, label: target.label, bounds: target.bounds, minZoom: 0, maxZoom: target.maxZoom, osmDataDate: date, versao: '1.0.0-brazil.20261019', packageVersion: '1.0.0-brazil.20261019', sources: { osm: 'OpenStreetMap + Natural Earth via Protomaps Basemap 4.15.2', attributions: [{ name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' }, { name: 'Protomaps Basemap', url: 'https://docs.protomaps.com/basemaps/downloads' }] } }, null, 2));
      await cp(styleSource, join(input, 'style.json'));
      const archive = join(input, 'basemap.pmtiles');
      await run(resolve(tool), ['extract', source, archive, `--bbox=${target.bounds.join(',')}`, '--minzoom', '0', '--maxzoom', String(target.maxZoom), '--download-threads', '2']);
      await run(process.execPath, ['scripts/region-pipeline.mjs', '--input', input, '--output', directory]);
      await writeFile(join(directory, 'NOTICE.md'), `# ${target.label}\n\nDados derivados do Protomaps Basemap 4.15.2, snapshot OSM ${date}.\n\nODbL Produced Work; atribuição obrigatória a OpenStreetMap contributors: https://www.openstreetmap.org/copyright\nFonte do basemap: https://docs.protomaps.com/basemaps/downloads\nGeometria administrativa usada para o recorte: IBGE Malhas v3 (${target.sourceUrl}).\n`);
      manifests.set(target.id, await validatePackage(target, directory));
    }));
    cursor += batch.length; const total = [...manifests.values()].reduce((sum, manifest) => sum + manifest.totalBytes, 0); console.log(`progress ${cursor}/${targets.length} packages bytes=${total}`); if (total > 150 * 1024 * 1024) throw new Error(`projected package bytes exceed 150 MiB at ${cursor}`);
  }
  await writeIndexes(manifests);
  console.log(JSON.stringify({ packages: manifests.size, totalBytes: [...manifests.values()].reduce((sum, manifest) => sum + manifest.totalBytes, 0), regions: 55 }, null, 2));
} finally { /* mkdtemp work dir is isolated and left for inspection; no arbitrary recursive delete */ }
