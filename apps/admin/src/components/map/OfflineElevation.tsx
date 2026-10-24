import { useEffect, useMemo, useRef, useState } from 'react';
import { MapOfflinePanel } from './MapOfflinePanel';
import type { Route, OfflineMapPackageManifest } from '@markmap/contracts';
import { offlineMapStore } from '../../lib/storage/offline-map-store';
import {
  MAX_REGIONAL_DEM_BYTES, computeRegionalElevationProfile, sampleRegionalDem, validateRegionalDem,
  type DemSampleGrid, type RegionalDemGrid,
} from '@markmap/maps/elevation/regional-dem.mjs';
import {
  downloadTerrainGrid, getCachedTerrainGrid, getTerrainPoint,
  type TerrainBounds, type TerrainGrid,
} from '../../lib/elevation/terrain-client';

type Point = [number, number];
type GridSource = 'manifest-dem' | 'aws-terrain-cache';
export type OfflineElevationProps = {
  packageId: string | null;
  route: Route | null;
  open: boolean;
  onClose: () => void;
  center?: Point;
  viewportBounds?: TerrainBounds;
  profileGeometry?: Point[];
};

const ONLINE_ATTRIBUTION = 'Terrain Tiles por Mapzen, hospedado no AWS Open Data; provedores de origem conforme a atribuição Tilezen.';
const ONLINE_LICENSE = 'Open data; attribution requirements vary by source provider. See Tilezen attribution.';
const ONLINE_DATUM = 'Referência vertical varia conforme a fonte; consulte a atribuição.';
const ONLINE_SOURCE_URL = 'https://registry.opendata.aws/terrain-tiles/';
const formatHeight = (height: number | null) => height === null ? 'Sem dado' : `${Math.round(height)} m`;
export function hasOfflineElevation(manifest: Pick<OfflineMapPackageManifest, 'demGrid'>): boolean {
  return Boolean(manifest.demGrid);
}
const KNOWN_ELEVATION_ERRORS = new Set([
  'Grade altimétrica ausente ou incompleta; reinstale a região.',
  'SHA-256 da altitude não corresponde ao pacote.',
  'O mapa regional foi atualizado. Reabra o perfil de altitude.',
]);
export function describeOfflineElevationError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : null;
  return message && KNOWN_ELEVATION_ERRORS.has(message)
    ? message
    : 'Dados altimétricos indisponíveis. Verifique o pacote offline em Configurações.';
}
function inside(bounds: TerrainBounds | undefined, point: Point | undefined): boolean {
  return Boolean(bounds && point && point[0] >= bounds[0] && point[0] <= bounds[2] && point[1] >= bounds[1] && point[1] <= bounds[3]);
}
export function terrainGridAsDem(grid: TerrainGrid): DemSampleGrid {
  return {
    metadata: {
      verticalDatum: grid.metadata.verticalDatum,
      attribution: grid.metadata.attribution,
      license: grid.metadata.license,
      sourceUrl: grid.metadata.sourceUrl,
      resolutionMeters: grid.metadata.resolutionMeters,
      noDataValue: grid.metadata.noDataValue,
      width: grid.metadata.width, height: grid.metadata.height,
      bounds: grid.metadata.bounds,
    },
    values: grid.values,
  };
}
function sourceText(source: GridSource | 'aws-terrain-online' | null): string {
  if (source === 'manifest-dem') return 'DEM regional instalado';
  if (source === 'aws-terrain-cache') return 'AWS Terrain Tiles (cache local)';
  if (source === 'aws-terrain-online') return 'AWS Terrain Tiles (online)';
  return 'sem fonte';
}

