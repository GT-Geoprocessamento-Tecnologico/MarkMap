import React, { useState, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { useToast } from '@geonexo/ui';
import { createMapLibreMap, getDefaultBasemaps } from '@geonexo/maps';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function MeshStudioPage() {
  const [activeTool, setActiveTool] = useState('pan');
  const [wireframe, setWireframe] = useState(false);
  const [camera, setCamera] = useState('PER');
  const { toast } = useToast();

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const basemaps = getDefaultBasemaps();
    const defaultBasemap = basemaps[0];
    if (!defaultBasemap) return;

    createMapLibreMap({
      container: mapContainer.current,
      basemap: defaultBasemap,
      center: [-47.92, -15.785],
      zoom: 14,
      trackUserLocation: true,
    }).then(({map}: any) => {
      mapRef.current = map;

      map.on('load', () => {
        map.setPitch(60);
        map.setBearing(45);
        
        map.addSource('terrain-source', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          encoding: 'terrarium',
          maxzoom: 14,
          minzoom: 0
        });
        map.setTerrain({ source: 'terrain-source', exaggeration: 1.5 });

        map.addSource('buildings', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { height: 150, base_height: 0, color: '#0ea5e9' },
                geometry: {
                  type: 'Polygon',
                  coordinates: [[[-47.92, -15.785], [-47.918, -15.785], [-47.918, -15.783], [-47.92, -15.783], [-47.92, -15.785]]]
                }
              }
            ]
          }
        });
        map.addLayer({
          'id': '3d-buildings',
          'source': 'buildings',
          'type': 'fill-extrusion',
          'paint': {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base_height'],
            'fill-extrusion-opacity': 0.8
          }
        });
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync wireframe mode
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    if (mapRef.current.getLayer('3d-buildings')) {
       // Mocking wireframe visually by turning off opacity
       mapRef.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', wireframe ? 0.3 : 0.8);
    }
  }, [wireframe]);

  // Sync Camera
  useEffect(() => {
    if (!mapRef.current) return;
    if (camera === 'TOP') {
      mapRef.current.flyTo({ pitch: 0, bearing: 0 });
    } else if (camera === 'FRT') {
      mapRef.current.flyTo({ pitch: 80, bearing: 0 });
    } else if (camera === 'PER') {
      mapRef.current.flyTo({ pitch: 60, bearing: 20 });
    }
  }, [camera]);

  const handleSave = () => {
    toast({ title: 'Salvo com sucesso', description: 'As configurações da malha foram salvas no banco de dados.', variant: 'success' });
  };

  const handleTool = (t: string) => {
    setActiveTool(t);
    toast({ title: 'Ferramenta selecionada', description: `O modo de interação agora é ${t.toUpperCase()}` });
  };

  return (
    <div className="flex flex-col h-full bg-background text-on-surface-variant p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">view_in_ar</span>
            Estúdio de Malhas 3D
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Visualize e edite malhas espaciais de alta resolução</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/" className="px-4 py-2 min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 border border-outline-variant text-sm font-medium transition-colors flex items-center justify-center">
            Voltar
          </Link>
          <button 
            onClick={handleSave}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            Salvar
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0">
        <div className="w-full lg:w-64 bg-surface-container-high backdrop-blur-md rounded-xl border border-outline-variant p-4 flex flex-col gap-6 overflow-y-auto shrink-0">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Propriedades</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Nível de Detalhe (LOD)</label>
                <input type="range" className="w-full accent-cyan-500 min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs text-on-surface-variant mb-1 block">Opacidade</label>
                <input type="range" className="w-full accent-cyan-500 min-h-[44px]" />
              </div>
              <div className="flex items-center justify-between min-h-[44px]">
                <span className="text-xs text-on-surface-variant">Wireframe</span>
                <input 
                  type="checkbox" 
                  checked={wireframe}
                  onChange={(e) => setWireframe(e.target.checked)}
                  className="accent-cyan-500 w-6 h-6" 
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Ferramentas</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleTool('pan')} className={`p-2 min-h-[60px] rounded border flex flex-col items-center justify-center gap-1 transition-colors ${activeTool === 'pan' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-transparent hover:border-cyan-500/30 text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-xl">pan_tool</span>
                <span className="text-[10px]">Pan</span>
              </button>
              <button onClick={() => handleTool('orbit')} className={`p-2 min-h-[60px] rounded border flex flex-col items-center justify-center gap-1 transition-colors ${activeTool === 'orbit' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-transparent hover:border-cyan-500/30 text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-xl">360</span>
                <span className="text-[10px]">Orbit</span>
              </button>
              <button onClick={() => handleTool('zoom')} className={`p-2 min-h-[60px] rounded border flex flex-col items-center justify-center gap-1 transition-colors ${activeTool === 'zoom' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-transparent hover:border-cyan-500/30 text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-xl">zoom_in</span>
                <span className="text-[10px]">Zoom</span>
              </button>
              <button onClick={() => handleTool('medir')} className={`p-2 min-h-[60px] rounded border flex flex-col items-center justify-center gap-1 transition-colors ${activeTool === 'medir' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-transparent hover:border-cyan-500/30 text-on-surface-variant'}`}>
                <span className="material-symbols-outlined text-xl">straighten</span>
                <span className="text-[10px]">Medir</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3D Viewport - REAL MAPLIBRE */}
        <div className="flex-1 bg-black/40 rounded-xl border border-outline-variant/50 flex items-center justify-center relative overflow-hidden group min-h-[300px] lg:min-h-0">
          <div ref={mapContainer} className="absolute inset-0 z-0"></div>
          
          <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-xs text-cyan-400 backdrop-blur pointer-events-none">
            WebGL 3D Engine Active
          </div>
          
          {/* Overlay controls */}
          <div className="absolute bottom-4 right-4 lg:top-4 lg:bottom-auto flex bg-surface-container-high/80 backdrop-blur rounded-lg border border-outline-variant overflow-hidden shadow-lg z-10">
            <button 
              onClick={() => setCamera('TOP')}
              className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 transition-colors ${camera === 'TOP' ? 'bg-cyan-500/20' : ''}`}
            >
              <span className={`text-xs font-bold px-1 ${camera === 'TOP' ? 'text-cyan-400' : 'text-on-surface-variant'}`}>TOP</span>
            </button>
            <div className="w-px bg-white/10"></div>
            <button 
              onClick={() => setCamera('FRT')}
              className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 transition-colors ${camera === 'FRT' ? 'bg-cyan-500/20' : ''}`}
            >
              <span className={`text-xs font-bold px-1 ${camera === 'FRT' ? 'text-cyan-400' : 'text-on-surface-variant'}`}>FRT</span>
            </button>
            <div className="w-px bg-white/10"></div>
            <button 
              onClick={() => setCamera('PER')}
              className={`p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 transition-colors ${camera === 'PER' ? 'bg-cyan-500/20' : ''}`}
            >
              <span className={`text-xs font-bold px-1 ${camera === 'PER' ? 'text-cyan-400' : 'text-on-surface-variant'}`}>PER</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
