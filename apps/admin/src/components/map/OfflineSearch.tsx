import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocalSearchRecord } from '../../lib/search/local-map-search';
import { searchIndex } from '@geonexo/maps/search';
import { MapOfflinePanel } from './MapOfflinePanel';
import { configuredAddressSearchEndpoint, searchAddressOnline, type AddressResult } from '../../lib/search/address-geocoder';

interface SearchHit {id: string; name: string; lon: number; lat: number; category: string;}

export function OfflineSearch({ open, onClose, records, regionalCount = 0, mapRecordCount, warning, onChoose }: {
  open: boolean;
  onClose: () => void;
  records: LocalSearchRecord[];
  regionalCount?: number;
  mapRecordCount?: number;
  warning?: string | null;
  onChoose: (place: SearchHit) => void;
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
  const [remote, setRemote] = useState<AddressResult[]>([]);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteNotice, setRemoteNotice] = useState('');
  const requestId = useRef(0);
  queryRef.current = query;
  localBusyRef.current = localBusy;

  const fallbackLocal = useCallback((id: number, term: string) => {
    if (id !== requestId.current) return;
    try {
      const response = searchIndex(recordsRef.current, { query: term, limit: 12 });
      setResults(response.results);
      setLocalBusy(false);
      if (!response.results.length) setLocalNotice('Nenhum local encontrado nos dados disponíveis offline.');
    } catch {
      setLocalBusy(false);
      setLocalNotice('A busca local não está disponível neste navegador.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const instance = new Worker(new URL('../../workers/map-search.worker.ts', import.meta.url), {type:'module'});
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<{requestId: number; results: SearchHit[]; error?: string}>) => {
        if (!active || event.data.requestId !== requestId.current) return;
        setResults(event.data.results);
        setError(event.data.error ?? '');
        setLocalBusy(false);
        if (event.data.error) setLocalNotice('A busca local encontrou um problema. Tente novamente.');
        else if (!event.data.results.length) setLocalNotice('Nenhum local encontrado nos dados disponíveis offline.');
      };
      instance.onerror = () => {
        if (!active) return;
        workerFailed.current = true;
        setError('');
        if (localBusyRef.current && queryRef.current.trim()) fallbackLocal(requestId.current, queryRef.current.trim());
        else setLocalNotice('A busca local não está disponível neste navegador.');
      };
    } catch { workerFailed.current = true; }
    return () => { active = false; worker.current?.terminate(); worker.current = null; };
  }, [fallbackLocal]);

  useEffect(() => {
    recordsRef.current = records;
    try { worker.current?.postMessage({type:'load', records}); }
    catch { workerFailed.current = true; }
  }, [records]);
  useEffect(() => {
    if (open) return;
    remoteController.current?.abort();
  }, [open]);
  useEffect(() => {
    remoteController.current?.abort();
    remoteController.current = null;
    setRemoteBusy(false);
    setRemote([]);
    setRemoteNotice('');
  }, [query]);
  const findOnline = async () => {
    if (remoteBusy) return;
    const controller = new AbortController();
    remoteController.current?.abort();
    remoteController.current = controller;
    setRemoteBusy(true);
    setRemoteNotice('');
    setRemote([]);
    try {
      const places = await searchAddressOnline(query, controller.signal);
      if (!controller.signal.aborted) {
        setRemote(places);
        if (!places.length) setRemoteNotice('Endereço não encontrado. Tente incluir cidade e estado.');
      }
    } catch (cause) {
      if (!controller.signal.aborted)
        setRemoteNotice(cause instanceof Error ? cause.message : 'Busca online indisponível.');
    } finally {
      if (remoteController.current === controller) {
        remoteController.current = null;
        setRemoteBusy(false);
      }
    }
  };
  const searchLocal = useCallback(() => {
    const term = query.trim();
    const id = ++requestId.current;
    setError('');
    setLocalNotice('');
    setResults([]);
    setLocalBusy(false);
    if (!term) {
      setLocalNotice('Digite um nome, rua ou endereço para pesquisar.');
      return;
    }
    if (!recordsRef.current.length) {
      setLocalNotice(regionalCount > 0
        ? 'Este mapa regional não possui índice de busca offline.'
        : 'Não há nomes disponíveis na área exibida. Aproxime ou mova o mapa para carregar mais ruas.');
      return;
    }
    setLocalBusy(true);
    if (worker.current && !workerFailed.current) {
      try { worker.current.postMessage({type:'search', requestId:id, query:term}); return; }
      catch { workerFailed.current = true; }
    }
    fallbackLocal(id, term);
  }, [fallbackLocal, query, regionalCount]);
  useEffect(() => {
    ++requestId.current;
    if (!open || !query.trim()) {
      setResults([]);
      setLocalBusy(false);
      return;
    }
    const timeout = setTimeout(() => searchLocal(), 160);
    return () => clearTimeout(timeout);
  }, [open, query, records, searchLocal]);

  return (
    <MapOfflinePanel open={open} onClose={onClose} title="Buscar locais neste mapa" icon="search">
      <div className="space-y-2 text-sm">
        <form onSubmit={(event) => { event.preventDefault(); searchLocal(); }} className="space-y-2">
        <input type="search" value={query} onChange={(e) => {
          requestId.current += 1;
          setQuery(e.target.value);
          setResults([]);
          setLocalBusy(false);
          setLocalNotice('');
          setError('');
        }}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); searchLocal(); } }}
          className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm"
          placeholder="Rua, endereço, cidade ou lugar" aria-label="Pesquisar feições offline" />
        <button type="submit" disabled={localBusy || !query.trim()}
          className="min-h-[44px] w-full rounded-lg border border-primary/40 px-3 font-semibold text-on-surface disabled:opacity-50">
          {localBusy ? 'Pesquisando no mapa…' : 'Pesquisar no mapa offline'}
        </button>
        </form>
        <p className="text-xs text-on-surface-variant">Pesquise nomes de ruas e lugares no mapa exibido ou nos dados adicionados ao projeto.</p>
        <p className="text-xs text-on-surface-variant">{records.length} locais disponíveis sem internet ({displayedMapCount} no mapa exibido, {regionalCount} do índice regional)</p>
        <p className="text-xs text-on-surface-variant">Busca nomes na área exibida. Aproxime ou mova o mapa para carregar mais ruas; números de porta podem não existir.</p>
        {(error || warning) && <p role="alert" className="text-xs text-red-500">{error || warning}</p>}
        {localNotice && <p role="status" className="text-xs text-on-surface-variant">{localNotice}</p>}
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {results.map((result) => <li key={result.id}>
            <button type="button" className="min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/10"
              onClick={() => {onChoose(result); onClose();}}>
              {result.name}
            </button>
          </li>)}
        </ul>
        <div className="space-y-2 border-t border-outline-variant pt-3">
          {configuredAddressSearchEndpoint() && <button type="button" disabled={remoteBusy || query.trim().length < 3}
            onClick={() => void findOnline()}
            className="min-h-[44px] w-full rounded-lg border border-primary/40 px-3 font-semibold text-on-surface disabled:opacity-50">
            {remoteBusy ? 'Buscando endereço…' : 'Buscar endereço na internet'}
          </button>}
          <p className="text-xs text-on-surface-variant">
            {configuredAddressSearchEndpoint()
              ? "A busca online envia somente o texto digitado ao serviço autorizado."
              : "Busca online indisponível neste dispositivo. Use os locais já disponíveis no mapa."}
          </p>
          {remoteNotice && <p role="status" className="text-xs text-on-surface-variant">{remoteNotice}</p>}
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {remote.map(place => <li key={place.id}>
              <button type="button"
                onClick={() => { onChoose({ ...place, name: place.label, category: 'endereço' }); onClose(); }}
                className="min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/10">
                {place.label}
              </button>
            </li>)}
          </ul>
          <p className="text-xs text-on-surface-variant">Mapas locais: dados e atribuições de cada pacote instalado.</p>
        </div>
      </div>
    </MapOfflinePanel>
  );
}
