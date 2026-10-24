import { useEffect, useState } from 'react';

type TelemetryState = {
  online: boolean;
  viewport: string;
  deviceMemory?: number;
  gps: PermissionState | 'unavailable';
};

export default function TelemetryPage() {
  const [state, setState] = useState<TelemetryState>(() => ({
    online: navigator.onLine,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    gps: 'unavailable',
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  }));

  useEffect(() => {
    const update = () => setState((current) => ({ ...current, online: navigator.onLine, viewport: `${window.innerWidth} × ${window.innerHeight}` }));
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('resize', update);
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
        setState((current) => ({ ...current, gps: permission.state }));
      }).catch(() => undefined);
    }
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <section className="min-h-full min-w-0 overflow-y-auto bg-background p-4 text-on-surface md:p-6" aria-labelledby="telemetry-title">
      <h1 id="telemetry-title" className="text-2xl font-bold text-cyan-400">Telemetria do dispositivo</h1>
      <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">Informações locais para diagnóstico. Nenhuma localização é enviada automaticamente.</p>
      <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><dt className="text-xs text-on-surface-variant">Rede</dt><dd className="mt-2 font-semibold">{state.online ? 'Online' : 'Offline'}</dd></div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><dt className="text-xs text-on-surface-variant">Viewport</dt><dd className="mt-2 font-semibold">{state.viewport}</dd></div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><dt className="text-xs text-on-surface-variant">Permissão GPS</dt><dd className="mt-2 font-semibold">{state.gps}</dd></div>
        <div className="rounded-xl border border-outline-variant bg-surface-container p-4"><dt className="text-xs text-on-surface-variant">Memória reportada</dt><dd className="mt-2 font-semibold">{state.deviceMemory ? `${state.deviceMemory} GiB` : 'Indisponível'}</dd></div>
      </div>
    </section>
  );
}
