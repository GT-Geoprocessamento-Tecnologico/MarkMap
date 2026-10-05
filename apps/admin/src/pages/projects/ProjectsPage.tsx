import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Input,
  Skeleton,
  useToast,
} from "@geonexo/ui";
import { useCreateProject, useProjectPages } from "../../lib/hooks/projects";

export default function ProjectsPage() {
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProjectPages();
  const createProjectMutation = useCreateProject();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");

  const projects = (data?.items ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase() ?? "").includes(search.toLowerCase()),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createProjectMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast({
        title: "Projeto criado!",
        description: `"${name}" foi salvo neste dispositivo e aguarda sincronização.`,
      });
      setName("");
      setDescription("");
      setIsOpen(false);
    } catch (err) {
      toast({
        title: "Erro ao criar projeto",
        description:
          err instanceof Error ? err.message : "Falha ao salvar projeto.",
        variant: "error",
      });
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-background p-6 text-on-surface">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">
            Projetos Cartográficos
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Gerencie os projetos de mapeamento, levantamentos e conjuntos de
            camadas geoespaciais.
          </p>
          <p className="mt-2 text-xs text-primary">
            Os projetos são salvos neste dispositivo e sincronizados quando houver conexão.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-brand-blue to-brand-cyan text-white font-bold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              variant="primary"
            >
              + Criar Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface-container border-outline-variant text-on-surface shadow-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle className="text-on-surface text-xl">
                  Novo Projeto Cartográfico
                </DialogTitle>
                <DialogDescription className="text-on-surface-variant">
                  Informe os detalhes para iniciar um novo projeto na MarkMap.
                </DialogDescription>
              </DialogHeader>

              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="new-project-name" className="block text-sm font-medium text-on-surface-variant">
                    Nome do Projeto *
                  </label>
                  <Input
                    id="new-project-name"
                    placeholder="Ex: Levantamento Região Norte"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-background border-outline-variant text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/60 focus:ring-primary/15"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-on-surface-variant">
                    Descrição
                  </label>
                  <Input
                    aria-label="Descrição do projeto"
                    placeholder="Ex: Mapeamento de quadras e pontos de controle"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-background border-outline-variant text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/60 focus:ring-primary/15"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={createProjectMutation.isPending}
                  className="bg-primary text-white font-bold hover:brightness-110 transition-colors"
                >
                  Salvar Projeto
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-4">
        <Input
          aria-label="Buscar projetos na lista carregada"
          placeholder="Buscar projetos por nome ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md bg-surface-container border-outline-variant text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/60 focus:ring-primary/15"
        />
      </div>

      {hasNextPage && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p>Há mais projetos. A busca considera os projetos carregados.</p>
          <Button
            disabled={isFetchingNextPage || isError}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? "Carregando…" : "Carregar mais projetos"}
          </Button>
        </div>
      )}

      {/* Conteudo Principal */}
      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container p-6">
          <Skeleton className="h-12 w-full bg-white/5" />
          <Skeleton className="h-12 w-full bg-white/5" />
          <Skeleton className="h-12 w-full bg-white/5" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
          Falha ao carregar os projetos salvos neste dispositivo.
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto encontrado"
          description={
            search
              ? "Nenhum resultado corresponde à sua busca."
              : "Comece criando seu primeiro projeto cartográfico."
          }
          action={
            <Button
              variant="primary"
              onClick={() => setIsOpen(true)}
              className="bg-gradient-to-r from-brand-blue to-brand-cyan text-white font-bold"
            >
              + Criar Primeiro Projeto
            </Button>
          }
        />
      ) : (
        <div
          className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3"
          aria-label="Projetos carregados"
        >
          {projects.map((project) => (
            <article
              key={project.id}
              className="min-w-0 rounded-xl border border-outline-variant bg-surface-container p-4 shadow-sm"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="min-w-0 break-words font-semibold text-primary"
                >
                  {project.name}
                </Link>
                <span className="shrink-0 rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary">
                  {project.status}
                </span>
              </div>
              <p className="mt-2 break-words text-sm text-on-surface-variant">
                {project.description ?? "Sem descrição"}
              </p>
              <p className="mt-2 text-xs text-on-surface-variant">
                Atualizado em {new Date(project.updatedAt).toLocaleDateString("pt-BR")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="flex min-h-[44px] items-center rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant"
                >
                  Abrir projeto
                </Link>
                <Link
                  to="/projects/$projectId/map"
                  params={{ projectId: project.id }}
                  className="flex min-h-[44px] items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
                >
                  Abrir mapa
                </Link>
                <Link
                  to="/projects/$projectId/mesh"
                  params={{ projectId: project.id }}
                  className="flex min-h-[44px] items-center rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant"
                >
                  Malha 3D
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
