import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@geonexo/ui';
import { createMapLibreMap, getDefaultBasemaps } from '@geonexo/maps';
import { Popup, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface TelemetryData {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}
interface MeasurePoint { lng: number; lat: number; }

function haversineMeters(a: MeasurePoint, b: MeasurePoint): number {
  const R = 6371000;
  const r = (v: number) => (v * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
}

// Mock layers para o painel de camadas
const MOCK_LAYERS = [
  { id: 'prop', label: 'Propriedades Rurais', color: '#0ea5e9', visible: true },
  { id: 'roads', label: 'Malha Viária', color: '#f59e0b', visible: false },
  { id: 'water', label: 'Hidrografia', color: '#06b6d4', visible: true },
  { id: 'dem', label: 'Modelo Digital de Elevação', color: '#10b981', visible: false },
];

// Mock GeoJSON
const mockGeoJSON = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'prop-1', name: 'Fazenda Santa Helena', area: '150 ha', owner: 'João Silva' }, geometry: { type: 'Polygon', coordinates: [[[-47.93,-15.79],[-47.92,-15.79],[-47.92,-15.78],[-47.93,-15.78],[-47.93,-15.79]]] } },
    { type: 'Feature', properties: { id: 'prop-2', name: 'Sítio Boa Vista', area: '200 ha', owner: 'Maria Costa' }, geometry: { type: 'Polygon', coordinates: [[[-47.91,-15.79],[-47.90,-15.79],[-47.90,-15.78],[-47.91,-15.78],[-47.91,-15.79]]] } },
  ],
};

type SidePanel = 'none' | 'ferramentas' | 'filtros' | 'camadas' | 'telemetria';

