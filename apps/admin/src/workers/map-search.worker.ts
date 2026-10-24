import { searchIndex, type SearchRecord } from '@markmap/maps/search';
import type { LocalSearchRecord } from '../lib/search/local-map-search';

type Incoming = {type: 'load'; records: LocalSearchRecord[]} |
  {type: 'search'; requestId: number; query: string};
const workerScope = self as unknown as {postMessage(message: unknown): void};
let records: SearchRecord[] = [];
self.addEventListener('message', (event: MessageEvent<Incoming>) => {
  const data = event.data;
  if (data.type === 'load') {
    records = Array.isArray(data.records) ? data.records.slice(0, 35_000) : [];
  } else if (data.type === 'search') {
    try {
      const response = searchIndex(records, { query: data.query, limit: 12 });
      workerScope.postMessage({ requestId: data.requestId, results: response.results });
    } catch {
      workerScope.postMessage({ requestId: data.requestId, results: [], error: 'Pesquisa local indisponível' });
    }
  }
});
