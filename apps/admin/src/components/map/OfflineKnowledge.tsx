import { useEffect, useMemo, useState } from 'react';
import { MapOfflinePanel } from './MapOfflinePanel';
import type { WikipediaArticle, TransitNetwork, OfflineMapPackageManifest } from '@markmap/contracts';
import { offlineMapStore } from '../../lib/storage/offline-map-store';
import { validateRegionalWikipedia, validateRegionalTransit, MAX_TRANSIT_BYTES, MAX_WIKIPEDIA_BYTES } from '@markmap/maps/content/region-content.mjs';

type Station = TransitNetwork['stations'][number];
type ContentState = { articles: WikipediaArticle[]; stations: Station[]; attribution: string[] };
const empty: ContentState = { articles: [], stations: [], attribution: [] };
export function hasOfflineKnowledge(manifest: Pick<OfflineMapPackageManifest, 'wikipediaPack' | 'transitPack'>): boolean {
  return Boolean(manifest.wikipediaPack || manifest.transitPack);
}

const KNOWN_CONTENT_ERRORS = new Set([
  'Dados locais ausentes ou incompletos. Reinstale a região.',
  'Falha de integridade no conteúdo regional.',
  'O mapa regional foi atualizado. Reabra este painel.',
]);

export function describeOfflineKnowledgeError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : null;
  return message && KNOWN_CONTENT_ERRORS.has(message)
    ? message
    : 'Conteúdo regional indisponível. Verifique o pacote offline em Configurações.';
}

async function readVerified(packageId: string, generation: string, ref: { path: string; blob: { bytes: number; sha256: string } }, limit: number): Promise<unknown> {
  const file = await offlineMapStore.assetAtRevision(packageId, ref.path, generation);
  if (!file && (await offlineMapStore.getActiveRevision(packageId))?.generation !== generation)
    throw new Error('O mapa regional foi atualizado. Reabra este painel.');
  if (!file || file.size !== ref.blob.bytes || file.size > limit) throw new Error('Dados locais ausentes ou incompletos. Reinstale a região.');
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== ref.blob.sha256) throw new Error('Falha de integridade no conteúdo regional.');
  return JSON.parse(await file.text()) as unknown;
}

/** Licensed, text-only regional knowledge. No network requests are performed. */
export function OfflineKnowledge({ packageId, open, onClose, onStation, onTransit }: {
  open: boolean;
  onClose: () => void;
  packageId: string | null;
  onStation: (lon: number, lat: number) => void;
  onTransit: (network: TransitNetwork | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<ContentState>(empty);
  const [error, setError] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<WikipediaArticle | null>(null);
  const [contentAvailable, setContentAvailable] = useState(false);
  useEffect(() => {
    let current = true;
    setData(empty);
    setSelectedArticle(null);
    setError('');
    setContentAvailable(false);
    onTransit(null);
    if (!packageId) return () => { current = false; };
    void (async () => {
      try {
        const installed = await offlineMapStore.getActiveRevision(packageId);
        if (!installed) return;
        const m = installed.manifest;
        if (!hasOfflineKnowledge(m)) {
          if (current) setError('Este mapa não inclui artigos ou transporte local. Instale uma região com conteúdo opcional.');
          return;
        }
        setContentAvailable(true);
        const next: ContentState = { articles: [], stations: [], attribution: [] };
        let verifiedTransit: TransitNetwork | null = null;
        if (m.wikipediaPack) {
          const raw = await readVerified(packageId, installed.generation, m.wikipediaPack, MAX_WIKIPEDIA_BYTES);
          const wiki = validateRegionalWikipedia(raw, m.id);
          next.articles = wiki.articles;
          next.attribution.push(`${wiki.attribution} · ${wiki.license}`);
        }
        if (m.transitPack) {
          const raw = await readVerified(packageId, installed.generation, m.transitPack, MAX_TRANSIT_BYTES);
          const network = validateRegionalTransit(raw, m.id, m.bounds);
          next.stations = network.stations;
          verifiedTransit = network;
          next.attribution.push(`${network.attribution} · ${network.license}`);
        }
        if (!current) return;
        if ((await offlineMapStore.getActiveRevision(packageId))?.generation !== installed.generation)
          throw new Error('O mapa regional foi atualizado. Reabra este painel.');
        if (current) { setData(next); onTransit(verifiedTransit); }
      } catch (cause) {
        if (current) setError(describeOfflineKnowledgeError(cause));
      }
    })();
    return () => { current = false; };
  }, [packageId, onTransit]);
  const term = query.trim().toLocaleLowerCase('pt-BR').slice(0, 100);
  const matches = useMemo(() => ({
    articles: term.length < 2 ? [] : data.articles.filter(a => a.title.toLocaleLowerCase('pt-BR').includes(term)).slice(0, 10),
    stations: term.length < 2 ? [] : data.stations.filter(a => a.name.toLocaleLowerCase('pt-BR').includes(term)).slice(0, 10),
  }), [term, data]);
  return <MapOfflinePanel open={open} onClose={onClose} title="Lugares e transporte offline" icon="map">
    <div className="space-y-2 text-sm">
      <p className="text-xs text-on-surface-variant">{data.articles.length} artigos · {data.stations.length} estações instaladas neste mapa.</p>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      <input type="search" value={query} disabled={!contentAvailable} onChange={e => { setQuery(e.target.value); setSelectedArticle(null); }} placeholder="Buscar artigo ou estação" aria-label="Buscar conteúdo regional offline" className="w-full rounded-lg border bg-background px-3 py-2 disabled:opacity-50" />
      {matches.articles.map(a => <button type="button" key={`a-${a.id}`} onClick={() => setSelectedArticle(a)} className="block min-h-[40px] w-full rounded-lg px-2 py-2 text-left hover:bg-primary/10">{a.title} <span className="text-xs">({a.language})</span></button>)}
      {matches.stations.map(s => <button type="button" key={`s-${s.id}`} onClick={() => onStation(s.lon, s.lat)} className="block min-h-[40px] w-full rounded-lg px-2 py-2 text-left hover:bg-primary/10">Estação: {s.name}</button>)}
      {selectedArticle && <article className="rounded-lg bg-primary/10 p-2">
        <h3 className="font-semibold">{selectedArticle.title}</h3>
        <p className="whitespace-pre-wrap break-words">{selectedArticle.summary}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{selectedArticle.attribution} · {selectedArticle.license}</p>
        {selectedArticle.url?.startsWith('https://') && <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" className="text-xs underline">Ver fonte (requer internet)</a>}
      </article>}
      {data.attribution.map(t => <p key={t} className="text-xs text-on-surface-variant">Fonte: {t}</p>)}
      {data.articles.length === 0 && data.stations.length === 0 && !error && <p className="text-xs text-on-surface-variant">Este mapa ainda não inclui artigos ou transporte local.</p>}
    </div>
  </MapOfflinePanel>;
}
