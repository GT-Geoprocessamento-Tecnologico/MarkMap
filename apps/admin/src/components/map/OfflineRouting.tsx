import { useCallback, useEffect, useRef, useState } from 'react';
import type { Route, RoutingProfile } from '@geonexo/contracts';
import { generateTtsText, getDistanceText } from '@geonexo/maps/routing';
import { ensureLocationPermission } from '../../lib/device-location-permission';
import {
  GPS_MAX_ACCURACY_M, GPS_MAX_AGE_MS,
  type ForegroundGpsFix, type OfflineNavigationProgress,
} from '@geonexo/maps/routing/navigation-progress';

type Point = [number, number];
type NavigationStatus = 'idle' | 'starting' | 'tracking' | 'paused' | 'arrived' | 'error';
export type RoutePointSelection = { kind: 'origin' | 'destination'; location: Point };
export interface NavigationMapPosition { lon: number; lat: number; accuracyM: number }
const formatPoint = (point: Point | null) => point ? `${point[1].toFixed(5)}, ${point[0].toFixed(5)}` : 'Nao definido';
const REROUTE_DELAY_MS = 30_000;
const OFF_ROUTE_FIXES = 3;

type WorkerMessage =
  | { type: 'ready'; profiles: RoutingProfile[]; reason?: string }
  | { type: 'result'; requestId: number; reroute: boolean; route: Route | null; error?: string }
  | { type: 'progress'; sampleId: number; routeId: number; progress: OfflineNavigationProgress | null };

/** No remote TTS fallback: the selected voice must be supplied by the device. */
function localPortugueseVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return null;
  const voices = speechSynthesis.getVoices().filter((voice) => voice.localService && /^pt(?:-|$)/i.test(voice.lang));
  return voices.find((voice) => voice.lang.toLowerCase() === 'pt-br') ?? voices[0] ?? null;
}

function speakLocally(text: string): boolean {
  const voice = localPortugueseVoice();
  if (!voice) return false;
  try {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.rate = 0.95;
    speechSynthesis.speak(utterance);
    return true;
  } catch { return false; }
}

