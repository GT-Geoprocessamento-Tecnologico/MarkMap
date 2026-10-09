import { useEffect, useRef, useState } from 'react';
import type { Route, RoutingProfile } from '@geonexo/contracts';
import { generateTtsText } from '@geonexo/maps/routing';

type Point = [number, number];
export type RoutePointSelection = { kind: 'origin' | 'destination'; location: Point };
const formatPoint = (point: Point | null) => point ? `${point[1].toFixed(5)}, ${point[0].toFixed(5)}` : 'Não definido';

export function OfflineRouting({ packageId, pickedPoint, onRequestPick, onRoute }: {
  packageId: string | null;
  pickedPoint: RoutePointSelection | null;
  onRequestPick: (kind: RoutePointSelection['kind']) => void;
  onRoute: (route: Route | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [profiles, setProfiles] = useState<RoutingProfile[]>([]);
  const [profile, setProfile] = useState<RoutingProfile>('walk');
  const [origin, setOrigin] = useState<Point | null>(null);
  const [destination, setDestination] = useState<Point | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [message, setMessage] = useState('Abra um mapa com rotas offline.');
  const [busy, setBusy] = useState(false);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  useEffect(() => {
    setRoute(null);
    onRouteRef.current(null);
    setProfiles([]);
    if (!packageId) { setMessage('Instale e selecione uma região com rotas offline.'); return; }
    let active = true;
    try {
      const current = new Worker(new URL('../../workers/offline-route.worker.ts', import.meta.url), { type: 'module' });
      worker.current = current;
      setMessage('Lendo grafo local…');
      current.onmessage = (event: MessageEvent<
        { type: 'ready'; profiles: RoutingProfile[]; reason?: string } |
        { type: 'result'; requestId: number; route: Route | null; error?: string }
      >) => {
        if (!active) return;
        const data = event.data;
        if (data.type === 'ready') {
          setProfiles(data.profiles);
          setProfile((existing) => data.profiles.includes(existing) ? existing : (data.profiles[0] ?? 'walk'));
          setMessage(data.reason ?? 'Pronto para calcular rotas sem internet.');
        } else if (data.requestId === seq.current) {
          setBusy(false);
          setRoute(data.route);
          onRouteRef.current(data.route);
          setMessage(data.error ?? 'Rota calculada no dispositivo.');
        }
      };
      current.onerror = () => { if (active) { setProfiles([]); setMessage('Worker de rotas indisponível neste dispositivo.'); setBusy(false); } };
      current.postMessage({ type: 'load', packageId });
      return () => { active = false; current.terminate(); worker.current = null; };
    } catch {
      setMessage('Worker de rotas indisponível neste dispositivo.');
    }
  }, [packageId]);

  useEffect(() => {
    if (!pickedPoint) return;
    if (pickedPoint.kind === 'origin') setOrigin(pickedPoint.location);
    else setDestination(pickedPoint.location);
  }, [pickedPoint]);

  useEffect(() => {
    const requestId = ++seq.current;
    setRoute(null);
    onRouteRef.current(null);
    if (!origin || !destination || !profiles.includes(profile) || !worker.current) { setBusy(false); return; }
    setBusy(true);
    worker.current.postMessage({ type: 'route', requestId, origin, destination, profile });
  }, [origin, destination, profile, profiles]);

  const locate = () => {
    if (!navigator.geolocation) { setMessage('GPS não disponível neste navegador.'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => setOrigin([position.coords.longitude, position.coords.latitude]),
      () => setMessage('Sem permissão ou posição GPS indisponível.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  };
  const speakPreview = () => {
    // Only user-initiated speech. Availability of an offline voice varies by device.
    if (!route?.steps.length || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
      setMessage('Voz não disponível neste dispositivo; o cálculo da rota segue offline.');
      return;
    }
    const text = generateTtsText(route.steps[0]!, 'pt-BR');
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    speechSynthesis.speak(utterance);
  };
  return (
    <section className="absolute bottom-32 right-3 z-20 w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border border-outline-variant bg-surface-container/95 p-2 text-on-surface shadow-lg backdrop-blur" aria-label="Roteamento offline">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}
        className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-primary/10">
        Traçar rota offline {expanded ? '−' : '+'}
      </button>
      {expanded && <div className="max-h-[60vh] space-y-2 overflow-y-auto p-2 text-sm">
        <p className="text-xs text-on-surface-variant" role="status">{message}</p>
        <label className="block text-xs font-semibold">Modo de viagem
          <select className="mt-1 min-h-[40px] w-full rounded-lg border bg-background px-2" value={profile}
            onChange={(e) => setProfile(e.target.value as RoutingProfile)} disabled={!profiles.length}>
            {profiles.length ? profiles.map((p) => <option key={p} value={p}>{p === 'walk' ? 'A pé' : p === 'bicycle' ? 'Bicicleta' : 'Carro'}</option>) : <option value="walk">Sem grafo instalado</option>}
          </select>
        </label>
        <p className="text-xs">Origem: {formatPoint(origin)}</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={locate} className="min-h-[40px] rounded-lg border px-3">Usar GPS</button>
          <button type="button" onClick={() => onRequestPick('origin')} className="min-h-[40px] rounded-lg border px-3">Origem no mapa</button></div>
        <p className="text-xs">Destino: {formatPoint(destination)}</p>
        <button type="button" onClick={() => onRequestPick('destination')} className="min-h-[40px] rounded-lg border px-3">Destino no mapa</button>
        {busy && <p role="status" className="text-xs">Calculando rota no dispositivo…</p>}
        {route && <div className="rounded-lg bg-primary/10 p-2">
          <p className="font-semibold">{(route.distance / 1000).toFixed(2)} km · {Math.ceil(route.duration / 60)} min</p>
          <p className="text-xs">Rota aproximada pelos nós do grafo, sem navegação GPS contínua.</p>
          <button type="button" onClick={speakPreview} className="mt-2 min-h-[40px] rounded-lg border px-3">Ouvir primeira instrução</button>
        </div>}
        <button type="button" className="min-h-[40px] rounded-lg border px-3" onClick={() => { setOrigin(null); setDestination(null); setRoute(null); onRouteRef.current(null); }}>Limpar rota</button>
      </div>}
    </section>
  );
}