export default function CommandCenterPage() {
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const locationControlRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [sidePanel, setSidePanel] = useState<SidePanel>('none');
  const [telemetry, setTelemetry] = useState<TelemetryData>({ lat: -15.785, lng: -47.92, zoom: 14, pitch: 60, bearing: 45 });
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(
    Object.fromEntries(MOCK_LAYERS.map(l => [l.id, l.visible]))
  );
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('todos');

  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const searchAddress = async () => {
    if (!addressSearch.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`);
      const data = await res.json();
      setSearchResults(data);
      if (data.length === 0) toast({ title: 'Nenhum resultado', description: 'Tente outro endereço.', variant: 'default' });
    } catch (e) {
      toast({ title: 'Erro na busca', description: 'Não foi possível buscar o endereço.', variant: 'error' });
    }
  };

  const flyToResult = (result: any) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: [parseFloat(result.lon), parseFloat(result.lat)], zoom: 16 });
    setSearchResults([]);
    setAddressSearch('');
    new Marker({ color: '#10b981' }).setLngLat([parseFloat(result.lon), parseFloat(result.lat)]).addTo(mapRef.current);
  };


  const measuringRef = useRef(false);
  const measurePointsRef = useRef<MeasurePoint[]>([]);
  useEffect(() => { measuringRef.current = measuring; }, [measuring]);
  useEffect(() => { measurePointsRef.current = measurePoints; }, [measurePoints]);

  const togglePanel = (panel: SidePanel) => {
    setSidePanel(prev => prev === panel ? 'none' : panel);
  };

  const updateTelemetry = useCallback((map: any) => {
    const center = map.getCenter();
    setTelemetry({ lat: center.lat, lng: center.lng, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() });
  }, []);

  // Inicializa o mapa
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const basemaps = getDefaultBasemaps();
    const defaultBasemap = basemaps[0];
    if (!defaultBasemap) return;

    createMapLibreMap({ container: mapContainer.current, basemap: defaultBasemap, center: [-47.92, -15.785], zoom: 14, trackUserLocation: true })
      .then(({map, geolocate}: any) => {
        locationControlRef.current = geolocate;
        mapRef.current = map;

        const controls = (map as any)._controls as any[];
        

        const onMove = () => updateTelemetry(map);
        map.on('move', onMove);
        map.on('zoom', onMove);
        map.on('pitch', onMove);
        map.on('rotate', onMove);

        map.on('load', () => {
          map.setPitch(60);
          map.setBearing(45);

          map.addSource('mock-properties', { type: 'geojson', data: mockGeoJSON as any });
          map.addLayer({ id: 'mock-properties-fill', type: 'fill', source: 'mock-properties', paint: { 'fill-color': '#0ea5e9', 'fill-opacity': 0.4 } });
          map.addLayer({ id: 'mock-properties-outline', type: 'line', source: 'mock-properties', paint: { 'line-color': '#0284c7', 'line-width': 2 } });

          map.on('click', 'mock-properties-fill', (e: any) => {
            if (!e.features?.length || measuringRef.current) return;
            const props = e.features[0].properties as any;
            new Popup()
              .setLngLat(e.lngLat)
              .setHTML(`<div style="padding:8px;font-family:monospace;font-size:13px;color:#1e293b"><strong>${props.name}</strong><br/>Área: ${props.area}<br/>Proprietário: ${props.owner}</div>`)
              .addTo(map as any);
          });

          map.on('mouseenter', 'mock-properties-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', 'mock-properties-fill', () => { map.getCanvas().style.cursor = ''; });
        });

        // Listener de clique para medição
        map.on('click', (e: any) => {
          if (!measuringRef.current) return;
          const newPoint: MeasurePoint = { lng: e.lngLat.lng, lat: e.lngLat.lat };
          const prev = measurePointsRef.current;
          const newPoints = [...prev, newPoint];
          measurePointsRef.current = newPoints;
          setMeasurePoints(newPoints);

          let dist = 0;
          for (let i = 1; i < newPoints.length; i++) {
            dist += haversineMeters(newPoints[i - 1]!, newPoints[i]!);
          }
          setTotalDistance(dist);

          const marker = new Marker({ color: '#f59e0b', scale: 0.8 })
            .setLngLat([newPoint.lng, newPoint.lat])
            .addTo(map as any);
          markersRef.current.push(marker);
        });
      });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [updateTelemetry]);

  const handleMyLocation = () => {
    if (locationControlRef.current) {
      try { locationControlRef.current.trigger(); }
      catch { toast({ title: 'Erro de localização', description: 'Não foi possível acessar o GPS. Verifique as permissões.', variant: 'error' }); }
    } else {
      toast({ title: 'GPS indisponível', description: 'Controle de localização não encontrado.', variant: 'error' });
    }
  };

  const toggleMeasure = () => {
    const next = !measuring;
    setMeasuring(next);
    if (!next) {
      setMeasurePoints([]);
      setTotalDistance(0);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
      toast({ title: 'Medição encerrada', variant: 'default' });
    } else {
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'crosshair';
      toast({ title: 'Modo de Medição ativo', description: 'Clique no mapa para adicionar pontos.' });
      setSidePanel('telemetria');
    }
  };

  // Painel lateral
  const panelBg = 'absolute z-20 bg-surface-container border border-outline-variant shadow-2xl';
  const panelPos = 'bottom-0 left-0 right-0 md:bottom-auto md:top-0 md:left-auto md:right-0 md:h-full md:w-80';
  const panelRound = 'rounded-t-2xl md:rounded-none md:rounded-l-2xl';
  const labelClass = 'text-on-surface font-semibold text-sm';
  const subtitleClass = 'text-on-surface-variant text-xs';
  const valueClass = 'text-on-surface font-mono font-bold text-sm';

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      {/* Mapa */}
      <div ref={mapContainer} className="flex-1 w-full" />

      {/* ── Barra de ferramentas flutuante ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-auto md:top-6 md:left-4 md:translate-x-0 bg-surface-container/95 backdrop-blur border border-outline-variant rounded-2xl p-2 flex md:flex-col gap-1.5 shadow-xl z-10 w-max max-w-[92vw] overflow-x-auto">
        {/* Telemetria */}
        <ToolBtn active={sidePanel === 'telemetria'} onClick={() => togglePanel('telemetria')} icon="satellite_alt" label="Telemetria" color="cyan" />
        {/* Camadas */}
        <ToolBtn active={sidePanel === 'camadas'} onClick={() => togglePanel('camadas')} icon="layers" label="Camadas" color="blue" />
        {/* Filtros */}
        <ToolBtn active={sidePanel === 'filtros'} onClick={() => togglePanel('filtros')} icon="filter_list" label="Filtros" color="violet" />
        {/* Ferramentas */}
        <ToolBtn active={sidePanel === 'ferramentas'} onClick={() => togglePanel('ferramentas')} icon="handyman" label="Ferramentas" color="slate" />
        {/* Separador */}
        <div className="w-full h-px md:block hidden bg-slate-200 my-0.5" />
        <div className="w-px h-8 md:hidden block bg-slate-200 mx-0.5" />
        {/* Minha localização */}
        <ToolBtn active={false} onClick={handleMyLocation} icon="my_location" label="Minha localização" color="emerald" />
        {/* Medir */}
        <ToolBtn active={measuring} onClick={toggleMeasure} icon="straighten" label={measuring ? 'Encerrar medição' : 'Medir distância'} color="amber" />
      </div>

      {/* ── Indicador de medição ativo ── */}
      {measuring && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>straighten</span>
          {measurePoints.length === 0
            ? 'Clique no mapa para iniciar a medição'
            : `${measurePoints.length} ponto${measurePoints.length > 1 ? 's' : ''} · ${formatDistance(totalDistance)}`}
          <button onClick={toggleMeasure} className="ml-1 text-amber-600 hover:text-amber-900 font-bold">✕</button>
        </div>
      )}

      {/* ── Painel lateral (branco, texto escuro) ── */}
      {sidePanel !== 'none' && (
        <div className={`${panelBg} ${panelPos} ${panelRound} flex flex-col max-h-[70vh] md:max-h-full overflow-y-auto`}>
          {/* Header do painel */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant flex-shrink-0">
            <span className="text-on-surface font-bold text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600" style={{ fontSize: '20px' }}>
                {sidePanel === 'telemetria' ? 'satellite_alt' : sidePanel === 'camadas' ? 'layers' : sidePanel === 'filtros' ? 'filter_list' : 'handyman'}
              </span>
              {sidePanel === 'telemetria' ? 'Telemetria' : sidePanel === 'camadas' ? 'Camadas' : sidePanel === 'filtros' ? 'Filtros' : 'Ferramentas'}
            </span>
            <button onClick={() => setSidePanel('none')} className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>

          {/* Conteúdo: TELEMETRIA */}
          {sidePanel === 'telemetria' && (
            <div className="p-5 space-y-4">
              <div>
                <p className={subtitleClass + ' mb-2 uppercase tracking-wider'}>Posição do mapa</p>
                <div className="space-y-2">
                  <Row label="Latitude" value={`${telemetry.lat.toFixed(6)}°`} labelCls={labelClass} valueCls={valueClass} />
                  <Row label="Longitude" value={`${telemetry.lng.toFixed(6)}°`} labelCls={labelClass} valueCls={valueClass} />
                </div>
              </div>
              <div className="h-px bg-surface-variant" />
              <div>
                <p className={subtitleClass + ' mb-2 uppercase tracking-wider'}>Câmera</p>
                <div className="space-y-2">
                  <Row label="Zoom" value={telemetry.zoom.toFixed(2)} labelCls={labelClass} valueCls="text-cyan-700 font-mono font-bold text-sm" />
                  <Row label="Inclinação (Pitch)" value={`${telemetry.pitch.toFixed(1)}°`} labelCls={labelClass} valueCls="text-cyan-700 font-mono font-bold text-sm" />
                  <Row label="Rotação (Bearing)" value={`${telemetry.bearing.toFixed(1)}°`} labelCls={labelClass} valueCls="text-cyan-700 font-mono font-bold text-sm" />
                </div>
              </div>
              {measuring && (
                <>
                  <div className="h-px bg-surface-variant" />
                  <div>
                    <p className={subtitleClass + ' mb-2 uppercase tracking-wider'}>Medição ativa</p>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                      <Row label="Pontos" value={String(measurePoints.length)} labelCls="text-amber-800 font-semibold text-sm" valueCls="text-amber-900 font-mono font-bold text-sm" />
                      <Row label="Distância total" value={formatDistance(totalDistance)} labelCls="text-amber-800 font-semibold text-sm" valueCls="text-amber-900 font-mono font-bold text-base" />
                    </div>
                    <button onClick={toggleMeasure} className="mt-3 w-full py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 transition-colors">
                      Encerrar medição
                    </button>
                  </div>
                </>
              )}
              {!measuring && (
                <button onClick={toggleMeasure} className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-semibold hover:bg-surface-variant transition-colors flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>straighten</span>
                  Iniciar medição de distância
                </button>
              )}
            </div>
          )}

          {/* Conteúdo: CAMADAS */}
          {sidePanel === 'camadas' && (
            <div className="p-5 space-y-3">
              <p className={subtitleClass + ' uppercase tracking-wider'}>Gerenciar camadas visíveis</p>
              {MOCK_LAYERS.map(layer => (
                <div key={layer.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-surface-variant transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: layer.color }} />
                    <span className="text-on-surface text-sm font-medium">{layer.label}</span>
                  </div>
                  <button
                    onClick={() => setLayerVisibility(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))}
                    className={`w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0 ${layerVisibility[layer.id] ? 'bg-cyan-500' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface-container shadow transition-all duration-200 ${layerVisibility[layer.id] ? 'left-[calc(100%-22px)]' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
              <div className="pt-2 border-t border-outline-variant">
                <button
                  onClick={() => toast({ title: 'Importar Camada', description: 'Funcionalidade de importação em desenvolvimento.', variant: 'default' })}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-on-surface-variant text-sm font-medium hover:border-cyan-400 hover:text-cyan-700 hover:bg-cyan-50 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                  Adicionar camada
                </button>
              </div>
            </div>
          )}

          {/* Conteúdo: FILTROS */}
          {sidePanel === 'filtros' && (
            <div className="p-5 space-y-4">
              <p className={subtitleClass + ' uppercase tracking-wider'}>Filtrar feições no mapa</p>
              <div>
                <label className={labelClass + ' block mb-1.5'}>Busca por nome</label>
                <input
                  type="text"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder="Ex: Fazenda, Sítio..."
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                />
              </div>
              <div>
                <label className={labelClass + ' block mb-1.5'}>Tipo de feição</label>
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="propriedade">Propriedades</option>
                  <option value="hidro">Hidrografia</option>
                  <option value="estrada">Estradas</option>
                  <option value="vegetacao">Vegetação</option>
                </select>
              </div>
              <div className="h-px bg-surface-variant" />
              {filterText && (
                <div className="space-y-2">
                  <p className={subtitleClass}>Resultados para "{filterText}":</p>
                  {mockGeoJSON.features
                    .filter(f => f.properties.name.toLowerCase().includes(filterText.toLowerCase()))
                    .map(f => (
                      <div key={f.properties.id} className="px-3 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant">
                        <p className="text-on-surface font-semibold text-sm">{f.properties.name}</p>
                        <p className="text-on-surface-variant text-xs">{f.properties.area} · {f.properties.owner}</p>
                      </div>
                    ))}
                  {mockGeoJSON.features.filter(f => f.properties.name.toLowerCase().includes(filterText.toLowerCase())).length === 0 && (
                    <p className="text-on-surface-variant text-sm text-center py-4">Nenhuma feição encontrada.</p>
                  )}
                </div>
              )}
              <button
                onClick={() => { setFilterText(''); setFilterType('todos'); toast({ title: 'Filtros limpos', variant: 'default' }); }}
                className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-variant transition-colors"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* Conteúdo: FERRAMENTAS */}
          {sidePanel === 'ferramentas' && (
            <div className="p-5 space-y-3">
              <p className={subtitleClass + ' uppercase tracking-wider'}>Ferramentas disponíveis</p>
              {[
                { icon: 'straighten', label: 'Medir Distância', desc: 'Clique em pontos no mapa para medir.', action: () => { toggleMeasure(); setSidePanel('telemetria'); } },
                { icon: 'my_location', label: 'Minha Localização', desc: 'Centralizar o mapa na sua posição atual.', action: handleMyLocation },
                { icon: 'crop_free', label: 'Selecionar Área', desc: 'Desenhe um retângulo para selecionar feições.', action: () => toast({ title: 'Seleção de Área', description: 'Funcionalidade em desenvolvimento.', variant: 'default' }) },
                { icon: 'download', label: 'Exportar Dados', desc: 'Exportar feições visíveis em GeoJSON.', action: () => toast({ title: 'Exportando...', description: 'Preparando arquivo GeoJSON.', variant: 'success' }) },
                { icon: 'photo_camera', label: 'Capturar Mapa', desc: 'Salvar imagem do mapa atual.', action: () => toast({ title: 'Captura', description: 'Salvando imagem do mapa...', variant: 'default' }) },
              ].map(tool => (
                <button key={tool.icon} onClick={tool.action} className="w-full flex items-start gap-3 px-3 py-3 rounded-xl border border-outline-variant bg-surface-container-high hover:bg-cyan-50 hover:border-cyan-200 transition-colors text-left">
                  <span className="material-symbols-outlined text-cyan-600 flex-shrink-0 mt-0.5" style={{ fontSize: '20px' }}>{tool.icon}</span>
                  <div>
                    <p className="text-on-surface font-semibold text-sm">{tool.label}</p>
                    <p className="text-on-surface-variant text-xs mt-0.5">{tool.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-componentes auxiliares
function ToolBtn({ active, onClick, icon, label, color }: { active: boolean; onClick: () => void; icon: string; label: string; color: string }) {
  const activeColors: Record<string, string> = {
    cyan: 'bg-cyan-100 border-cyan-300 text-cyan-700',
    blue: 'bg-blue-100 border-blue-300 text-blue-700',
    violet: 'bg-violet-100 border-violet-300 text-violet-700',
    slate: 'bg-slate-200 border-slate-300 text-on-surface-variant',
    emerald: 'bg-emerald-100 border-emerald-300 text-emerald-700',
    amber: 'bg-amber-100 border-amber-300 text-amber-700',
  };
  const idleClass = 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface';
  return (
    <button
      onClick={onClick}
      title={label}
      className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border flex items-center justify-center transition-all shadow-sm ${active ? activeColors[color] ?? activeColors['slate'] : idleClass}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
    </button>
  );
}

function Row({ label, value, labelCls, valueCls }: { label: string; value: string; labelCls: string; valueCls: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelCls}>{label}</span>
      <span className={valueCls}>{value}</span>
    </div>
  );
}