export function OfflineRouting({ packageId, pickedPoint, onRequestPick, onRoute, onPosition, onTrackingChange }: {
  packageId: string | null;
  pickedPoint: RoutePointSelection | null;
  onRequestPick: (kind: RoutePointSelection['kind']) => void;
  onRoute: (route: Route | null) => void;
  onPosition?: (position: NavigationMapPosition | null, follow: boolean) => void;
  onTrackingChange?: (tracking: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [profiles, setProfiles] = useState<RoutingProfile[]>([]);
  const [profile, setProfile] = useState<RoutingProfile>('walk');
  const [origin, setOrigin] = useState<Point | null>(null);
  const [destination, setDestination] = useState<Point | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [message, setMessage] = useState('Abra um mapa com rotas offline.');
  const [busy, setBusy] = useState(false);
  const [navStatus, setNavStatus] = useState<NavigationStatus>('idle');
  const [progress, setProgress] = useState<OfflineNavigationProgress | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [follow, setFollow] = useState(true);
  const worker = useRef<Worker | null>(null);
  const seq = useRef(0);
  const routeId = useRef(0);
  const routeRef = useRef<Route | null>(null);
  const watchId = useRef<number | null>(null);
  const requestingLocation = useRef(false);
  const navigationActive = useRef(false);
  const lastSample = useRef(0);
  const lastProcessedSample = useRef(0);
  const latestFix = useRef<ForegroundGpsFix | null>(null);
  const offRouteFixes = useRef(0);
  const lastRerouteAt = useRef(0);
  const rerouting = useRef(false);
  const spokenStep = useRef<number | null>(null);
  const voiceRef = useRef(false);
  const followRef = useRef(follow);
  followRef.current = follow;
  const destinationRef = useRef(destination);
  const profileRef = useRef(profile);
  const profilesRef = useRef(profiles);
  destinationRef.current = destination;
  profileRef.current = profile;
  profilesRef.current = profiles;
  const onRouteRef = useRef(onRoute);
  const onPositionRef = useRef(onPosition);
  const onTrackingRef = useRef(onTrackingChange);
  onRouteRef.current = onRoute;
  onPositionRef.current = onPosition;
  onTrackingRef.current = onTrackingChange;

  const stopNavigation = useCallback((status: NavigationStatus = 'paused', updateUI = true) => {
    navigationActive.current = false;
    const id = watchId.current;
    watchId.current = null;
    if (id !== null && typeof navigator !== 'undefined' && navigator.geolocation)
      navigator.geolocation.clearWatch(id);
    offRouteFixes.current = 0;
    rerouting.current = false;
    lastSample.current += 1; // Invalidate older progress results.
    onPositionRef.current?.(null, false);
    onTrackingRef.current?.(false);
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    if (updateUI) { setNavStatus(status); setProgress(null); setBusy(false); }
  }, []);

  useEffect(() => {
    setRoute(null);
    routeRef.current = null;
    routeId.current = 0;
    onRouteRef.current(null);
    setProfiles([]);
    stopNavigation('idle');
    if (!packageId) { setMessage('Instale e selecione uma regiao com rotas offline.'); return; }
    let active = true;
    try {
      const current = new Worker(new URL('../../workers/offline-route.worker.ts', import.meta.url), { type: 'module' });
      worker.current = current;
      setMessage('Lendo grafo local...');
      current.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (!active) return;
        const data = event.data;
        if (data.type === 'ready') {
          setProfiles(data.profiles);
          setProfile((existing) => data.profiles.includes(existing) ? existing : (data.profiles[0] ?? 'walk'));
          setMessage(data.reason ?? 'Pronto para calcular rotas sem internet.');
        } else if (data.type === 'result') {
          if (data.requestId !== seq.current) return;
          setBusy(false);
          if (data.reroute) {
            rerouting.current = false;
            if (!data.route) {
              setMessage(data.error ?? 'Recálculo sem rota. Pare em local seguro e reveja o mapa.');
              return; // Keep the prior route and its progress matcher.
            }
            offRouteFixes.current = 0;
            spokenStep.current = null;
            setProgress(null);
            setMessage('Rota recalculada neste dispositivo.');
          } else {
            setMessage(data.error ?? 'Rota calculada no dispositivo.');
          }
          routeRef.current = data.route;
          routeId.current = data.route ? data.requestId : 0;
          setRoute(data.route);
          onRouteRef.current(data.route);
          if (data.route && navigationActive.current && latestFix.current)
            current.postMessage({ type: 'progress', routeId: routeId.current,
              sampleId: ++lastSample.current, fix: latestFix.current });
        } else if (data.type === 'progress' && navigationActive.current &&
                   data.routeId === routeId.current && data.sampleId > lastProcessedSample.current) {
          lastProcessedSample.current = data.sampleId;
          const result = data.progress;
          if (!result) { setMessage('Aguardando sinal GPS recente e preciso.'); return; }
          setProgress(result);
          setNavStatus('tracking');
          if (result.arrived) {
            const speakArrival = voiceRef.current;
            stopNavigation('arrived');
            setMessage('Voce chegou ao destino.');
            if (speakArrival) speakLocally('Voce chegou ao destino.');
            return;
          }
          if (result.offRoute) {
            offRouteFixes.current += 1;
            setMessage('Fora do trajeto planejado. Verificando alternativa local...');
            if (offRouteFixes.current >= OFF_ROUTE_FIXES && !rerouting.current &&
                Date.now() - lastRerouteAt.current >= REROUTE_DELAY_MS &&
                destinationRef.current && profilesRef.current.includes(profileRef.current)) {
              rerouting.current = true;
              lastRerouteAt.current = Date.now();
              const requestId = ++seq.current;
              setBusy(true);
              current.postMessage({ type: 'route', requestId, origin: result.position,
                destination: destinationRef.current, profile: profileRef.current, reroute: true });
            }
            return;
          }
          offRouteFixes.current = 0;
          setMessage('GPS em primeiro plano; calculo e orientacao sem rede.');
          if (voiceRef.current && result.nextStepDistanceM <= 70 &&
              result.nextStepIndex !== spokenStep.current) {
            const step = routeRef.current?.steps[result.nextStepIndex];
            if (step) {
              spokenStep.current = result.nextStepIndex;
              const text = `Em ${getDistanceText(Math.round(result.nextStepDistanceM), 'pt-BR')}, ${generateTtsText(step, 'pt-BR')}`;
              if (!speakLocally(text)) { voiceRef.current = false; setVoiceEnabled(false); }
            }
          }
        }
      };
      current.onerror = () => {
        if (active) {
          stopNavigation('error');
          setProfiles([]);
          setMessage('Worker local de rotas indisponivel neste dispositivo.');
          setBusy(false);
        }
      };
      current.postMessage({ type: 'load', packageId });
      return () => { active = false; stopNavigation('idle', false); current.terminate(); worker.current = null; };
    } catch {
      setMessage('Worker local de rotas indisponivel neste dispositivo.');
    }
  }, [packageId, stopNavigation]);

  useEffect(() => {
    if (!pickedPoint) return;
    if (pickedPoint.kind === 'origin') setOrigin(pickedPoint.location);
    else setDestination(pickedPoint.location);
  }, [pickedPoint]);

  useEffect(() => {
    stopNavigation('idle');
    const requestId = ++seq.current;
    routeId.current = 0;
    routeRef.current = null;
    setRoute(null);
    setProgress(null);
    onRouteRef.current(null);
    if (!origin || !destination || !profiles.includes(profile) || !worker.current) { setBusy(false); return; }
    setBusy(true);
    worker.current.postMessage({ type: 'route', requestId, origin, destination, profile });
  }, [origin, destination, profile, profiles, packageId, stopNavigation]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && navigationActive.current) {
        stopNavigation('paused');
        setMessage('GPS pausado porque o aplicativo saiu do primeiro plano. Toque para retomar.');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [stopNavigation]);

  const locate = async () => {
    if (!navigator.geolocation) { setMessage('GPS nao disponivel neste navegador.'); return; }
    const permission = await ensureLocationPermission();
    if (permission.state !== 'granted') { setMessage('Permissao de localizacao nao concedida.'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (Number.isFinite(position.coords.longitude) && Number.isFinite(position.coords.latitude))
          setOrigin([position.coords.longitude, position.coords.latitude]);
      },
      () => setMessage('Permissao negada ou posicao GPS indisponivel.'),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    );
  };

  const startNavigation = async () => {
    if (!routeRef.current || routeRef.current.geometry.length < 2 || !routeId.current || !worker.current || !navigator.geolocation) {
      setMessage('Selecione uma rota regional antes de iniciar o GPS.');
      return;
    }
    if (document.visibilityState !== 'visible') {
      setMessage('Abra o aplicativo em primeiro plano para iniciar o GPS.');
      return;
    }
    if (navigationActive.current || requestingLocation.current) return;
    requestingLocation.current = true;
    setNavStatus('starting');
    setMessage('Verificando permissao de localizacao...');
    const permission = await ensureLocationPermission().finally(() => { requestingLocation.current = false; });
    if (permission.state !== 'granted') {
      setNavStatus('error');
      setMessage('Permissao de localizacao nao concedida.');
      return;
    }
    if (navigationActive.current) return;
    if (document.visibilityState !== 'visible') {
      setNavStatus('paused');
      setMessage('Abra o aplicativo em primeiro plano para ativar o GPS.');
      return;
    }
    if (!routeRef.current || !worker.current) { setNavStatus('idle'); return; }
    navigationActive.current = true;
    setMessage('Aguardando autorizacao e primeira posicao GPS...');
    onTrackingRef.current?.(true);
    lastProcessedSample.current = lastSample.current;
    offRouteFixes.current = 0;
    lastRerouteAt.current = 0;
    spokenStep.current = null;
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          if (!navigationActive.current) return;
          const fix: ForegroundGpsFix = {
            lon: position.coords.longitude, lat: position.coords.latitude,
            accuracyM: position.coords.accuracy, timestampMs: position.timestamp,
          };
          if (!Number.isFinite(fix.lon) || !Number.isFinite(fix.lat) ||
              !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 ||
              fix.accuracyM > GPS_MAX_ACCURACY_M ||
              Date.now() - fix.timestampMs > GPS_MAX_AGE_MS || fix.timestampMs - Date.now() > 5_000) {
            setMessage('Aguardando uma posicao GPS mais precisa.');
            return;
          }
          latestFix.current = fix;
          onPositionRef.current?.({ lon: fix.lon, lat: fix.lat, accuracyM: fix.accuracyM }, followRef.current);
          worker.current?.postMessage({ type: 'progress', sampleId: ++lastSample.current,
            routeId: routeId.current, fix });
        },
        (error) => {
          if (!navigationActive.current) return;
          if (error.code === 1) {
            stopNavigation('error');
            setMessage('Permissao GPS negada. Autorize o acesso nas configuracoes do navegador.');
          } else {
            setMessage('Sinal GPS temporariamente indisponivel; aguardando nova posicao.');
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
      );
    } catch {
      stopNavigation('error');
      setMessage('Nao foi possivel iniciar o acompanhamento GPS.');
    }
  };

  const speakPreview = () => {
    const first = routeRef.current?.steps[0];
    if (!first || !speakLocally(generateTtsText(first, 'pt-BR')))
      setMessage('Voz pt-BR local nao disponivel; o GPS continua funcionando sem audio.');
  };
  const toggleVoice = () => {
    if (voiceRef.current) {
      voiceRef.current = false;
      setVoiceEnabled(false);
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      return;
    }
    if (!localPortugueseVoice()) {
      setMessage('Instale uma voz pt-BR local no dispositivo para ter orientacao sem internet.');
      return;
    }
    voiceRef.current = true;
    spokenStep.current = null;
    setVoiceEnabled(true);
    setMessage('Voz pt-BR local habilitada para a navegacao em primeiro plano.');
  };

  return (
    <section className="absolute bottom-32 right-3 z-20 w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border border-outline-variant bg-surface-container/95 p-2 text-on-surface shadow-lg backdrop-blur" aria-label="Roteamento offline">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}
        className="min-h-[44px] w-full rounded-lg px-3 text-left text-sm font-semibold hover:bg-primary/10">
        Navegacao GPS offline {expanded ? '-' : '+'}
      </button>
      {expanded && <div className="max-h-[60vh] space-y-2 overflow-y-auto p-2 text-sm">
        <p className="text-xs text-on-surface-variant" role="status" aria-live="polite">{message}</p>
        <label className="block text-xs font-semibold">Modo de viagem
          <select className="mt-1 min-h-[40px] w-full rounded-lg border bg-background px-2" value={profile}
            onChange={(e) => setProfile(e.target.value as RoutingProfile)} disabled={!profiles.length || navigationActive.current}>
            {profiles.length ? profiles.map((p) => <option key={p} value={p}>{p === 'walk' ? 'A pe' : p === 'bicycle' ? 'Bicicleta' : 'Carro'}</option>) : <option value="walk">Sem grafo instalado</option>}
          </select>
        </label>
        <p className="text-xs">Origem: {formatPoint(origin)}</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={locate} className="min-h-[40px] rounded-lg border px-3" disabled={navigationActive.current}>Usar GPS</button>
          <button type="button" onClick={() => onRequestPick('origin')} className="min-h-[40px] rounded-lg border px-3" disabled={navigationActive.current}>Origem no mapa</button></div>
        <p className="text-xs">Destino: {formatPoint(destination)}</p>
        <button type="button" onClick={() => onRequestPick('destination')} className="min-h-[40px] rounded-lg border px-3" disabled={navigationActive.current}>Destino no mapa</button>
        {busy && <p role="status" className="text-xs">{rerouting.current ? 'Recalculando localmente...' : 'Calculando rota no dispositivo...'}</p>}
        {route && <div className="rounded-lg bg-primary/10 p-2 space-y-2">
          <p className="font-semibold">{(route.distance / 1000).toFixed(2)} km - {Math.ceil(route.duration / 60)} min (planejado)</p>
          {progress && navStatus === 'tracking' && <>
            <p className="text-xs">Restante aproximado: {(progress.remainingM / 1000).toFixed(2)} km - {Math.ceil(progress.remainingSeconds / 60)} min</p>
            <p className="text-xs">{progress.offRoute ? 'Fora do trajeto' : 'No trajeto'} - precisao GPS {Math.round(progress.accuracyM)} m</p>
            {!progress.offRoute && <p className="text-xs">Proxima manobra em {getDistanceText(progress.nextStepDistanceM, 'pt-BR')}</p>}
          </>}
          {navStatus === 'arrived' && <p className="font-semibold">Chegou ao destino.</p>}
          {!navigationActive.current && <button type="button" onClick={startNavigation} className="min-h-[44px] rounded-lg bg-primary px-3 text-on-primary">
            {navStatus === 'paused' ? 'Retomar GPS' : 'Iniciar navegacao GPS'}
          </button>}
          {navigationActive.current && <button type="button" onClick={() => stopNavigation('paused')} className="min-h-[44px] rounded-lg border px-3">Parar GPS</button>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={toggleVoice} aria-pressed={voiceEnabled} className="min-h-[40px] rounded-lg border px-3">{voiceEnabled ? 'Desligar voz local' : 'Ativar voz local'}</button>
            <button type="button" onClick={speakPreview} className="min-h-[40px] rounded-lg border px-3">Ouvir inicio</button>
            <button type="button" onClick={() => setFollow((v) => !v)} aria-pressed={follow} className="min-h-[40px] rounded-lg border px-3">{follow ? 'Mapa acompanha GPS' : 'Mapa livre'}</button>
          </div>
          <p className="text-xs text-on-surface-variant">GPS somente em primeiro plano, sem gravar trajetos ou enviar coordenadas. Orientacao aproximada; confira a sinalizacao real.</p>
        </div>}
        <button type="button" className="min-h-[40px] rounded-lg border px-3" onClick={() => {
          stopNavigation('idle');
          setOrigin(null); setDestination(null); setRoute(null); setProgress(null);
          routeRef.current = null; routeId.current = 0; onRouteRef.current(null);
        }}>Limpar rota</button>
      </div>}
    </section>
  );
}
