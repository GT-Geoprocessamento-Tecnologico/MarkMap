import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
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
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@geonexo/ui';
import { useProject } from '../../lib/hooks/projects';
import { useCreateLayer, useProjectLayers } from '../../lib/hooks/layers';

export default function ProjectPage() {
  const { projectId } = useParams({ from: '/projects/$projectId' });
  const { data: project, isLoading: isProjectLoading, isError: isProjectError } = useProject(projectId);
  const { data: layersData, isLoading: isLayersLoading } = useProjectLayers(projectId);
  const createLayerMutation = useCreateLayer(projectId);
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [layerName, setLayerName] = useState('');
  const [geometryType, setGeometryType] = useState<'Point' | 'LineString' | 'Polygon'>('Point');

  const layers = layersData?.items ?? [];

  const handleCreateLayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!layerName.trim()) return;

    const kindMap: Record<'Point' | 'LineString' | 'Polygon', 'point' | 'line' | 'polygon'> = {
      Point: 'point',
      LineString: 'line',
      Polygon: 'polygon',
    };

    try {
      await createLayerMutation.mutateAsync({
        name: layerName.trim(),
        description: undefined,
        kind: kindMap[geometryType],
        geometryType,
        srid: 4674,
        style: {},
        metadata: {},
        visibleByDefault: true,
        sortOrder: 0,
      });

      toast({ title: 'Camada criada!', description: `Camada "${layerName}" (${geometryType}) foi adicionada.` });
      setLayerName('');
      setIsOpen(false);
    } catch (err) {
      toast({
        title: 'Erro ao criar camada',
        description: err instanceof Error ? err.message : 'Falha ao salvar camada.',
        variant: 'error',
      });
    }
  };

  if (isProjectLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isProjectError || !project) {
    return (
      <div className="min-h-screen bg-background text-on-surface p-6 rounded-xl border border-error/30 bg-error/5 flex items-center justify-center">
        Projeto não encontrado.
        <div className="mt-4">
          <Link to="/projects" className="text-cyan-400 hover:text-cyan-300">
            <Button variant="secondary">&larr; Voltar para Projetos</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface p-6 space-y-6">
      {/* Voltar */}
      <Link to="/projects" className="inline-flex items-center text-sm font-medium text-cyan-400 hover:text-cyan-300">
        &larr; Voltar para Projetos
      </Link>

      {/* Header do Projeto */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">{project.name}</h1>
            <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              {project.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            {project.description ?? 'Sem descrição declarada.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                variant="primary"
                className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-lg transition-all"
              >
                + Nova Camada
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-surface-container border-outline-variant text-on-surface shadow-2xl">
              <form onSubmit={handleCreateLayer}>
                <DialogHeader>
                  <DialogTitle className="text-on-surface text-xl">Nova Camada Vetorial</DialogTitle>
                  <DialogDescription className="text-on-surface-variant">
                    Adicione uma camada vetorial (Pontos, Linhas ou Polígonos) a este projeto.
                  </DialogDescription>
                </DialogHeader>

                <div className="my-6 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-on-surface">Nome da Camada *</label>
                    <Input
                      placeholder="Ex: Pontos de Coleta"
                      value={layerName}
                      onChange={(e) => setLayerName(e.target.value)}
                      required
                      
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-on-surface">Tipo de Geometria *</label>
                    <Select
                      label="Tipo de Geometria *"
                      value={geometryType}
                      onValueChange={(val) => setGeometryType(val as 'Point' | 'LineString' | 'Polygon')}
                      options={[
                        { value: 'Point', label: 'Pontos (Point)' },
                        { value: 'LineString', label: 'Linhas (LineString)' },
                        { value: 'Polygon', label: 'Polígonos (Polygon)' },
                      ]}
                      
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
                    loading={createLayerMutation.isPending}
                    className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-lg transition-all"
                  >
                    Criar Camada
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Link to="/projects/$projectId/map" params={{ projectId }} className="text-cyan-400 hover:text-cyan-300">
            <Button variant="secondary">Abrir no Mapa &rarr;</Button>
          </Link>
        </div>
      </div>

      {/* Camadas do Projeto */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-on-surface">Camadas Vetoriais ({layers.length})</h2>

        {isLayersLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : layers.length === 0 ? (
          <EmptyState
            title="Nenhuma camada cadastrada"
            description="Crie a primeira camada deste projeto para começar a desenhar feições e carregar dados."
            action={
              <Button
                variant="primary"
                onClick={() => setIsOpen(true)}
                className="bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-lg transition-all"
              >
                + Criar Primeira Camada
              </Button>
            }
          />
        ) : (
          <div className="rounded-xl border border-outline-variant bg-surface-container shadow-sm">
            <Table aria-label="Camadas do projeto">
              <TableHeader className="bg-white/5">
                <TableRow className="border-outline-variant hover:bg-white/5">
                  <TableHead className="text-on-surface-variant font-medium">Nome da Camada</TableHead>
                  <TableHead className="text-on-surface-variant font-medium">Tipo Geométrico</TableHead>
                  <TableHead className="text-on-surface-variant font-medium">SRID</TableHead>
                  <TableHead className="text-on-surface-variant font-medium">Visível</TableHead>
                  <TableHead className="text-right text-on-surface-variant font-medium">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {layers.map((layer) => (
                  <TableRow key={layer.id} className="border-outline-variant/50 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-semibold text-on-surface">{layer.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-on-surface-variant border border-outline-variant">
                        {layer.geometryType ?? layer.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-on-surface-variant">EPSG:{layer.srid}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        Sim
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to="/projects/$projectId/map" params={{ projectId }} className="text-cyan-400 hover:text-cyan-300">
                        <Button variant="ghost" size="sm">Ver no Mapa &rarr;</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
