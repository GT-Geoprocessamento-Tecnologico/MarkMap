import { useState } from 'react';
import { Link } from '@tanstack/react-router';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@geonexo/ui';
import { useCreateProject, useProjects } from '../../lib/hooks/projects';

export default function ProjectsPage() {
  const { data, isLoading, isError } = useProjects();
  const createProjectMutation = useCreateProject();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');

  const projects = (data?.items ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description?.toLowerCase() ?? '').includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createProjectMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast({ title: 'Projeto criado!', description: `Projeto "${name}" foi criado com sucesso.` });
      setName('');
      setDescription('');
      setIsOpen(false);
    } catch (err) {
      toast({
        title: 'Erro ao criar projeto',
        description: err instanceof Error ? err.message : 'Falha ao salvar projeto.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-background p-6 text-on-surface">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Projetos Cartográficos</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Gerencie os projetos de mapeamento, levantamentos e conjuntos de camadas geoespaciais.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold hover:from-cyan-400 hover:to-cyan-300 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              variant="primary"
            >
              + Criar Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-surface-container border-outline-variant text-on-surface shadow-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle className="text-on-surface text-xl">Novo Projeto Cartográfico</DialogTitle>
                <DialogDescription className="text-on-surface-variant">
                  Informe os detalhes para iniciar um novo projeto no GeoNexo.
                </DialogDescription>
              </DialogHeader>

              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-on-surface-variant">Nome do Projeto *</label>
                  <Input
                    placeholder="Ex: Levantamento Região Norte"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-background border-outline-variant text-on-surface placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-on-surface-variant">Descrição</label>
                  <Input
                    placeholder="Ex: Mapeamento de quadras e pontos de controle"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-background border-outline-variant text-on-surface placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
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
                  className="bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
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
          placeholder="Buscar projetos por nome ou descrição..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md bg-surface-container border-outline-variant text-on-surface placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
        />
      </div>

      {/* Conteudo Principal */}
      {isLoading ? (
        <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container p-6">
          <Skeleton className="h-12 w-full bg-white/5" />
          <Skeleton className="h-12 w-full bg-white/5" />
          <Skeleton className="h-12 w-full bg-white/5" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
          Falha ao carregar a lista de projetos da API.
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto encontrado"
          description={search ? 'Nenhum resultado corresponde à sua busca.' : 'Comece criando seu primeiro projeto cartográfico.'}
          action={
            <Button
              variant="primary"
              onClick={() => setIsOpen(true)}
              className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold"
            >
              + Criar Primeiro Projeto
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-outline-variant bg-surface-container shadow-2xl backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <Table className="min-w-[800px]" aria-label="Lista de projetos cartográficos">
              <TableHeader className="bg-white/5">
                <TableRow className="border-outline-variant hover:bg-white/5">
                  <TableHead className="text-on-surface-variant font-medium">Nome do Projeto</TableHead>
                  <TableHead className="text-on-surface-variant font-medium">Descrição</TableHead>
                  <TableHead className="text-on-surface-variant font-medium">Status</TableHead>
                  <TableHead className="text-on-surface-variant font-medium">Atualizado Em</TableHead>
                  <TableHead className="text-right text-on-surface-variant font-medium">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} className="border-outline-variant/50 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-semibold text-on-surface">
                      <Link
                        to="/projects/$projectId"
                        params={{ projectId: project.id }}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {project.description ?? 'Sem descrição'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        {project.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                          <Button variant="ghost" size="sm" className="min-h-[44px] flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/10">Ver Camadas</Button>
                        </Link>
                        <Link to="/projects/$projectId/map" params={{ projectId: project.id }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="min-h-[44px] flex items-center justify-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
                          >
                            Abrir Mapa &rarr;
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
