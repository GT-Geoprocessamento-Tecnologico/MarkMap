import { Link } from '@tanstack/react-router';
import * as React from 'react';
export function MobileDashboard() {
  return (
    <>
<main className="flex-1 flex flex-col relative w-full bg-surface pb-20"><div className="flex flex-col w-full px-margin-mobile pb-space-lg gap-space-lg">
{/* Status HUD Ribbon */}
<section className="flex items-center justify-between bg-surface-container-low px-space-md py-space-sm rounded-xl shadow-md">
<div className="flex items-center gap-space-xs">
<span className="relative flex h-2 w-2">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-fixed opacity-75"></span>
<span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
</span>
<span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface">US-EAST GEO-POD</span>
<span className="font-label-sm text-label-sm text-outline-variant">•</span>
<span className="font-label-sm text-label-sm text-secondary-fixed-dim">60 FPS GPU</span>
</div>
<div className="flex items-center gap-space-xs bg-surface-container-high px-space-xs py-0.5 rounded-lg">
<span className="material-symbols-outlined text-[14px] text-primary-container">memory</span>
<span className="font-label-sm text-label-sm text-primary">CORE ACTIVE</span>
</div>
</section>
{/* Summary KPI Horizontal Reel */}
<section className="flex flex-col gap-space-xs">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">Pipeline Telemetry</span>
<span className="font-label-sm text-label-sm text-primary-container">SYNC 0.4s</span>
</div>
<div className="flex gap-space-sm overflow-x-auto pb-space-xs no-scrollbar -mx-margin-mobile px-margin-mobile">
{/* KPI Card 1 */}
<div className="min-w-[170px] flex-shrink-0 bg-surface-container-low rounded-xl p-space-md shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Active Ingest</span>
<span className="material-symbols-outlined text-primary text-[18px]">cloud_sync</span>
</div>
<div className="flex flex-col">
<span className="font-metric-display text-metric-display text-on-surface leading-tight">1.84 <span className="text-sm font-label-md text-primary-container">TB</span></span>
<span className="font-label-sm text-label-sm text-secondary mt-0.5 flex items-center gap-0.5">
<span className="material-symbols-outlined text-[13px]">check_circle</span> 24 Batches
          </span>
</div>
</div>
{/* KPI Card 2 */}
<div className="min-w-[170px] flex-shrink-0 bg-surface-container-low rounded-xl p-space-md shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Features</span>
<span className="material-symbols-outlined text-secondary-fixed text-[18px]">grain</span>
</div>
<div className="flex flex-col">
<span className="font-metric-display text-metric-display text-on-surface leading-tight">142.8<span className="text-sm font-label-md text-secondary">M</span></span>
<span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5 flex items-center gap-0.5">
<span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span> WebEngine Active
          </span>
</div>
</div>
{/* KPI Card 3 */}
<div className="min-w-[170px] flex-shrink-0 bg-surface-container-low rounded-xl p-space-md shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between mb-space-xs">
<span className="font-label-sm text-label-sm uppercase text-on-surface-variant">Constellations</span>
<span className="material-symbols-outlined text-primary-container text-[18px]">sensors</span>
</div>
<div className="flex flex-col">
<span className="font-metric-display text-metric-display text-on-surface leading-tight">12 <span className="text-sm font-label-md text-primary">ORBITS</span></span>
<span className="font-label-sm text-label-sm text-secondary-fixed mt-0.5 flex items-center gap-0.5">
<span className="material-symbols-outlined text-[13px]">radar</span> Sentinel &amp; Landsat
          </span>
</div>
</div>
</div>
</section>
{/* Categorical Filter Pills */}
<section className="flex gap-space-xs overflow-x-auto no-scrollbar -mx-margin-mobile px-margin-mobile">
<button className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-transform active:scale-95 flex-shrink-0">
<span className="w-1.5 h-1.5 rounded-full bg-surface"></span> All (24)
    </button>
<button className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-surface-container-high text-on-surface hover:text-primary transition-colors font-label-sm text-label-sm flex-shrink-0">
<span className="material-symbols-outlined text-[14px]">satellite</span> Satellite &amp; COG (11)
    </button>
<button className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-surface-container-high text-on-surface hover:text-primary transition-colors font-label-sm text-label-sm flex-shrink-0">
<span className="material-symbols-outlined text-[14px]">view_in_ar</span> 3D LiDAR (5)
    </button>
<button className="flex items-center gap-1.5 px-space-md py-1.5 rounded-full bg-surface-container-high text-on-surface hover:text-primary transition-colors font-label-sm text-label-sm flex-shrink-0">
<span className="material-symbols-outlined text-[14px]">polyline</span> Vectors (8)
    </button>
</section>
{/* Project Card Feed */}
<section className="flex flex-col gap-space-md">
<div className="flex items-center justify-between">
<h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Spatial Datasets</h2>
<button className="font-label-sm text-label-sm text-primary-container flex items-center gap-0.5 hover:underline">
        SORT: RECENT <span className="material-symbols-outlined text-[14px]">expand_more</span>
</button>
</div>
{/* Project 1: Fiordland Coastline DEM */}
<article className="bg-surface-container-low rounded-xl overflow-hidden shadow-lg flex flex-col">
<div className="relative w-full h-44 bg-surface-container-highest overflow-hidden">
<img alt="Fiordland Coastline DEM elevation contour bathymetric view" className="w-full h-full object-cover transform transition-transform duration-500 hover:scale-105" src="https://lh3.googleusercontent.com/aida/AEtjO1Ve_aFBtHGaAnbc5OG68VP_OGkUHsBs8j8AkPZ6XP_LzzklCZvfupNsBe1eUYX8ZHM2L5w7FWKLiAdkUF4qGVNXUWCb2ZPxgPzWv_F3AFPjKSq5J1RVHSTWrZEpBT3vXxD5R-1zG67mx_yHGyDCvkKBt8mpzsffb6QaFAg-Oph49PG1Xqx_2AauwO9VEyOvHYAeG3FiWJJM4rpZFgCK3lhznzWtRcj5ZGmbEOGIPvM1C3lfN3s69faJ9Fw"/>
<div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent"></div>
<div className="absolute top-space-sm left-space-sm flex gap-space-xs">
<span className="bg-surface-container-lowest/90 backdrop-blur-md px-space-xs py-0.5 rounded-lg font-label-sm text-label-sm text-primary flex items-center gap-1 shadow-sm">
<span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span> COG • WGS 84
          </span>
<span className="bg-surface-container-lowest/90 backdrop-blur-md px-space-xs py-0.5 rounded-lg font-label-sm text-label-sm text-secondary-fixed">
            UTM Z60S
          </span>
</div>
<div className="absolute bottom-space-xs right-space-sm bg-surface-container-lowest/80 backdrop-blur-sm px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface-variant">
          ELEV: 3,215m • DEPTH: 2,450m
        </div>
</div>
<div className="p-space-md flex flex-col gap-space-sm">
<div className="flex items-start justify-between gap-space-xs">
<div className="flex flex-col min-w-0">
<h3 className="font-headline-md text-headline-md text-on-surface truncate">Fiordland Coastline DEM</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Sub-surface bathymetry &amp; alpine digital elevation model.</p>
</div>
<button aria-label="Project actions" className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
{/* Telemetry Badges */}
<div className="flex flex-wrap gap-space-xs items-center">
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface">Bathymetry 0.5m</span>
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface">4.2M Points</span>
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-secondary flex items-center gap-1">
<span className="material-symbols-outlined text-[12px]">layers</span> Multi-Band
          </span>
</div>
{/* Action Row */}
<div className="pt-space-xs flex items-center justify-between gap-space-sm">
<span className="font-label-sm text-label-sm text-outline">Updated 2h ago</span>
<button className="bg-primary-container text-on-primary-container font-label-md text-label-md px-space-md py-2 rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.25)] hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] transition-all active:scale-95">
<span className="material-symbols-outlined text-[16px]">travel_explore</span>
            Launch Map View
          </button>
</div>
</div>
</article>
{/* Project 2: Tokyo Urban Heat Island */}
<article className="bg-surface-container-low rounded-xl overflow-hidden shadow-lg flex flex-col">
<div className="relative w-full h-44 bg-surface-container-highest overflow-hidden">
<img alt="Tokyo Urban Heat Island thermal anomaly telemetry map" className="w-full h-full object-cover transform transition-transform duration-500 hover:scale-105" src="https://lh3.googleusercontent.com/aida/AEtjO1XXr-7biAk-tRqppNYp2EA6Aj9pAVdJju5jYJA4UnEEBfM86sgs0BEuU6vMkW5IoMa6pjunp3SbDocBai7RtzIqdBdADc5qK6V-Lw2NCJT2fjHKO1Yh-lzkbOUKfjc1VaIcIvrCjZalo2JZHv0vBajsliCX_U5e2Yurz-n8bbjh3d3E5BVCWnvllmXH1cYH_jRd2zvYfmY1nNQoeFHsw-tIzdmVJmsMTHbsKz9NRbHk6u6fvxWhjh8TXSQ"/>
<div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent"></div>
<div className="absolute top-space-sm left-space-sm flex gap-space-xs">
<span className="bg-surface-container-lowest/90 backdrop-blur-md px-space-xs py-0.5 rounded-lg font-label-sm text-label-sm text-error flex items-center gap-1 shadow-sm">
<span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span> THERMAL IR
          </span>
<span className="bg-surface-container-lowest/90 backdrop-blur-md px-space-xs py-0.5 rounded-lg font-label-sm text-label-sm text-on-surface">
            +32°C CORE
          </span>
</div>
<div className="absolute bottom-space-xs right-space-sm bg-surface-container-lowest/80 backdrop-blur-sm px-space-xs py-0.5 rounded font-label-sm text-label-sm text-secondary-fixed">
          SPECTRAL RADIANCE • 8.5µm
        </div>
</div>
<div className="p-space-md flex flex-col gap-space-sm">
<div className="flex items-start justify-between gap-space-xs">
<div className="flex flex-col min-w-0">
<h3 className="font-headline-md text-headline-md text-on-surface truncate">Tokyo Urban Heat Island</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Surface radiant temperature gradients &amp; metropolitan microclimates.</p>
</div>
<button aria-label="Project actions" className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
{/* Telemetry Badges */}
<div className="flex flex-wrap gap-space-xs items-center">
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface">Thermal Grayscale + ColorLUT</span>
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-primary flex items-center gap-1">
<span className="material-symbols-outlined text-[12px]">sensors</span> Live Stream
          </span>
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface-variant">32.4 km²</span>
</div>
{/* Action Row */}
<div className="pt-space-xs flex items-center justify-between gap-space-sm">
<span className="font-label-sm text-label-sm text-outline">Updated 14m ago</span>
<button className="bg-primary-container text-on-primary-container font-label-md text-label-md px-space-md py-2 rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.25)] hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] transition-all active:scale-95">
<span className="material-symbols-outlined text-[16px]">travel_explore</span>
            Launch Map View
          </button>
</div>
</div>
</article>
{/* Project 3: Swiss Alps 3D Glacier */}
<article className="bg-surface-container-low rounded-xl overflow-hidden shadow-lg flex flex-col">
<div className="relative w-full h-44 bg-surface-container-highest overflow-hidden">
<img className="w-full h-full object-cover transform transition-transform duration-500 hover:scale-105" data-alt="Photorealistic aerial 3D LiDAR point cloud visualization of the Swiss Alps Aletsch Glacier, high altitude terrain with neon cyan and amber elevation contour lines flowing down rugged crevasses, dusk alpine atmospheric lighting, cinematic scientific aerospace telemetry HUD style" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCzRcTCaO3gOL31xbsGVUJubvZisvAc5gPR0NnKcwKPVdwKXAx1el95q2Z0kWt5_FHT_6Qyz4VGx8FUHJ8H4GcOJkExhW4TFktZ7YcT79HVx6OFSt8fxUmZ7rlKN86N6e9pTjHBevfNuQbRAmE6FqxKwWdmyPPujWeDBvv44kv-TFbQkiUYCQivoMgIh3NYvz7Fn3kyjTGuMznFiwkbFR5pAPKz8DuIgjlkFInRWEco7A6k6SxR0zjE"/>
<div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-transparent to-transparent"></div>
<div className="absolute top-space-sm left-space-sm flex gap-space-xs">
<span className="bg-surface-container-lowest/90 backdrop-blur-md px-space-xs py-0.5 rounded-lg font-label-sm text-label-sm text-secondary-fixed-dim flex items-center gap-1 shadow-sm">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> 3D LIDAR
          </span>
<span className="bg-surface-container-lowest/90 backdrop-blur-md px-space-xs py-0.5 rounded-lg font-label-sm text-label-sm text-primary">
            60 pts/m²
          </span>
</div>
<div className="absolute bottom-space-xs right-space-sm bg-surface-container-lowest/80 backdrop-blur-sm px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface-variant">
          LAS 1.4 • OCTREE READY
        </div>
</div>
<div className="p-space-md flex flex-col gap-space-sm">
<div className="flex items-start justify-between gap-space-xs">
<div className="flex flex-col min-w-0">
<h3 className="font-headline-md text-headline-md text-on-surface truncate">Swiss Alps 3D Glacier</h3>
<p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">Volumetric cryosphere monitoring &amp; ice-mass equilibrium dynamics.</p>
</div>
<button aria-label="Project actions" className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface">
<span className="material-symbols-outlined text-[18px]">more_vert</span>
</button>
</div>
{/* Telemetry Badges */}
<div className="flex flex-wrap gap-space-xs items-center">
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface">LiDAR Point Cloud</span>
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-on-surface">EPSG:2056</span>
<span className="bg-surface-container-high px-space-xs py-0.5 rounded font-label-sm text-label-sm text-secondary flex items-center gap-1">
<span className="material-symbols-outlined text-[12px]">view_in_ar</span> 84.1M Verts
          </span>
</div>
{/* Action Row */}
<div className="pt-space-xs flex items-center justify-between gap-space-sm">
<span className="font-label-sm text-label-sm text-outline">Updated 1d ago</span>
<button className="bg-primary-container text-on-primary-container font-label-md text-label-md px-space-md py-2 rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,240,255,0.25)] hover:shadow-[0_0_16px_rgba(0,240,255,0.4)] transition-all active:scale-95">
<span className="material-symbols-outlined text-[16px]">travel_explore</span>
            Launch Map View
          </button>
</div>
</div>
</article>
</section>
{/* Quick Floating FAB Action for New Ingestion */}
<div className="sticky bottom-2 flex justify-end z-20 pointer-events-none">
<button className="pointer-events-auto bg-primary text-on-primary font-headline-md text-[14px] px-space-lg py-3 rounded-full shadow-[0_0_20px_rgba(0,240,255,0.45)] flex items-center gap-2 transform transition-transform active:scale-90 hover:scale-105">
<span className="material-symbols-outlined text-[20px] font-bold">add_location_alt</span>
<span>Ingest Dataset</span>
</button>
</div>
</div>
</main><nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface-container-lowest/85 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.5)]" data-active-classes="text-primary-container font-semibold"><div className="flex justify-around items-center h-16 px-space-xs"><Link className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 text-on-surface-variant hover:text-on-surface transition-all" data-path="map-view" to="/workspace"><span className="material-symbols-outlined text-[22px]">public</span><span className="font-label-sm text-label-sm tracking-tight">Map View</span></Link><Link aria-current="page" className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 transition-all text-primary-container font-semibold" data-path="projects" to="/"><span className="material-symbols-outlined text-[22px]">folder_special</span><span className="font-label-sm text-label-sm tracking-tight">Projects</span></Link><Link className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 text-on-surface-variant hover:text-on-surface transition-all" data-path="imports" to="/imports"><span className="material-symbols-outlined text-[22px]">dataset</span><span className="font-label-sm text-label-sm tracking-tight">Datasets</span></Link><Link className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] h-12 text-on-surface-variant hover:text-on-surface transition-all" data-path="profile" to="/settings"><span className="material-symbols-outlined text-[22px]">tune</span><span className="font-label-sm text-label-sm tracking-tight">Profile</span></Link></div></nav>
    </>
  );
}
