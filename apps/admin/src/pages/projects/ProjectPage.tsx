import { Link, useParams } from "@tanstack/react-router";
import { Button, Skeleton } from "@geonexo/ui";
import { useProject } from "../../lib/hooks/projects";
import { useProjectLayers } from "../../lib/hooks/layers";

export default function ProjectPage() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const { data: project, isLoading, isError } = useProject(projectId);
  const layersQuery = useProjectLayers(projectId, { limit: 100 });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-xl border border-error/30 bg-error/5 p-6 text-on-surface">
        <div className="text-center">
          <p>Projeto local não encontrado.</p>
          <Link to="/projects" className="mt-4 inline-flex">
            <Button variant="secondary">Voltar para Projetos</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-background p-6 text-on-surface">
      <Link to="/projects" className="inline-flex text-sm font-medium text-cyan-500 hover:text-cyan-400">
        ← Voltar para Projetos
      </Link>

      <section className="rounded-xl border border-outline-variant bg-surface-container p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {project.description ?? "Sem descrição."}
            </p>
          </div>
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-500">
            {project.status}
          </span>
        </div>
        <p role="status" className="mt-4 rounded-lg bg-background p-3 text-sm text-on-surface-variant">
          Projeto salvo neste dispositivo. A sincronização com servidor ainda não está ativa.
        </p>
      </section>

      <section className="rounded-xl border border-outline-variant bg-surface-container p-6">
        <h2 className="text-lg font-semibold">Camadas do projeto</h2>
        {layersQuery.isLoading ? (
          <p role="status" className="mt-2 text-sm text-on-surface-variant">Carregando camadas locais…</p>
        ) : layersQuery.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            Não foi possível carregar as camadas locais.
            <button type="button" className="ml-2 underline" onClick={() => void layersQuery.refetch()}>Tentar novamente</button>
          </p>
        ) : layersQuery.data?.items.length === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">
            Ainda não há camadas neste projeto local. Você já pode importar GeoJSON e visualizá-lo no mapa.
          </p>
        ) : (
          <>
            <ul aria-label="Camadas locais do projeto" className="mt-3 space-y-2">
              {layersQuery.data?.items.map((layer) => (
                <li key={layer.id} className="rounded-lg border border-outline-variant bg-background p-3 text-sm">
                  <span className="font-semibold">{layer.name}</span>
                  <span className="ml-2 text-on-surface-variant">{layer.geometryType ?? layer.kind}</span>
                </li>
              ))}
            </ul>
            {layersQuery.data?.nextCursor && (
              <p role="status" className="mt-2 text-xs text-on-surface-variant">
                Resumo parcial: até 100 camadas deste projeto.
              </p>
            )}
          </>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/imports">
            <Button variant="primary">Importar dados</Button>
          </Link>
          <Link to="/workspace">
            <Button variant="secondary">Abrir mapa</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
