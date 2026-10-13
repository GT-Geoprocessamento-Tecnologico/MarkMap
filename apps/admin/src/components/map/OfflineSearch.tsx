import { useEffect, useRef, useState } from 'react';
import type { LocalSearchRecord } from '../../lib/search/local-map-search';
import { MapOfflinePanel } from './MapOfflinePanel';
import { configuredAddressSearchEndpoint, searchAddressOnline, type AddressResult } from '../../lib/search/address-geocoder';

interface SearchHit {id: string; name: string; lon: number; lat: number; category: string;}

export function OfflineSearch({ open, onClose, records, regionalCount = 0, warning, onChoose }: {
  open: boolean;
  onClose: () => void;
  records: LocalSearchRecord[];
  regionalCount?: number;
  warning?: string | null;
  onChoose: (place: SearchHit) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const remoteController = useRef<AbortController | null>(null);
  const [remote, setRemote] = useState<AddressResult[]>([]);
  const [remoteBusy, setRemoteBusy] = useState(false);
  const [remoteNotice, setRemoteNotice] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    try {
      const instance = new Worker(new URL('../../workers/map-search.worker.ts', import.meta.url), {type:'module'});
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<{requestId: number; results: SearchHit[]; error?: string}>) => {
        if (!active || event.data.requestId !== requestId.current) return;
        setResults(event.data.results);
        setError(event.data.error ?? '');
      };
      instance.onerror = () => { if (active) setError('A busca local não está disponível neste navegador.'); };
    } catch { setError('A busca local não está disponível neste navegador.'); }
    return () => { active = false; worker.current?.terminate(); worker.current = null; };
  }, []);

  useEffect(() => { worker.current?.postMessage({type:'load', records}); }, [records]);
  useEffect(() => {
    if (open) return;
    remoteController.current?.abort();
  }, [open]);
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
      if (remoteController.current === controller) remoteController.current = null;
      setRemoteBusy(false);
    }
  };
  useEffect(() => {
    const id = ++requestId.current;
    if (!open || !query.trim()) { setResults([]); return; }
    const timeout = setTimeout(() => worker.current?.postMessage({type:'search', requestId:id, query}), 160);
    return () => clearTimeout(timeout);
  }, [open, query, records]);

  return (
    <MapOfflinePanel open={open} onClose={onClose} title="Buscar locais neste mapa" icon="search">
      <div className="space-y-2 text-sm">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm"
          placeholder="Rua, endereço, cidade ou lugar" aria-label="Pesquisar feições offline" />
        <p className="text-xs text-on-surface-variant">Digite o endereço e use a busca offline abaixo. Para endereços fora do mapa baixado, consulte online.</p>
        <p className="text-xs text-on-surface-variant">{records.length} locais disponíveis sem internet ({regionalCount} do mapa regional)</p>
        {(error || warning) && <p role="alert" className="text-xs text-red-500">{error || warning}</p>}
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
              ? "A busca online envia somente o texto digitado ao provedor autorizado pelo MarkMap."
              : "Busca offline disponível. Pesquisa online exige um provedor autorizado configurado."}
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
