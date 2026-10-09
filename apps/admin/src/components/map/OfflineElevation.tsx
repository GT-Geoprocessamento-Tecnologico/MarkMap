import { useEffect, useMemo, useState } from 'react';
import type { Route } from '@geonexo/contracts';
import { offlineMapStore } from '../../lib/storage/offline-map-store';
import {
  MAX_REGIONAL_DEM_BYTES, computeRegionalElevationProfile, validateRegionalDem,
  type RegionalDemGrid,
} from '@geonexo/maps/elevation/regional-dem.mjs';

const formatHeight = (height: number | null) => height === null ? 'Sem dado' : `${Math.round(height)} m`;

/** Elevation is always derived from installed, checksum-verified height data. */
export function OfflineElevation({ packageId, route }: { packageId: string | null; route: Route | null }) {
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<RegionalDemGrid | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setGrid(null);
    setMessage(null);
    if (!packageId) return () => { active = false; };
    void (async () => {
      try {
        const stored = await offlineMapStore.get(packageId);
        const manifest = stored?.manifest;
        if (!manifest?.demGrid) {
          if (active) setMessage('Esta região não inclui dados reais de altitude.');
          return;
        }
        const ref = manifest.demGrid;
        const asset = await offlineMapStore.asset(packageId, ref.path);
        if (!asset || asset.size !== ref.blob.bytes || asset.size > MAX_REGIONAL_DEM_BYTES)
          throw new Error('Grade altimétrica ausente ou incompleta; reinstale a região.');
        const digest = await crypto.subtle.digest('SHA-256', await asset.arrayBuffer());
        const checksum = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
        if (checksum !== ref.blob.sha256) throw new Error('SHA-256 da altitude não corresponde ao pacote.');
        const valid = validateRegionalDem(JSON.parse(await asset.text()) as unknown, manifest.id, manifest.bounds);
        if (active) setGrid(valid);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Dados altimétricos indisponíveis.');
      }
    })();
    return () => { active = false; };
  }, [packageId]);

  const profile = useMemo(() => route && grid ? computeRegionalElevationProfile(route.geometry, grid) : null,
    [route, grid]);
  const chartLines = useMemo(() => {
    if (!profile || profile.minElevationMeters === null || profile.maxElevationMeters === null) return [];
    const spread = Math.max(1, profile.maxElevationMeters - profile.minElevationMeters);
    const series: string[] = [];
    let points: string[] = [];
    for (const sample of profile.samples) {
      if (sample.elevationMeters === null) {
        if (points.length >= 2) series.push(points.join(' '));
        points = [];
        continue;
      }
      const x = (sample.distanceMeters / profile.totalMeters) * 300;
      const y = 66 - ((sample.elevationMeters - profile.minElevationMeters) / spread) * 58;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    if (points.length >= 2) series.push(points.join(' '));
    return series;
  }, [profile]);

  return <section className="absolute left-3 top-24 z-20 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-outline-variant bg-surface-container/95 p-2 text-on-surface shadow-lg backdrop-blur" aria-label="Perfil de elevação offline">
    <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
      className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-primary/10">
      Altitude offline {open ? '−' : '+'}
    </button>
    {open && <div className="max-h-[40vh] space-y-2 overflow-y-auto p-2 text-sm">
      {message && <p role="status" className="text-xs">{message}</p>}
      {grid && !route && <p>Trace uma rota no mapa para consultar o perfil altimétrico.</p>}
      {grid && profile && <>
        <p className="font-semibold">{formatHeight(profile.minElevationMeters)} a {formatHeight(profile.maxElevationMeters)}</p>
        <p>Subida: {Math.round(profile.gainMeters)} m · Descida: {Math.round(profile.lossMeters)} m</p>
        <p className="text-xs">Cobertura medida: {profile.coveragePercent}% · resolução da grade: aproximadamente {Math.round(grid.metadata.resolutionMeters)} m.</p>
        {chartLines.length > 0 && <svg viewBox="0 0 300 74" role="img" aria-label="Gráfico de altitude ao longo da rota" className="h-24 w-full rounded bg-primary/5">
          {chartLines.map((points, i) => <polyline key={i} points={points} fill="none" stroke="currentColor" strokeWidth="2" />)}
        </svg>}
        {profile.missingCount > 0 && <p role="status" className="text-xs text-amber-600">Trechos sem dados foram omitidos; subida e descida são parciais.</p>}
      </>}
      {grid && <p className="break-words text-xs text-on-surface-variant">Fonte: {grid.metadata.attribution} · licença: {grid.metadata.license} · datum: {grid.metadata.verticalDatum}. Altitude do terreno, não a altura do GPS. <a className="underline" href={grid.metadata.sourceUrl} target="_blank" rel="noopener noreferrer">Origem (requer internet)</a></p>}
    </div>}
  </section>;
}
