import { useEffect, useRef, useState } from 'react';
import type { LocalSearchRecord } from '../../lib/search/local-map-search';

interface SearchHit {id: string; name: string; lon: number; lat: number; category: string;}

export function OfflineSearch({ records, regionalCount = 0, warning, onChoose }: {
  records: LocalSearchRecord[];
  regionalCount?: number;
  warning?: string | null;
  onChoose: (place: SearchHit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
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
    const id = ++requestId.current;
    if (!open || !query.trim()) { setResults([]); return; }
    const timeout = setTimeout(() => worker.current?.postMessage({type:'search', requestId:id, query}), 160);
    return () => clearTimeout(timeout);
  }, [open, query, records]);

  return (
    <section className="absolute right-3 top-20 z-20 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-outline-variant bg-surface-container/95 p-2 text-on-surface shadow-lg backdrop-blur">
      <button type="button" className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-primary/10"
        onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Buscar locais neste mapa">
        Buscar locais neste mapa {open ? '−' : '+'}
      </button>
      {open && <div className="space-y-2 p-2">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm"
          placeholder="Rua, lugar ou feição local" aria-label="Pesquisar feições offline" />
        <p className="text-xs text-on-surface-variant">{records.length} locais disponíveis sem internet ({regionalCount} do mapa regional)</p>
        {(error || warning) && <p role="alert" className="text-xs text-red-500">{error || warning}</p>}
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {results.map((result) => <li key={result.id}>
            <button type="button" className="min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary/10"
              onClick={() => {onChoose(result); setOpen(false);}}>
              {result.name}
            </button>
          </li>)}
        </ul>
      </div>}
    </section>
  );
}
