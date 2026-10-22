import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LocalSearchRecord } from '../../lib/search/local-map-search';
import { normalizeName, searchIndex } from '@geonexo/maps/search';
import { MapOfflinePanel } from './MapOfflinePanel';
import { configuredAddressSearchEndpoint, searchAddressOnline, type AddressResult } from '../../lib/search/address-geocoder';

interface SearchHit { id: string; name: string; lon: number; lat: number; category: string; source?: string; attribution?: string; postalCode?: string; }

export function OfflineSearch({ open, onClose, records, regionalCount = 0, mapRecordCount, warning, onChoose }: {
  open: boolean; onClose: () => void; records: LocalSearchRecord[]; regionalCount?: number; mapRecordCount?: number; warning?: string | null; onChoose: (place: SearchHit) => void;
}) {
  const displayedMapCount = mapRecordCount ?? Math.max(0, records.length - regionalCount);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [error, setError] = useState('');
  const [localBusy, setLocalBusy] = useState(false);
  const [localNotice, setLocalNotice] = useState('');
  const worker = useRef<Worker | null>(null);
  const workerFailed = useRef(false);
  const recordsRef = useRef<LocalSearchRecord[]>(records);
  const queryRef = useRef(query);
  const localBusyRef = useRef(localBusy);
  const remoteController = useRef<AbortController | null>(null);
  const localRequestId = useRef(0);
  const remoteOperationId = useRef(0);
  const [remote, setRemote] = useState<AddressResult[]>([]);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteNotice, setRemoteNotice] = useState('');
  queryRef.current = query;
  localBusyRef.current = localBusy;

  const fallbackLocal = useCallback((id: number, term: string) => {
    if (id !== localRequestId.current) return;
    try {
      const response = searchIndex(recordsRef.current, { query: term, limit: 12 });
      setResults(response.results);
      setLocalBusy(false);
      if (!response.results.length) setLocalNotice('Nenhum local encontrado nos dados disponíveis offline.');
    } catch { setLocalBusy(false); setLocalNotice('A busca local não está disponível neste navegador.'); }
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const instance = new Worker(new URL('../../workers/map-search.worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<{ requestId: number; results: SearchHit[]; error?: string }>) => {
        if (!active || event.data.requestId !== localRequestId.current) return;
        setResults(event.data.results); setError(event.data.error ?? ''); setLocalBusy(false);
        if (event.data.error) setLocalNotice('A busca local encontrou um problema. Tente novamente.');
        else if (!event.data.results.length) setLocalNotice('Nenhum local encontrado nos dados disponíveis offline.');
      };
      instance.onerror = () => {
        if (!active) return;
        workerFailed.current = true; setError('');
        if (localBusyRef.current && queryRef.current.trim()) fallbackLocal(localRequestId.current, queryRef.current.trim());
        else setLocalNotice('A busca local não está disponível neste navegador.');
      };
    } catch { workerFailed.current = true; }
    return () => { active = false; worker.current?.terminate(); worker.current = null; };
  }, [fallbackLocal]);

  const invalidateLocal = useCallback(() => { localRequestId.current += 1; }, []);
  useEffect(() => { recordsRef.current = records; invalidateLocal(); try { worker.current?.postMessage({ type: 'load', records }); } catch { workerFailed.current = true; } }, [invalidateLocal, records]);

  const invalidateRemote = useCallback(() => {
    remoteController.current?.abort(); remoteController.current = null; remoteOperationId.current += 1;
    setRemoteBusy(false); setRemote([]); setRemoteNotice('');
  }, []);
  useEffect(() => {
    if (!open) { invalidateRemote(); invalidateLocal(); }
    return () => { remoteController.current?.abort(); remoteOperationId.current += 1; invalidateLocal(); };
  }, [open, invalidateLocal, invalidateRemote]);

  const searchLocal = useCallback(() => {
    const term = query.trim(); const id = ++localRequestId.current;
    setError(''); setLocalNotice(''); setResults([]); setLocalBusy(false);
    if (!term) { setLocalNotice('Digite um nome, rua ou endereço para pesquisar.'); return; }
    if (!recordsRef.current.length) {
      setLocalNotice(regionalCount > 0 ? 'Este mapa regional não possui índice de busca offline.' : 'Não há nomes disponíveis na área exibida. Aproxime ou mova o mapa para carregar mais ruas.');
      return;
    }
    setLocalBusy(true);
    if (worker.current && !workerFailed.current) {
      try { worker.current.postMessage({ type: 'search', requestId: id, query: term }); return; } catch { workerFailed.current = true; }
    }
    fallbackLocal(id, term);
  }, [fallbackLocal, query, regionalCount]);

  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); setLocalBusy(false); return; }
    const timeout = setTimeout(() => searchLocal(), 160);
    return () => clearTimeout(timeout);
  }, [open, query, records, searchLocal]);

  const findOnline = useCallback(async (term: string, id: number) => {
    const endpoint = configuredAddressSearchEndpoint();
    if (!endpoint || term.length < 3) return;
    const controller = new AbortController();
    remoteController.current?.abort(); remoteController.current = controller;
    setRemoteBusy(true); setRemoteNotice(''); setRemote([]);
    try {
      const places = await searchAddressOnline(term, controller.signal);
      if (!controller.signal.aborted && id === remoteOperationId.current) {
        setRemote(places);
        if (!places.length) setRemoteNotice('Endereço não encontrado. Tente incluir cidade e estado.');
      }
    } catch (cause) {
      if (!controller.signal.aborted && id === remoteOperationId.current) setRemoteNotice(cause instanceof Error ? cause.message : 'Busca online indisponível.');
    } finally {
      if (remoteController.current === controller) { remoteController.current = null; setRemoteBusy(false); }
    }
  }, []);

  const submitSearch = useCallback(() => {
    const term = query.trim();
    invalidateRemote();
    searchLocal();
    if (!term || term.length < 3) return;
    const id = ++remoteOperationId.current;
    void findOnline(term, id);
  }, [findOnline, invalidateRemote, query, searchLocal]);

  const combined = useMemo<SearchHit[]>(() => {
    const seen = new Set<string>();
    const key = (name: string, lon: number, lat: number) => `${normalizeName(name)}|${lon}|${lat}`;
    const output: SearchHit[] = [];
    for (const item of results) {
      const k = key(item.name, item.lon, item.lat); if (seen.has(k)) continue; seen.add(k); output.push(item);
    }
    for (const item of remote) {
      const k = key(item.label, item.lon, item.lat); if (seen.has(k)) continue; seen.add(k);
      output.push({ ...item, name: item.label, category: 'endereço' });
    }
    return output;
  }, [remote, results]);
  const remoteCredits = useMemo(() => {
    const values = remote.flatMap((item) => [item.attribution, item.source]).filter((value): value is string => Boolean(value));
    const unique = [...new Set(values)];
    return { text: unique.join(' · ') || 'Provedor autorizado', osm: /photon|openstreetmap|osm/i.test(unique.join(' ')) };
  }, [remote]);

  return <MapOfflinePanel open={open} onClose={onClose} title="Buscar locais neste mapa" icon="search">
    <div className="space-y-2 text-sm">
      <form onSubmit={(event) => { event.preventDefault(); submitSearch(); }} className="space-y-2">
        <input type="search" value={query} onChange={(event) => { invalidateRemote(); invalidateLocal(); setQuery(event.target.value); setResults([]); setLocalBusy(false); setLocalNotice(''); setError(''); }}
          className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm" placeholder="Rua, endereço, CEP, cidade ou lugar" aria-label="Pesquisar feições offline" />
        <button type="submit" disabled={remoteBusy || !query.trim()} className="min-h-[44px] w-full rounded-lg border border-primary/40 px-3 font-semibold text-on-surface disabled:opacity-50">
          {localBusy || remoteBusy ? 'Pesquisando…' : 'Pesquisar'}
        </button>
      </form>
      <p className="text-xs text-on-surface-variant">Pesquise nomes de ruas, CEPs e lugares no mapa exibido ou nos dados adicionados ao projeto.</p>
      <p className="text-xs text-on-surface-variant">Dados do mapa: {records.length} locais ({displayedMapCount} no mapa exibido, {regionalCount} do índice regional).</p>
      <p className="text-xs text-on-surface-variant">Consultas salvas também podem ser pesquisadas sem internet. A busca online envia somente o texto pesquisado.</p>
      {(error || warning) && <p role="alert" className="text-xs text-red-500">{error || warning}</p>}
      {localNotice && combined.length === 0 && <p role="status" className="text-xs text-on-surface-variant">{localNotice}</p>}
      {remoteNotice && combined.length === 0 && <p role="status" className="text-xs text-on-surface-variant">{remoteNotice}</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {combined.map((result) => <li key={`${result.id}:${result.lon}:${result.lat}`}><button type="button" className="min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/10" onClick={() => { onChoose(result); onClose(); }}>{result.name}</button></li>)}
      </ul>
      <p className="text-xs text-on-surface-variant">
        {remote.length > 0 && <>Dados de endereço: {remoteCredits.text}{remoteCredits.osm && <> · <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></>}<br /></>}
        Código de mapa adaptado do <a className="underline" href="https://organicmaps.app" target="_blank" rel="noreferrer">Organic Maps Project</a> (Apache-2.0).
      </p>
      <p className="text-xs text-on-surface-variant">Mapas locais: dados e atribuições de cada pacote instalado.</p>
    </div>
  </MapOfflinePanel>;
}
