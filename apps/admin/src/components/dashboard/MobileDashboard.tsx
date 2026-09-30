import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProjectPages } from "../../lib/hooks/projects";

export function MobileDashboard({ desktop = false }: { desktop?: boolean }) {
  const projectsQuery = useProjectPages();
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(true);
  const projects = useMemo(() => {
    const filtered = (projectsQuery.data?.items ?? []).filter(
      (project) =>
        project.name.toLowerCase().includes(search.toLowerCase()) ||
        (project.description ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const result =
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return sortNewest ? result : -result;
    });
  }, [projectsQuery.data?.items, search, sortNewest]);

  return (
    <section
      className={`min-w-0 bg-background p-4 md:p-8 ${desktop ? "" : "pb-[calc(7rem+env(safe-area-inset-bottom))]"}`}
    >
      <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-6">
        <section className="flex items-center justify-between rounded-xl bg-surface-container-low px-space-md py-space-sm shadow-md">
          <div>
            <p className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface">
              GeoNexo
            </p>
            <p className="text-xs text-on-surface-variant">Workspace local</p>
          </div>
          <Link
            to="/settings"
            className="min-h-[44px] rounded-lg px-3 py-2 text-sm text-primary"
          >
            Configurações
          </Link>
        </section>

        <section
          className="grid grid-cols-2 gap-space-sm"
          aria-label="Resumo dos projetos"
        >
          <div className="rounded-xl bg-surface-container-low p-space-md">
            <p className="text-xs text-on-surface-variant">
              Projetos carregados
            </p>
            <p className="mt-1 text-2xl font-bold text-on-surface">
              {projectsQuery.data?.items.length ?? "—"}
            </p>
          </div>
          <Link
            to="/mesh"
            className="min-h-[44px] rounded-xl bg-surface-container-low p-space-md"
          >
            <p className="text-xs text-on-surface-variant">Modelos locais</p>
            <p className="mt-1 text-2xl font-bold text-on-surface">Malhas 3D</p>
          </Link>
        </section>

        <section
          className="flex min-w-0 flex-col gap-3"
          aria-labelledby="mobile-projects-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1
              id="mobile-projects-title"
              className="text-xl font-bold text-on-surface"
            >
              Projetos
            </h1>
            <Link
              to="/projects"
              className="min-h-[44px] rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
            >
              Gerenciar
            </Link>
          </div>
          <input
            aria-label="Buscar projetos"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar projetos…"
            className="min-h-[44px] w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-sm text-on-surface"
          />
          <button
            type="button"
            onClick={() => setSortNewest((value) => !value)}
            className="min-h-[44px] self-start text-sm text-primary"
          >
            Ordenar: {sortNewest ? "mais recentes" : "mais antigos"}
          </button>
          {projectsQuery.hasNextPage && (
            <div className="text-sm">
              <p>A busca considera os projetos carregados.</p>
              <button
                disabled={
                  projectsQuery.isFetchingNextPage || projectsQuery.isError
                }
                onClick={() => void projectsQuery.fetchNextPage()}
                className="rounded-lg border border-outline-variant px-3 py-2"
              >
                {projectsQuery.isFetchingNextPage
                  ? "Carregando…"
                  : "Carregar mais projetos"}
              </button>
            </div>
          )}

          {projectsQuery.isLoading && (
            <p className="text-sm text-on-surface-variant">
              Carregando projetos…
            </p>
          )}
          {projectsQuery.isError && (
            <p role="alert" className="text-sm text-error">
              Não foi possível carregar os projetos.
            </p>
          )}
          {!projectsQuery.isLoading &&
            !projectsQuery.isError &&
            projects.length === 0 && (
              <p className="rounded-xl border border-outline-variant p-4 text-sm text-on-surface-variant">
                Nenhum projeto encontrado. Crie um projeto para começar.
              </p>
            )}
          <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="min-w-0 rounded-xl bg-surface-container-low p-space-md shadow-sm"
              >
                <h2 className="truncate text-base font-semibold text-on-surface">
                  {project.name}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                  {project.description ?? "Sem descrição"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface"
                  >
                    Detalhes
                  </Link>
                  <Link
                    to="/projects/$projectId/map"
                    params={{ projectId: project.id }}
                    className="min-h-[44px] rounded-lg border border-primary px-3 py-2 text-sm text-primary"
                  >
                    Mapa
                  </Link>
                  <Link
                    to="/projects/$projectId/mesh"
                    params={{ projectId: project.id }}
                    className="min-h-[44px] rounded-lg border border-secondary px-3 py-2 text-sm text-secondary"
                  >
                    Malha 3D
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <Link
          to="/imports"
          className="flex min-h-[48px] items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
        >
          Importar conjunto de dados
        </Link>
      </div>
      {!desktop && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex min-h-16 items-center justify-around bg-surface-container-lowest/90 px-space-xs pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
          aria-label="Navegação móvel"
        >
          <Link
            className="flex min-w-[56px] min-h-[44px] items-center justify-center text-sm text-on-surface-variant"
            to="/workspace"
          >
            Mapa
          </Link>
          <Link
            className="flex min-w-[56px] min-h-[44px] items-center justify-center text-sm font-semibold text-primary"
            to="/"
          >
            Projetos
          </Link>
          <Link
            className="flex min-w-[56px] min-h-[44px] items-center justify-center text-sm text-on-surface-variant"
            to="/imports"
          >
            Dados
          </Link>
          <Link
            className="flex min-w-[56px] min-h-[44px] items-center justify-center text-sm text-on-surface-variant"
            to="/settings"
          >
            Ajustes
          </Link>
        </nav>
      )}
    </section>
  );
}
