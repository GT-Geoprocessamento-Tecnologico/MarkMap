import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProjectPages } from "../../lib/hooks/projects";

export function MobileDashboard({ desktop = false }: { desktop?: boolean }) {
  const projectsQuery = useProjectPages();
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(true);

  const projects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (projectsQuery.data?.items ?? []).filter(
      (project) =>
        project.name.toLowerCase().includes(needle) ||
        (project.description ?? "").toLowerCase().includes(needle),
    );
    return [...filtered].sort((a, b) => {
      const result = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return sortNewest ? result : -result;
    });
  }, [projectsQuery.data?.items, search, sortNewest]);

  const loadedCount = projectsQuery.data?.items.length ?? 0;

  return (
    <section className={`markmap-dashboard min-w-0 bg-background px-4 py-6 md:px-8 md:py-8 ${desktop ? "" : "pb-[calc(7rem+env(safe-area-inset-bottom))]"}`}>
      <div className="mx-auto flex w-full max-w-[1500px] min-w-0 flex-col">
        <header className="border-b border-outline-variant pb-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Workspace local</p>
              <h1 className="text-3xl font-bold tracking-[-0.035em] text-on-surface md:text-4xl">Projetos</h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">Acesse o trabalho salvo neste dispositivo e continue operando mesmo sem conexão.</p>
            </div>
            <Link to="/projects" className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan px-5 text-sm font-bold text-white shadow-[0_10px_30px_-18px_rgba(0,117,214,.75)]">Gerenciar projetos</Link>
          </div>

          <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 border-t border-outline-variant pt-5 text-sm">
            <div><dt className="text-xs text-on-surface-variant">Projetos carregados</dt><dd className="mt-1 text-xl font-bold text-on-surface">{projectsQuery.isLoading ? "—" : loadedCount}</dd></div>
            <div><dt className="text-xs text-on-surface-variant">Operação</dt><dd className="mt-1 flex items-center gap-2 font-bold text-on-surface"><span className="h-2 w-2 rounded-full bg-secondary" />Offline-first</dd></div>
            <div><dt className="text-xs text-on-surface-variant">Modelagem</dt><dd className="mt-1"><Link to="/mesh" className="font-bold text-primary hover:underline">Abrir Malhas 3D</Link></dd></div>
          </dl>
        </header>

        <section className="py-6" aria-labelledby="project-list-title">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 id="project-list-title" className="text-lg font-bold text-on-surface">Projetos neste dispositivo</h2>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl lg:justify-end">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Buscar projetos</span>
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: "18px" }} aria-hidden="true">search</span>
                <input aria-label="Buscar projetos" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou descrição" className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-surface-container pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary" />
              </label>
              <button type="button" aria-label={sortNewest ? "Ordenar por mais antigos" : "Ordenar por mais recentes"} onClick={() => setSortNewest((value) => !value)} className="min-h-[44px] rounded-xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface hover:border-primary/40">{sortNewest ? "Mais recentes" : "Mais antigos"}</button>
            </div>
          </div>

          {projectsQuery.hasNextPage && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
              <span>A busca considera os projetos já carregados.</span>
              <button disabled={projectsQuery.isFetchingNextPage || projectsQuery.isError} onClick={() => void projectsQuery.fetchNextPage()} className="min-h-[44px] rounded-xl border border-outline-variant px-4 font-semibold text-primary disabled:opacity-50">{projectsQuery.isFetchingNextPage ? "Carregando…" : "Carregar mais"}</button>
            </div>
          )}

          {projectsQuery.isLoading && (
            <div className="mt-6 space-y-3" role="status" aria-label="Carregando projetos">
              {[1,2,3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-surface-container" />)}
            </div>
          )}
          {projectsQuery.isError && <p role="alert" className="mt-6 border-l-2 border-error bg-error/5 p-4 text-sm text-error">Não foi possível carregar os projetos salvos neste dispositivo.</p>}
          {!projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0 && (
            <div className="mt-6 border-y border-outline-variant py-10 text-center">
              <p className="font-bold text-on-surface">Nenhum projeto encontrado</p>
              <p className="mt-2 text-sm text-on-surface-variant">{search ? "Ajuste a busca para ver outros projetos." : "Crie seu primeiro projeto para começar a mapear."}</p>
              <Link to="/projects" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan px-5 text-sm font-bold text-white">Ir para projetos</Link>
            </div>
          )}

          {!projectsQuery.isLoading && !projectsQuery.isError && projects.length > 0 && (
            <div className="mt-6 border-t border-outline-variant">
              {projects.map((project) => (
                <article key={project.id} className="grid gap-4 border-b border-outline-variant py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/projects/$projectId" params={{ projectId: project.id }} className="min-w-0 truncate text-base font-bold text-on-surface hover:text-primary">{project.name}</Link>
                      <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">{project.status}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">{project.description ?? "Sem descrição"}</p>
                    <p className="mt-2 text-[11px] text-on-surface-variant">Atualizado em {new Date(project.updatedAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Link to="/projects/$projectId" params={{ projectId: project.id }} className="inline-flex min-h-[44px] items-center rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface hover:border-primary/40">Detalhes</Link>
                    <Link to="/projects/$projectId/map" params={{ projectId: project.id }} className="inline-flex min-h-[44px] items-center rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan px-4 text-sm font-bold text-white">Abrir mapa</Link>
                    <Link to="/projects/$projectId/mesh" params={{ projectId: project.id }} className="inline-flex min-h-[44px] items-center rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface hover:border-secondary/50">Malha 3D</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="border-t border-outline-variant pt-6">
          <Link to="/imports" className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-cyan px-5 text-sm font-bold text-white"><span className="material-symbols-outlined" style={{ fontSize: "18px" }} aria-hidden="true">upload_file</span>Importar conjunto de dados</Link>
        </div>
      </div>

      {!desktop && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 grid min-h-16 grid-cols-4 border-t border-outline-variant bg-surface-container/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl" aria-label="Navegação móvel">
          <Link to="/workspace" className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] text-on-surface-variant"><span className="material-symbols-outlined" style={{ fontSize: "19px" }} aria-hidden="true">map</span>Mapa</Link>
          <Link to="/" className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] font-bold text-primary"><span className="material-symbols-outlined" style={{ fontSize: "19px" }} aria-hidden="true">folder</span>Projetos</Link>
          <Link to="/imports" className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] text-on-surface-variant"><span className="material-symbols-outlined" style={{ fontSize: "19px" }} aria-hidden="true">database</span>Dados</Link>
          <Link to="/settings" className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] text-on-surface-variant"><span className="material-symbols-outlined" style={{ fontSize: "19px" }} aria-hidden="true">settings</span>Ajustes</Link>
        </nav>
      )}
    </section>
  );
}