/** Terrain height is always derived from measured DEM data or the authorized source adapter. */
export function OfflineElevation({ packageId, route, open, onClose, center, viewportBounds, profileGeometry }: OfflineElevationProps) {
  const [manifestGrid, setManifestGrid] = useState<RegionalDemGrid | null>(null);
  const [grid, setGrid] = useState<(RegionalDemGrid | DemSampleGrid) | null>(null);
  const [gridSource, setGridSource] = useState<GridSource | null>(null);
  const [manifestBounds, setManifestBounds] = useState<TerrainBounds | undefined>();
  const [manifestReady, setManifestReady] = useState(!packageId);
  const [cacheCheckedKey, setCacheCheckedKey] = useState('');
  const [point, setPoint] = useState<{ elevationMeters: number | null; resolutionMeters: number; source: 'manifest-dem' | 'aws-terrain-cache' | 'aws-terrain-online'; attribution: string; license: string; verticalDatum: string; sourceUrl: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ completed: number; total: number } | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const pointRequest = useRef(0);
  const downloadRequest = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; downloadAbort.current?.abort(); };
  }, []);

  useEffect(() => {
    let active = true;
    setManifestGrid(null); setGrid(null); setGridSource(null); setManifestBounds(undefined);
    setCacheCheckedKey(''); setPoint(null); setMessage(null); setDownloadNotice(null); setDownloadProgress(null); setManifestReady(!packageId);
    if (!packageId) return () => { active = false; };
    void (async () => {
      try {
        const stored = await offlineMapStore.getActiveRevision(packageId);
        if (!stored) { if (active) setMessage('Selecione uma região para consultar a altitude.'); return; }
        if (!active) return;
        setManifestBounds(stored.manifest.bounds);
        const ref = stored.manifest.demGrid;
        if (!ref) return;
        const asset = await offlineMapStore.assetAtRevision(packageId, ref.path, stored.generation);
        if (!asset && (await offlineMapStore.getActiveRevision(packageId))?.generation !== stored.generation)
          throw new Error('O mapa regional foi atualizado. Reabra o perfil de altitude.');
        if (!asset || asset.size !== ref.blob.bytes || asset.size > MAX_REGIONAL_DEM_BYTES)
          throw new Error('Grade altimétrica ausente ou incompleta; reinstale a região.');
        const digest = await crypto.subtle.digest('SHA-256', await asset.arrayBuffer());
        const checksum = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
        if (checksum !== ref.blob.sha256) throw new Error('SHA-256 da altitude não corresponde ao pacote.');
        const valid = validateRegionalDem(JSON.parse(await asset.text()) as unknown, stored.manifest.id, stored.manifest.bounds);
        if (!active || (await offlineMapStore.getActiveRevision(packageId))?.generation !== stored.generation) {
          if (active) throw new Error('O mapa regional foi atualizado. Reabra o perfil de altitude.');
          return;
        }
        setManifestGrid(valid); setGrid(valid); setGridSource('manifest-dem');
      } catch (error) { if (active) setMessage(describeOfflineElevationError(error)); }
      finally { if (active) setManifestReady(true); }
    })();
    return () => { active = false; };
  }, [packageId]);

  const cacheBounds = manifestBounds ?? viewportBounds;
  const cacheBoundsKey = cacheBounds?.join(',') ?? '';
  const cacheContextKey = `${packageId ?? 'viewport'}|${cacheBoundsKey}`;
  useEffect(() => {
    let active = true;
    const regionId = packageId ?? 'viewport';
    if (!open || manifestGrid || !cacheBounds || (packageId && !manifestBounds)) { if ((manifestGrid || !cacheBounds) && !(packageId && !manifestBounds)) setCacheCheckedKey(cacheContextKey); return () => { active = false; }; }
    setCacheCheckedKey('');
    setGrid(null); setGridSource(null); setPoint(null);
    void getCachedTerrainGrid(regionId, cacheBounds).then((cached) => {
      if (!active || !cached) return;
      const dem = terrainGridAsDem(cached);
      setGrid(dem); setGridSource('aws-terrain-cache'); setMessage(null);
    }).catch(() => undefined).finally(() => { if (active) setCacheCheckedKey(cacheContextKey); });
    return () => { active = false; };
  }, [open, packageId, manifestGrid, cacheContextKey]);

  useEffect(() => {
    const request = ++pointRequest.current;
    if (!open || !center || !manifestReady || (!manifestGrid && cacheCheckedKey !== cacheContextKey)) return () => undefined;
    const controller = new AbortController();
    if (grid && inside(grid.metadata.bounds, center)) {
      const dem = sampleRegionalDem(grid, center[0], center[1]);
      if (dem !== null) {
        setPoint({ elevationMeters: dem, resolutionMeters: grid.metadata.resolutionMeters, source: gridSource ?? 'manifest-dem', attribution: grid.metadata.attribution, license: grid.metadata.license, verticalDatum: grid.metadata.verticalDatum, sourceUrl: grid.metadata.sourceUrl });
        setMessage(null);
        return () => controller.abort();
      }
    }
    setPoint(null); setMessage('Consultando altitude do ponto…');
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (grid && inside(grid.metadata.bounds, center)) {
            const dem = sampleRegionalDem(grid, center[0], center[1]);
            if (dem !== null && request === pointRequest.current && !controller.signal.aborted) {
              setPoint({ elevationMeters: dem, resolutionMeters: grid.metadata.resolutionMeters, source: gridSource ?? 'manifest-dem', attribution: grid.metadata.attribution, license: grid.metadata.license, verticalDatum: grid.metadata.verticalDatum, sourceUrl: grid.metadata.sourceUrl });
              setMessage(null);
              return;
            }
          }
          const result = await getTerrainPoint(center[0], center[1], controller.signal);
          if (controller.signal.aborted || request !== pointRequest.current || !mounted.current) return;
          setPoint({ ...result, source: 'aws-terrain-online', attribution: ONLINE_ATTRIBUTION, license: ONLINE_LICENSE, verticalDatum: ONLINE_DATUM, sourceUrl: ONLINE_SOURCE_URL });
          setMessage(null);
        } catch (error) {
          if (!controller.signal.aborted && request === pointRequest.current && mounted.current) { setPoint(null); setMessage(error instanceof Error ? error.message : 'Altitude online indisponível.'); }
        }
      })();
    }, 300);
    return () => { window.clearTimeout(timer); pointRequest.current++; controller.abort(); };
  }, [open, packageId, center, grid, gridSource, manifestGrid, manifestReady, cacheCheckedKey, cacheContextKey]);

  useEffect(() => {
    return () => {
      ++downloadRequest.current;
      downloadAbort.current?.abort();
      downloadAbort.current = null;
      if (mounted.current) { setLoading(false); setDownloadProgress(null); }
    };
  }, [packageId, cacheBoundsKey]);

  const download = async () => {
    const bounds = manifestBounds ?? viewportBounds;
    if (!bounds) { setMessage('Selecione uma região ou forneça a área visível para baixar altitude.'); return; }
    const regionId = packageId ?? 'viewport';
    downloadAbort.current?.abort();
    const controller = new AbortController(); downloadAbort.current = controller;
    const request = ++downloadRequest.current;
    const current = () => mounted.current && downloadAbort.current === controller && request === downloadRequest.current && !controller.signal.aborted;
    setLoading(true); setMessage(null); setDownloadNotice(null); setDownloadProgress(null);
    try {
      const downloaded = await downloadTerrainGrid({ regionId, bounds, signal: controller.signal,
        onProgress: (completed, total) => { if (current()) setDownloadProgress({ completed, total }); } });
      if (!current()) return;
      setGrid(terrainGridAsDem(downloaded)); setGridSource('aws-terrain-cache');
      setDownloadNotice('Altitude disponível offline nesta região.');
    } catch (error) {
      if (current()) setMessage(error instanceof Error ? error.message : 'Não foi possível baixar a altitude.');
    } finally {
      if (current()) { downloadAbort.current = null; setLoading(false); setDownloadProgress(null); }
    }
  };
  const cancelDownload = () => { const controller = downloadAbort.current; if (!controller) return; ++downloadRequest.current; controller.abort(); downloadAbort.current = null; setLoading(false); setDownloadProgress(null); setMessage('Download de altitude cancelado.'); };

  const geometry = profileGeometry?.length ? profileGeometry : route?.geometry;
  const pointInsideGrid = inside(grid?.metadata.bounds, center);
  const profile = useMemo(() => geometry && grid ? computeRegionalElevationProfile(geometry, grid) : null, [geometry, grid]);
  const chartLines = useMemo(() => {
    if (!profile || profile.minElevationMeters === null || profile.maxElevationMeters === null) return [];
    const spread = Math.max(1, profile.maxElevationMeters - profile.minElevationMeters); const series: string[] = []; let points: string[] = [];
    for (const sample of profile.samples) {
      if (sample.elevationMeters === null) { if (points.length >= 2) series.push(points.join(' ')); points = []; continue; }
      points.push(`${(sample.distanceMeters / profile.totalMeters * 300).toFixed(1)},${(66 - ((sample.elevationMeters - profile.minElevationMeters) / spread) * 58).toFixed(1)}`);
    }
    if (points.length >= 2) series.push(points.join(' ')); return series;
  }, [profile]);

  return <MapOfflinePanel open={open} onClose={onClose} title="Altitude" icon="analytics">
    <div className="space-y-2 text-sm">
      {message && <p role="status" aria-live="polite" className="text-xs">{message}</p>}
      {downloadNotice && <p role="status" aria-live="polite" className="text-xs">{downloadNotice}</p>}
      {point && <div className="rounded-lg bg-primary/10 p-2"><p className="font-semibold">Ponto: {formatHeight(point.elevationMeters)}</p><p className="text-xs">Resolução aproximada: {Math.round(point.resolutionMeters)} m · {sourceText(point.source)} · terreno, não GPS.</p><p className="break-words text-xs">Fonte: {point.attribution} · licença: {point.license} · datum: {point.verticalDatum} · <a className="underline" href={point.sourceUrl} target="_blank" rel="noopener noreferrer">Origem</a></p></div>}
      {center && !point && !message && <p className="text-xs">Consultando o centro do mapa…</p>}
      {grid && profile && <><p className="font-semibold">Perfil: {formatHeight(profile.minElevationMeters)} a {formatHeight(profile.maxElevationMeters)}</p><p>Subida: {Math.round(profile.gainMeters)} m · Descida: {Math.round(profile.lossMeters)} m</p><p className="text-xs">Cobertura medida: {profile.coveragePercent}% · resolução: aproximadamente {Math.round(grid.metadata.resolutionMeters)} m · {sourceText(gridSource)}</p>{chartLines.length > 0 && <svg viewBox="0 0 300 74" role="img" aria-label="Gráfico de altitude ao longo do traçado" className="h-24 w-full rounded bg-primary/5">{chartLines.map((points, i) => <polyline key={i} points={points} fill="none" stroke="currentColor" strokeWidth="2" />)}</svg>}{profile.missingCount > 0 && <p role="status" className="text-xs text-amber-600">Trechos sem dados foram omitidos; subida e descida são parciais.</p>}</>}
      {!geometry && <p className="text-xs">Mova ou toque no mapa para consultar a altitude do ponto central. Use Medir distância para montar um perfil.</p>}
      {geometry && !grid && <p className="text-xs">Baixe uma grade para consultar o perfil e continuar sem internet.</p>}
      {grid && gridSource === 'aws-terrain-cache' && <p role="status" className="text-xs">Altitude disponível offline nesta região.{center && !pointInsideGrid ? ' O ponto central atual está fora da área baixada.' : ''}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className="min-h-[44px] rounded-lg border px-3" onClick={download} disabled={loading || (!manifestBounds && !viewportBounds)}>Baixar altitude deste mapa</button>{loading && <button type="button" className="min-h-[44px] rounded-lg border px-3" onClick={cancelDownload}>Cancelar</button>}</div>
      {downloadProgress && <p role="status" className="text-xs">Baixando altitude: {downloadProgress.completed}/{downloadProgress.total} tiles.</p>}
      {grid && <p className="break-words text-xs text-on-surface-variant">Fonte: {grid.metadata.attribution} · licença: {grid.metadata.license} · datum: {grid.metadata.verticalDatum}. <a className="underline" href={grid.metadata.sourceUrl} target="_blank" rel="noopener noreferrer">Origem</a></p>}
    </div>
  </MapOfflinePanel>;
}
