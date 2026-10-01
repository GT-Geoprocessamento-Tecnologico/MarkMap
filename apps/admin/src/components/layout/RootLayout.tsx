import React, { useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useLayoutStore } from '../../lib/store/layout';
import { TopNavBar } from '../TopNavBar';

export function RootLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { sidebarOpen, closeSidebar } = useLayoutStore();
  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeSidebar(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen, closeSidebar]);
  const matches = useRouterState({ select: (state) => state.matches });
  const projectId = [...matches]
    .reverse()
    .map((match) => {
      const params: unknown = match.params;
      if (typeof params === 'object' && params !== null && 'projectId' in params) {
        const value = params.projectId;
        return typeof value === 'string' ? value : undefined;
      }
      return undefined;
    })
    .find((value): value is string => value !== undefined);

  return (
    <div className="flex min-h-[100dvh] h-[100dvh] min-w-0 bg-background overflow-hidden selection:bg-primary/20 font-sans text-on-surface transition-colors duration-300">
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden transition-opacity"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* SIDE NAVIGATION */}
      <aside
        id="sidebar"
        className={`fixed top-0 left-0 h-[100dvh] max-w-[calc(100vw-1rem)] bg-sidebar backdrop-blur-xl border-r border-outline-variant/50 z-50 flex flex-col justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-hidden transition-all duration-300
        ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
        lg:translate-x-0 lg:z-40 ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Top Branding & Navigation */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden">
          {/* Brand Anchor with Sidebar Collapse Toggle */}
          <div className="flex items-center justify-between px-1 py-1">
              <div className={`flex items-center gap-3 transition-opacity ${isSidebarCollapsed ? 'lg:opacity-0 lg:hidden' : 'opacity-100'}`}>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 border border-cyan-500/30 flex items-center justify-center relative overflow-hidden shadow-inner shadow-cyan-500/20">
                <span className="material-symbols-outlined text-cyan-400" style={{fontSize: "22px"}}>explore</span>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold tracking-tight text-on-surface text-base">GeoNexo</span>
                  <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">PRO</span>
                </div>
                <span className="font-mono text-[11px] text-on-surface-variant leading-tight">Orbital Core</span>
              </div>
            </div>
            {/* Modern Collapse / Expand Toggle Button */}
            <button 
              id="sidebar-toggle" 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title="Toggle sidebar" 
              className={`hidden lg:flex p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border border-outline-variant/50 hover:border-cyan-500/40 transition-colors items-center justify-center ${isSidebarCollapsed ? 'mx-auto' : ''}`}
            >
              <span className="material-symbols-outlined" style={{fontSize: "18px"}}>{isSidebarCollapsed ? 'menu' : 'dock_to_right'}</span>
            </button>
            {/* Mobile Close Button */}
            <button 
              onClick={closeSidebar}
              aria-label="Fechar menu"
              className="lg:hidden min-h-[44px] min-w-[44px] p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined" style={{fontSize: "18px"}}>close</span>
            </button>
          </div>
          
          {/* Main Navigation Menu */}
          <nav aria-label="Navegação principal" className="flex min-h-0 flex-col gap-1 overflow-y-auto overflow-x-hidden pt-1">
            <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeOptions={{ exact: true }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400 group-[.font-semibold]:text-cyan-400" style={{fontSize: "18px"}} title="Camadas Espaciais">layers</span>
              <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Camadas Espaciais</span>
            </Link>
            <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/imports">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}} title="Conjuntos de Dados">dataset</span>
              <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Conjuntos de Dados</span>
            </Link>
            {projectId && (
              <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/projects/$projectId/mesh" params={{ projectId }}>
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}} title="Estúdio de Malhas 3D">view_in_ar</span>
                <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Estúdio de Malhas 3D</span>
              </Link>
            )}
            {!projectId && (
              <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/mesh">
                <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}}>view_in_ar</span>
                <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Estúdio de Malhas 3D</span>
              </Link>
            )}
            <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/projects">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}} title="Projetos">folder</span>
              <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Projetos</span>
            </Link>
            <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/coordinate-systems">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}} title="Sistemas de Coordenadas">explore</span>
              <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Sistemas de Coordenadas</span>
            </Link>
            <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/analytics">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}} title="Análises">analytics</span>
              <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Análises</span>
            </Link>
            <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/telemetry">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}} title="Telemetria">satellite_alt</span>
              <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Telemetria</span>
            </Link>
            <Link onClick={() => { if(window.innerWidth < 1024) closeSidebar(); }} activeProps={{ className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 font-semibold" }} inactiveProps={{ className: "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 border-transparent" }} className="flex items-center gap-3 px-3 py-2 rounded-lg border text-xs transition-colors group" to="/settings">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-cyan-400" style={{fontSize: "18px"}} title="Configurações">settings</span>
              <span className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>Configurações</span>
            </Link>
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={`min-w-0 flex-1 h-full overflow-y-auto flex flex-col relative transition-all duration-300 ml-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <TopNavBar />
        <Outlet />
      </main>
    </div>
  );
}
