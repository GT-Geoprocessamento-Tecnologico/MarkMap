import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useLayoutStore } from "../../lib/store/layout";
import { TopNavBar } from "../TopNavBar";
import { MarkMapBrand } from "../MarkMapBrand";
import { AppIcon, type AppIconName } from "../AppIcon";

const baseLink = "group flex min-h-[44px] items-center gap-3 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-200";
const activeLink = "border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan shadow-[inset_3px_0_0_#00D6DB]";
const inactiveLink = "border-transparent text-on-surface-variant hover:border-white/10 hover:bg-white/5 hover:text-on-surface";

export function RootLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { sidebarOpen, closeSidebar } = useLayoutStore();
  const matches = useRouterState({ select: (state) => state.matches });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const projectId = [...matches]
    .reverse()
    .map((match) => {
      const params: unknown = match.params;
      if (typeof params === "object" && params !== null && "projectId" in params) {
        const value = params.projectId;
        return typeof value === "string" ? value : undefined;
      }
      return undefined;
    })
    .find((value): value is string => value !== undefined);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen, closeSidebar]);

  const closeOnMobile = () => {
    if (window.innerWidth < 1024) closeSidebar();
  };

  const icon = (name: AppIconName) => <AppIcon name={name} />;

  if (pathname === "/install") return <Outlet />;

  return (
    <div className="markmap-shell flex h-[100dvh] min-h-[100dvh] min-w-0 overflow-hidden bg-background font-sans text-on-surface selection:bg-primary/20">
      {sidebarOpen && <button type="button" className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={closeSidebar} aria-label="Fechar navegação lateral" />}

      <aside
        id="sidebar"
        className={`markmap-shell-sidebar fixed left-0 top-0 z-50 flex h-[100dvh] max-w-[calc(100vw-1rem)] flex-col border-r border-outline-variant bg-sidebar/95 p-3 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xl transition-[transform,width] duration-300 lg:translate-x-0 lg:z-40 ${sidebarOpen ? "w-72 translate-x-0 visible pointer-events-auto" : "w-72 -translate-x-full invisible pointer-events-none lg:visible lg:pointer-events-auto"} ${collapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          <Link to="/" onClick={closeOnMobile} className="min-w-0 no-underline" aria-label="MarkMap — Planejamento Inteligente">
            <MarkMapBrand compact={collapsed} ariaLabel="MarkMap — Planejamento Inteligente" />
          </Link>
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:border-primary/40 hover:text-primary lg:flex" aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
            {icon(collapsed ? "expand" : "collapse")}
          </button>
          <button type="button" onClick={closeSidebar} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant lg:hidden" aria-label="Fechar menu">{icon("close")}</button>
        </div>

        <nav aria-label="Navegação principal" className="mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <Link to="/" title="Visão geral" activeOptions={{ exact: true }} activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("dashboard")}{!collapsed && <span>Visão geral</span>}</Link>
          <Link to="/projects" title="Projetos" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("projects")}{!collapsed && <span>Projetos</span>}</Link>
          <Link to="/workspace" title="Mapa" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("map")}{!collapsed && <span>Mapa</span>}</Link>
          <Link to="/imports" title="Dados" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("data")}{!collapsed && <span>Dados</span>}</Link>
          {projectId ? (
            <Link to="/projects/$projectId/mesh" params={{ projectId }} aria-label="Estúdio de Malhas 3D" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("mesh")}{!collapsed && <span>Malhas 3D</span>}</Link>
          ) : (
            <Link to="/mesh" aria-label="Estúdio de Malhas 3D" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("mesh")}{!collapsed && <span>Malhas 3D</span>}</Link>
          )}
          <Link to="/coordinate-systems" title="Sistemas de coordenadas" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("coordinates")}{!collapsed && <span>Sistemas de coordenadas</span>}</Link>
          <Link to="/analytics" title="Análises" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("analytics")}{!collapsed && <span>Análises</span>}</Link>
          <Link to="/settings" title="Configurações" activeProps={{ className: activeLink }} inactiveProps={{ className: inactiveLink }} className={baseLink} onClick={closeOnMobile}>{icon("settings")}{!collapsed && <span>Configurações</span>}</Link>
        </nav>

        <div className="border-t border-outline-variant pt-3">
          {!collapsed ? (
            <div className="space-y-2 px-2">
              <p className="text-[10px] leading-relaxed text-on-surface-variant">Desenvolvido por <a href="https://mtsferreira.dev" target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">MtsFerreira</a></p>
            </div>
          ) : (
            <a href="https://mtsferreira.dev" target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center text-xs font-black text-primary" aria-label="Desenvolvido por MtsFerreira">MF</a>
          )}
        </div>
      </aside>

      <main className={`markmap-app-main relative ml-0 flex h-full min-w-0 flex-1 flex-col overflow-y-auto transition-[margin] duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-72"}`}>
        <TopNavBar />
        <Outlet />
      </main>
    </div>
  );
}
