import { useEffect, useState } from 'react';
import { Button, Input, Select, useToast } from '@geonexo/ui';
import { offlineDB } from '../../lib/storage/offline-db';

const STORAGE_KEY = 'geonexo-settings';

interface Settings {
  apiUrl: string;
  srid: string;
  exportFormat: string;
  maxImportSize: string;
}

const DEFAULT_SETTINGS: Settings = {
  apiUrl: 'http://localhost:3000',
  srid: 'EPSG:4674',
  exportFormat: 'GeoJSON',
  maxImportSize: '10',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [apiMode, setApiMode] = useState<'mock' | 'live'>('mock');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [savedSettings, setSavedSettings] = useState<Settings>(settings);
  
  // PWA & Permissions State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    // Captura o evento de instalação do PWA
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Verifica se já está rodando como standalone (instalado)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    // Carrega status da permissão de GPS salva no OfflineDB
    offlineDB.get('permissions', 'gps').then((saved) => {
      if (saved) setGpsPermission(saved.status);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsAppInstalled(true);
        toast({ title: 'Aplicativo instalado!', description: 'O GeoNexo agora está na tela inicial do seu dispositivo.', variant: 'success' });
      }
      setDeferredPrompt(null);
    } else {
      toast({
        title: 'Aplicativo pronto para uso',
        description: 'Você já instalou o app ou pode adicioná-lo à tela inicial pelo menu do seu navegador (Compartilhar -> Adicionar à Tela Inicial).',
        variant: 'default',
      });
    }
  };

  const handleRequestGpsPermission = () => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS indisponível', description: 'Seu dispositivo não suporta geolocalização.', variant: 'error' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsPermission('granted');
        offlineDB.save('permissions', 'gps', { status: 'granted', lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast({
          title: 'Permissão de GPS Concedida!',
          description: `Localização obtida com sucesso: Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`,
          variant: 'success',
        });
      },
      (err) => {
        setGpsPermission('denied');
        offlineDB.save('permissions', 'gps', { status: 'denied', error: err.message });
        toast({
          title: 'Acesso ao GPS recusado',
          description: 'Por favor, libere a localização nas configurações do seu navegador/dispositivo.',
          variant: 'error',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedSettings(settings);
    toast({ title: 'Configurações salvas', description: 'As preferências foram persistidas no motor local do dispositivo.' });
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    setSavedSettings(DEFAULT_SETTINGS);
    toast({ title: 'Configurações restauradas', description: 'Os valores padrão foram aplicados.' });
  };

  return (
    <div className="min-h-space bg-background text-on-surface p-4 md:p-6 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-cyan-400 flex items-center gap-2">
          <span className="material-symbols-outlined">settings</span>
          Configurações do Aplicativo & Dispositivo
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Gerencie permissões nativas, instale o aplicativo localmente e configure parâmetros cartográficos.
        </p>
      </div>

      {/* Instalação do Aplicativo (PWA) */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-500">get_app</span>
              Aplicativo Nativo Dispositivo
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Instale o aplicativo direto no seu dispositivo (Android, iOS, Windows, Mac) para executar de forma nativa e sem barra de navegação.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleInstallApp}
            className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            {isAppInstalled ? 'App Nativo Instalado' : 'Baixar / Instalar App'}
          </Button>
        </div>
      </div>

      {/* Permissões do Dispositivo (GPS & Localização) */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">my_location</span>
              Permissão de Geolocalização (GPS)
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Permita o acesso à localização para que os mapas, medições e telemetria funcionem com alta precisão no dispositivo.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              gpsPermission === 'granted'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {gpsPermission === 'granted' ? 'Permissão Concedida' : 'Acesso Pendente'}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRequestGpsPermission}
              className="bg-surface-container-high border-outline-variant hover:bg-surface-variant"
            >
              Solicitar Acesso ao GPS
            </Button>
          </div>
        </div>
      </div>

      {/* Modo de Operação & Armazenamento */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">Motor Local & Armazenamento</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Select
              label="Motor de Operação"
              value={apiMode}
              onValueChange={(val) => setApiMode(val as 'mock' | 'live')}
              options={[
                { value: 'mock', label: 'Motor Local (SQLite / IndexedDB em Memória)' },
                { value: 'live', label: 'Modo Sincronizado (Servidor Hono + PostGIS)' },
              ]}
            />
            <p className="mt-1 text-xs text-on-surface-variant">
              O motor local mantém todos os polígonos, projetos e pontos gravados no próprio dispositivo.
            </p>
          </div>

          <Input
            label="URL Base da API"
            value={settings.apiUrl}
            onChange={(e) => setSettings((s) => ({ ...s, apiUrl: e.target.value }))}
            placeholder="http://localhost:3000"
            className="font-mono text-xs"
          />
        </div>
      </div>

      {/* Parâmetros Cartográficos & Padrões */}
      <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">Parâmetros Cartográficos & Padrões</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Sistema de Referência (SRID)"
            value={settings.srid}
            onChange={(e) => setSettings((s) => ({ ...s, srid: e.target.value }))}
            placeholder="EPSG:4674"
          />

          <Input
            label="Formato de Exportação"
            value={settings.exportFormat}
            onChange={(e) => setSettings((s) => ({ ...s, exportFormat: e.target.value }))}
            placeholder="GeoJSON"
          />

          <Input
            label="Tamanho Máximo de Import (MiB)"
            type="number"
            value={settings.maxImportSize}
            onChange={(e) => setSettings((s) => ({ ...s, maxImportSize: e.target.value }))}
            placeholder="10"
            min="1"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!isDirty}
        >
          Salvar Configurações
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={handleReset}
        >
          Restaurar Padrões
        </Button>
        {isDirty && (
          <span className="text-xs text-amber-400 font-medium">Alterações não salvas</span>
        )}
      </div>
    </div>
  );
}
