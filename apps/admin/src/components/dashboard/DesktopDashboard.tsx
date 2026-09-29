import { Link } from '@tanstack/react-router';
import * as React from 'react';
import { useToast } from '@geonexo/ui';

export function DesktopDashboard() {
  const { toast } = useToast();
  return (
    <>
      <div className="flex-1 flex flex-col bg-background transition-all" id="main-workspace">
{/* Main Workspace Body */}
<main className="flex-1 p-8 flex flex-col gap-6 max-w-[1600px] w-full mx-auto">
{/* Workspace Title & Primary Action Bar */}
<section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-outline-variant">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 font-mono text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">
              Geospatial Operations
            </span>
<span className="text-slate-600 font-mono text-xs">/</span>
<span className="text-on-surface-variant font-mono text-xs">US-EAST-VA GEO-POD 04</span>
</div>
<h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-on-surface">GeoNexo Studio</h1>
<p className="text-xs text-on-surface-variant mt-1">Multi-Sensor Planetary Ingestion, 3D LiDAR Meshes &amp; Real-Time Raster Analytics</p>
</div>
<div className="flex flex-wrap items-center gap-2.5">
{/* Secondary Action */}
<button 
  className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant hover:border-cyan-500/40 hover:text-primary transition-all text-xs font-medium"
  onClick={() => toast({ title: "Importação iniciada", description: "O modal de importação de Vetor/Raster será aberto em breve.", variant: "default" })}
>
<span className="material-symbols-outlined text-cyan-400" style={{fontSize: "16px"}}>file_upload</span>
<span className="">Importar Vetor/Raster</span>
</button>
{/* Primary Action */}
<button 
  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
  onClick={() => toast({ title: "Novo Projeto", description: "O assistente de novo projeto espacial está em desenvolvimento.", variant: "default" })}
>
<span className="material-symbols-outlined font-bold" style={{fontSize: "16px"}}>add_circle</span>
<span className="">+ Novo Projeto Espacial</span>
</button>
</div>
</section>
{/* 4-METRIC HIGH-TECH TELEMETRY HERO */}
<section aria-label="Key Geospatial Telemetry" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
{/* Metric 1: Total Active Ingestions */}
<div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant hover:border-cyan-500/40 transition-all flex flex-col justify-between relative overflow-hidden group">
<div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all"></div>
<div className="flex justify-between items-start mb-2">
<span className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">Active Ingestions</span>
<span className="material-symbols-outlined text-cyan-400" style={{fontSize: "18px"}}>cloud_sync</span>
</div>
<div className="flex items-baseline gap-2 mb-2">
<span className="font-mono text-2xl font-bold text-on-surface tracking-tight">1.84 TB</span>
<span className="font-mono text-xs text-on-surface-variant">/ 24 Batches</span>
</div>
<div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/50 font-mono text-[11px]">
<span className="text-emerald-400 flex items-center gap-1.5">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 99.4% Validated
            </span>
<span className="text-on-surface-variant">1 In Pipeline</span>
</div>
</div>
{/* Metric 2: Rendered Vector & Raster Points */}
<div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant hover:border-cyan-500/40 transition-all flex flex-col justify-between relative overflow-hidden group">
<div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all"></div>
<div className="flex justify-between items-start mb-2">
<span className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">Rendered Points</span>
<span className="material-symbols-outlined text-cyan-400" style={{fontSize: "18px"}}>polyline</span>
</div>
<div className="flex items-baseline gap-2 mb-2">
<span className="font-mono text-2xl font-bold text-cyan-300 tracking-tight">142.8M</span>
<span className="font-mono text-xs text-on-surface-variant">Features</span>
</div>
<div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/50 font-mono text-[11px]">
<span className="text-cyan-400">WebGL 2.0 Compute</span>

</div>
</div>
{/* Metric 3: Real-Time Spatial Compute */}
<div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant hover:border-cyan-500/40 transition-all flex flex-col justify-between relative overflow-hidden group">
<div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all"></div>
<div className="flex justify-between items-start mb-2">
<span className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">Spatial Compute Load</span>
<span className="material-symbols-outlined text-emerald-400" style={{fontSize: "18px"}}>memory</span>
</div>
<div className="flex items-baseline gap-2 mb-2">
<span className="font-mono text-2xl font-bold text-on-surface tracking-tight">28%</span>
<span className="text-emerald-400 font-mono text-xs font-medium">Nominal</span>
</div>
<div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/50 font-mono text-[11px] text-on-surface-variant">
<span className="">US-East Geo-Cluster</span>
<span className="text-cyan-400">14ms Latency</span>
</div>
</div>
{/* Metric 4: Satellite & Sensor Feeds */}
<div className="p-4 rounded-xl bg-surface-container-high border border-outline-variant hover:border-cyan-500/40 transition-all flex flex-col justify-between relative overflow-hidden group">
<div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all"></div>
<div className="flex justify-between items-start mb-2">
<span className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">Constellation Feeds</span>
<span className="material-symbols-outlined text-cyan-400" style={{fontSize: "18px"}}>satellite_alt</span>
</div>
<div className="flex items-baseline gap-2 mb-2">
<span className="font-mono text-2xl font-bold text-on-surface tracking-tight">12 Feeds</span>
<span className="text-emerald-400 font-mono text-xs font-semibold">Active Orbit</span>
</div>
<div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/50 font-mono text-[11px] text-on-surface-variant">
<span className="truncate">Sentinel-2 • Landsat-9</span>
<span className="text-on-surface-variant text-[10px]">PlanetScope</span>
</div>
</div>
</section>
{/* FILTER & VIEW CONTROLS */}
<section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
{/* Filter Chips */}
<div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
<button className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-2 whitespace-nowrap">
<span className="">All Projects</span>
<span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">24</span>
</button>
<button className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-primary hover:border-white/20 font-mono text-xs transition-colors flex items-center gap-2 whitespace-nowrap">
<span className="">Satellite &amp; Rasters</span>
<span className="px-1.5 py-0.2 rounded bg-white/5 text-on-surface-variant text-[10px]">11</span>
</button>
<button className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-primary hover:border-white/20 font-mono text-xs transition-colors flex items-center gap-2 whitespace-nowrap">
<span className="">3D LiDAR &amp; Meshes</span>
<span className="px-1.5 py-0.2 rounded bg-white/5 text-on-surface-variant text-[10px]">5</span>
</button>
<button className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface-variant hover:text-primary hover:border-white/20 font-mono text-xs transition-colors flex items-center gap-2 whitespace-nowrap">
<span className="">Vector Streams</span>
<span className="px-1.5 py-0.2 rounded bg-white/5 text-on-surface-variant text-[10px]">8</span>
</button>
</div>
{/* Quick Filter & View Mode */}
<div className="flex items-center gap-2.5">
<div className="relative w-52 hidden md:block">
<input className="w-full pl-8 pr-3 py-1.5 bg-surface-container-high text-on-surface font-mono text-xs rounded-lg border border-outline-variant focus:border-cyan-500 focus:outline-none placeholder:text-slate-500" placeholder="Filter workspace..." type="text" />
<span className="material-symbols-outlined text-on-surface-variant absolute left-2.5 top-2" style={{fontSize: "14px"}}>filter_list</span>
</div>
<div className="flex items-center border border-outline-variant rounded-lg bg-surface-container-high p-0.5">
<button className="p-1.5 rounded-md bg-white/10 text-cyan-400" title="Grid View">
<span className="material-symbols-outlined" style={{fontSize: "16px"}}>grid_view</span>
</button>
<button className="p-1.5 rounded-md text-on-surface-variant hover:text-primary" title="List View">
<span className="material-symbols-outlined" style={{fontSize: "16px"}}>table_rows</span>
</button>
</div>
</div>
</section>
{/* REALISTIC GEOSPATIAL PROJECT CARDS GRID */}
<section aria-label="Spatial Projects Showcase" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-5">
{/* CARD 1: Fiordland Coastline & Bathymetric Elevation DEM */}
<article className="flex flex-col bg-surface-container-high rounded-xl border border-outline-variant overflow-hidden hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 group">
{/* Thumbnail with Dark Gradient & Frosted Telemetry Tags */}
<div className="relative h-60 w-full bg-surface-container overflow-hidden border-b border-outline-variant">
<img alt="Fiordland Coastline &amp; Bathymetric Elevation DEM" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDGUYS2D5OkohnMkdoe0wWcGWduZednbNtw7wiCE4Auq3q05aMLLeTCrBPVDoVhKAtJ5g7OpcRACYSmVyFh6cM36sr8Ufv-uaWZn3HgoQaCSNHLpvbsyL8Bdlcu0Y-jMC7doAKbXvarjkkrPwIMzx__iGeEppb1IR8GBHTHrKQzsFK_qq2JeTLGJUVljJICdp5gK7UdXyOf6ZbYTs3aFksY03aKAZD_UTSUxWkuClo4dQr2hi0ZXKeC" />
<div className="absolute inset-0 bg-gradient-to-t from-[#121826] via-transparent to-black/30 pointer-events-none"></div>
{/* Frosted Glass HUD Badges */}
<div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-medium">
                COGs / GeoTIFF
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                Bathymetry 0.5m
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-on-surface-variant border border-outline-variant font-mono text-[10px]">
                Multi-Spectral
              </span>
</div>
{/* Coordinate / Extent Monospace Overlay */}
<div className="absolute bottom-2.5 right-3">
<span className="px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm border border-outline-variant font-mono text-[10px] text-on-surface-variant">
                WGS 84 / UTM Z60S
              </span>
</div>
</div>
{/* Card Body Content */}
<div className="p-5 flex-1 flex flex-col justify-between">
<div>
<div className="flex justify-between items-start gap-2 mb-1.5">
<h3 className="text-base font-semibold text-on-surface group-hover:text-cyan-400 transition-colors">
                  Fiordland Coastline &amp; Bathymetric Elevation DEM
                </h3>
<button className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-white/5 transition-colors" title="Project Actions">
<span className="material-symbols-outlined" style={{fontSize: "18px"}}>more_vert</span>
</button>
</div>
<p className="text-xs text-on-surface-variant leading-relaxed">
                Ultra-high resolution coastal topography with DEM contour overlays and real-time tidal hydrodynamics.
              </p>
</div>
{/* Card Telemetry Footer */}
<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between font-mono text-[11px]">
<div className="flex items-center gap-2 text-on-surface-variant">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
<span className="">Synced 18m ago • 4.2M Points</span>
</div>
<div className="flex items-center gap-2">
<span className="text-cyan-400 text-[10px] font-semibold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">Team Alpha</span>
<div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-[9px] text-cyan-300 font-bold">
                  TA
                </div>
</div>
</div>
</div>
</article>
{/* CARD 2: Alpine Glacier & Swiss Peak 3D LiDAR Survey */}
<article className="flex flex-col bg-surface-container-high rounded-xl border border-outline-variant overflow-hidden hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 group">
{/* Thumbnail with Dark Gradient & Frosted Telemetry Tags */}
<div className="relative h-60 w-full bg-surface-container overflow-hidden border-b border-outline-variant">
<img alt="Alpine Glacier &amp; Swiss Peak 3D LiDAR Survey" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAp7LJsyFDlrGNwwsSbUP2enu-YwlgweIqmoY1b5zy_3seDysUH_eH2OvM9Iud2oipJ-bFSIqX-ex8IfSVSMiJLnTi2gYkKxucoQP3gjA_hK5Fvi0K4XA87TMEZn1_jSP2Qb9Ms03KCeNbfCwxnbK9MTfpchY8KHJRKEfJc78lD6ZSpXfGdfDtLR8SLQiu9N5VjqrJLGBqhoWP8XNERhoOq19dmE7f1uUoSWuoW-xqIQE0HzRyp0sjM" />
<div className="absolute inset-0 bg-gradient-to-t from-[#121826] via-transparent to-black/30 pointer-events-none"></div>
{/* Frosted Glass HUD Badges */}
<div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-medium">
                LiDAR Point Cloud
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-purple-300 border border-purple-500/30 font-mono text-[10px]">
                Volumetric Mesh
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                Cryo-Tracking
              </span>
</div>
{/* Monospace Resolution Tag */}
<div className="absolute bottom-2.5 right-3">
<span className="px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm border border-outline-variant font-mono text-[10px] text-cyan-300">
                RMSEz &lt; 8cm
              </span>
</div>
</div>
{/* Card Body Content */}
<div className="p-5 flex-1 flex flex-col justify-between">
<div>
<div className="flex justify-between items-start gap-2 mb-1.5">
<h3 className="text-base font-semibold text-on-surface group-hover:text-cyan-400 transition-colors">
                  Alpine Glacier &amp; Swiss Peak 3D LiDAR Survey
                </h3>
<button className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-white/5 transition-colors" title="Project Actions">
<span className="material-symbols-outlined" style={{fontSize: "18px"}}>more_vert</span>
</button>
</div>
<p className="text-xs text-on-surface-variant leading-relaxed">
                Volumetric multi-temporal glacier displacement surface model with sub-centimeter elevation delta analysis.
              </p>
</div>
{/* Card Telemetry Footer */}
<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between font-mono text-[11px]">
<div className="flex items-center gap-2 text-on-surface-variant">
<span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
<span className="">Synced 42m ago • 60 pts/m²</span>
</div>
<div className="flex items-center gap-2">
<span className="text-purple-300 text-[10px] font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">Cryo Lab</span>
<div className="w-5 h-5 rounded-full bg-purple-950 border border-purple-500/40 flex items-center justify-center text-[9px] text-purple-300 font-bold">
                  CL
                </div>
</div>
</div>
</div>
</article>
{/* CARD 3: Tokyo Megacity Infrared Urban Heat Island */}
<article className="flex flex-col bg-surface-container-high rounded-xl border border-outline-variant overflow-hidden hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 group">
{/* Thumbnail with Dark Gradient & Frosted Telemetry Tags */}
<div className="relative h-60 w-full bg-surface-container overflow-hidden border-b border-outline-variant">
<img alt="Tokyo Megacity Infrared Urban Heat Island" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDF1WcfhsjVkxJ4nCoTHK_GGn4dXagpGQWXojy08_Eus7AYSK2YHtfO4_nTveDzjcEA-fPShIN8PJ01g2rnT6OseXNWDHnWDXL6KXGX-FZz_2mXIdjoFrFqspcqAiTfaUi9CblvOd9pk884XoA-a4AOSbfqX-xkwhuwu4jg29MuWPlDxXnHPqv9oRDC_PaYWZlA3t71bPMy_xfMBOwx2eUhMP4B1zvu5CMoUsLYdi5E5kC-XhWqCWEs" />
<div className="absolute inset-0 bg-gradient-to-t from-[#121826] via-transparent to-black/30 pointer-events-none"></div>
{/* Frosted Glass HUD Badges */}
<div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-amber-300 border border-amber-500/30 font-mono text-[10px] font-medium">
                Thermal IR
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-cyan-300 border border-cyan-500/30 font-mono text-[10px]">
                Top-down Twilight
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-on-surface-variant border border-outline-variant font-mono text-[10px]">
                Urban Analytics
              </span>
</div>
{/* Heat Scale Indicator Badge */}
<div className="absolute bottom-2.5 right-3">
<span className="px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm border border-amber-500/30 font-mono text-[10px] text-amber-300">
                ΔT +32°C Core
              </span>
</div>
</div>
{/* Card Body Content */}
<div className="p-5 flex-1 flex flex-col justify-between">
<div>
<div className="flex justify-between items-start gap-2 mb-1.5">
<h3 className="text-base font-semibold text-on-surface group-hover:text-cyan-400 transition-colors">
                  Tokyo Megacity Infrared Urban Heat Island
                </h3>
<button className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-white/5 transition-colors" title="Project Actions">
<span className="material-symbols-outlined" style={{fontSize: "18px"}}>more_vert</span>
</button>
</div>
<p className="text-xs text-on-surface-variant leading-relaxed">
                Radiometric nocturnal thermal emission mapping cross-referenced with transit grid density and building heights.
              </p>
</div>
{/* Card Telemetry Footer */}
<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between font-mono text-[11px]">
<div className="flex items-center gap-2 text-emerald-400">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
<span className="">Live Stream • 12 Active Sensors</span>
</div>
<div className="flex items-center gap-2">
<span className="text-on-surface-variant text-[10px] font-semibold bg-white/5 px-2 py-0.5 rounded border border-outline-variant">Municipal GIS</span>
<div className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/40 flex items-center justify-center text-[9px] text-amber-300 font-bold">
                  MG
                </div>
</div>
</div>
</div>
</article>
{/* CARD 4: Danube Delta & Agricultural Hydrology (NDVI) */}
<article className="flex flex-col bg-surface-container-high rounded-xl border border-outline-variant overflow-hidden hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 group">
{/* Thumbnail with Dark Gradient & Frosted Telemetry Tags */}
<div className="relative h-60 w-full bg-surface-container overflow-hidden border-b border-outline-variant">
<img alt="Danube Delta &amp; Agricultural Hydrology (NDVI)" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ2B6UEgUAfQINlrE8mMYyJX6IoIVnQFDN18Be7paXrpRz2rMUNVYs_UJz5k_sQDNf1gQQ28G4pXdatvl2gvyy3WQVlsd2Wx48Zdxygtn4aVgN-4s9C_pthHMiHtjn2rq3SaBDDpsZsXVWIWCgEmoF996GQYDBtgO92lKFy2g_mxP_cKWbCUw0ARiQD23VbxsQJev7y2bSLrxtY7FNCJvUdeaSkMSmd7l4gm28-miUgsyI3zuEXgCn" />
<div className="absolute inset-0 bg-gradient-to-t from-[#121826] via-transparent to-black/30 pointer-events-none"></div>
{/* Frosted Glass HUD Badges */}
<div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-rose-300 border border-rose-500/30 font-mono text-[10px] font-medium">
                NDVI Index
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-cyan-300 border border-cyan-500/30 font-mono text-[10px]">
                Multi-Spectral
              </span>
<span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/80 backdrop-blur-md text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                Wetland Basin
              </span>
</div>
{/* Band Count Tag */}
<div className="absolute bottom-2.5 right-3">
<span className="px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm border border-outline-variant font-mono text-[10px] text-on-surface-variant">
                Sentinel-2 (B8A/B4)
              </span>
</div>
</div>
{/* Card Body Content */}
<div className="p-5 flex-1 flex flex-col justify-between">
<div>
<div className="flex justify-between items-start gap-2 mb-1.5">
<h3 className="text-base font-semibold text-on-surface group-hover:text-cyan-400 transition-colors">
                  Danube Delta &amp; Agricultural Hydrology (NDVI)
                </h3>
<button className="text-on-surface-variant hover:text-primary p-1 rounded hover:bg-white/5 transition-colors" title="Project Actions">
<span className="material-symbols-outlined" style={{fontSize: "18px"}}>more_vert</span>
</button>
</div>
<p className="text-xs text-on-surface-variant leading-relaxed">
                10-band Sentinel-2 reflectance matrix calibrated for crop water stress, soil saturation and riparian drift.
              </p>
</div>
{/* Card Telemetry Footer */}
<div className="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between font-mono text-[11px]">
<div className="flex items-center gap-2 text-on-surface-variant">
<span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
<span className="">Synced 2h ago • 10m/px</span>
</div>
<div className="flex items-center gap-2">
<span className="text-rose-300 text-[10px] font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Agrosystems</span>
<div className="w-5 h-5 rounded-full bg-rose-950 border border-rose-500/40 flex items-center justify-center text-[9px] text-rose-300 font-bold">
                  AS
                </div>
</div>
</div>
</div>
</article>
</section>
{/* CRISP DOCKED HUD TELEMETRY FOOTER STRIP */}
<footer className="mt-4 p-3.5 rounded-xl bg-surface-container-high border border-outline-variant flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-xs text-on-surface-variant shadow-md">
<div className="flex flex-wrap items-center gap-4">
<div className="flex items-center gap-2 text-on-surface">

<span className="">COORDINATE SYSTEM:</span>
<span className="text-cyan-400 font-semibold">EPSG:4326 (WGS84)</span>
</div>
<div className="hidden sm:flex items-center gap-1.5 border-l border-outline-variant pl-4">
<span className="">ENGINE:</span>
<span className="text-emerald-400">WebGL 2.0 Compute Active</span>
</div>
<div className="hidden lg:flex items-center gap-1.5 border-l border-outline-variant pl-4">


</div>
</div>
<div className="flex items-center gap-4">
<div className="flex items-center gap-1.5">
<span className="">LATENCY:</span>
<span className="text-cyan-400 font-semibold">12ms</span>
</div>
<div className="flex items-center gap-1.5 border-l border-outline-variant pl-4">
<span className="">TILE CACHE:</span>
<span className="text-emerald-400 font-semibold">99.2% HIT</span>
</div>
</div>
</footer>
</main>
</div>



    </>
  );
}
