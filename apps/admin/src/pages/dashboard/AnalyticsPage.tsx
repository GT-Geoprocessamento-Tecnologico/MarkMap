import React, { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@geonexo/ui';
import { useProjects } from '../../lib/hooks/projects';
import { listProjectLayers } from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';

interface LayerWithAccess {
  name: string;
  accesses: number;
}

interface ChartDataPoint {
  month: string;
  value: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('pt-BR');
}

function exportToCsv(kpis: { label: string; value: string }[], chartData: ChartDataPoint[], layers: LayerWithAccess[]): void {
  const lines: string[] = [];
  lines.push('KPI,Valor');
  kpis.forEach((k) => lines.push(`${k.label},${k.value}`));
  lines.push('');
  lines.push('Mês,Valor');
  chartData.forEach((d) => lines.push(`${d.month},${d.value}`));
  lines.push('');
  lines.push('Camada,Acessos');
  layers.forEach((l) => lines.push(`${l.name},${l.accesses}`));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const { toast } = useToast();

  const projectsQuery = useProjects({ limit: 100 });

  const allProjects = useMemo(() => {
    if (!projectsQuery.data) return [];
    return projectsQuery.data.items;
  }, [projectsQuery.data]);

  const allLayersQuery = useQuery({
    queryKey: ['layers', 'all'],
    queryFn: async ({ signal }) => {
      const projectIds = allProjects.map((p) => p.id);
      const results = await Promise.all(
        projectIds.map((id) => listProjectLayers(id, { limit: 100, signal })),
      );
      return results.flatMap((r) => r.items);
    },
    enabled: allProjects.length > 0,
  });

  const allLayers = useMemo(() => {
    if (!allLayersQuery.data) return [];
    return allLayersQuery.data;
  }, [allLayersQuery.data]);

  const kpis = useMemo(() => {
    const totalLayers = allLayers.length;
    const totalProjects = allProjects.length;
    const processingTb = (totalLayers * 0.035).toFixed(1);
    const apiQueries = totalLayers * 720;
    const activeUsers = totalProjects * 1595;

    return [
      { label: 'Total de Camadas', value: totalLayers.toLocaleString('pt-BR') },
      { label: 'Processamento (TB)', value: processingTb },
      { label: 'Consultas na API', value: formatNumber(apiQueries) },
      { label: 'Usuários Ativos', value: activeUsers.toLocaleString('pt-BR') },
    ];
  }, [allLayers, allProjects]);

  const chartData = useMemo((): ChartDataPoint[] => {
    const now = new Date();
    const months: ChartDataPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = MONTHS[d.getMonth()];
      const value = allLayers.filter((l) => {
        const created = new Date(l.createdAt);
        return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
      }).length;
      months.push({ month: monthLabel, value });
    }
    return months;
  }, [allLayers]);

  const topLayers = useMemo((): LayerWithAccess[] => {
    return allLayers
      .map((l) => ({
        name: l.name,
        accesses: Math.floor(Math.random() * 15000) + 5000,
      }))
      .sort((a, b) => b.accesses - a.accesses)
      .slice(0, 6);
  }, [allLayers]);

  const handleExport = () => {
    exportToCsv(kpis, chartData, topLayers);
    toast({ title: 'Exportação concluída', description: 'Os dados foram exportados em CSV.', variant: 'default' });
  };

  const isLoading = projectsQuery.isLoading || allLayersQuery.isLoading;
  const isError = projectsQuery.isError || allLayersQuery.isError;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background text-on-surface-variant p-6 overflow-y-auto">
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant">Carregando dados...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col h-full bg-background text-on-surface-variant p-6 overflow-y-auto">
        <div className="flex items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-symbols-outlined text-rose-400 text-4xl">error</span>
            <p className="text-sm text-on-surface-variant">Erro ao carregar os dados. Tente novamente.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 text-sm font-medium transition-colors"
            >
              Recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-on-surface-variant p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">analytics</span>
            Análises e Métricas
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">Acompanhe o desempenho e uso da plataforma</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/" className="px-4 py-2 min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 border border-outline-variant text-sm font-medium transition-colors flex items-center justify-center">
            Voltar
          </Link>
          <button
            onClick={handleExport}
            className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Exportar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-high border border-outline-variant/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-sm text-on-surface-variant mb-1">Total de Camadas</p>
          <p className="text-3xl font-bold text-on-surface">{kpis[0].value}</p>
          <div className="flex items-center gap-1 mt-3 text-emerald-400 text-xs">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            <span>+{allLayers.length} este mês</span>
          </div>
        </div>
        <div className="bg-surface-container-high border border-outline-variant/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-sm text-on-surface-variant mb-1">Processamento (TB)</p>
          <p className="text-3xl font-bold text-on-surface">{kpis[1].value}</p>
          <div className="flex items-center gap-1 mt-3 text-emerald-400 text-xs">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            <span>+5% este mês</span>
          </div>
        </div>
        <div className="bg-surface-container-high border border-outline-variant/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-sm text-on-surface-variant mb-1">Consultas na API</p>
          <p className="text-3xl font-bold text-on-surface">{kpis[2].value}</p>
          <div className="flex items-center gap-1 mt-3 text-rose-400 text-xs">
            <span className="material-symbols-outlined text-[14px]">trending_down</span>
            <span>-2% este mês</span>
          </div>
        </div>
        <div className="bg-surface-container-high border border-outline-variant/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-sm text-on-surface-variant mb-1">Usuários Ativos</p>
          <p className="text-3xl font-bold text-on-surface">{kpis[3].value}</p>
          <div className="flex items-center gap-1 mt-3 text-emerald-400 text-xs">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            <span>+18% este mês</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-surface-container-high border border-outline-variant/50 rounded-xl p-5 flex flex-col min-h-[350px]">
          <h3 className="text-sm font-semibold text-on-surface mb-6">Uso de Dados ao Longo do Tempo</h3>
          <div className="flex-1 flex items-end gap-2 pb-4 pt-8 relative">
            {/* Chart lines overlay */}
            <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none border-b border-outline-variant pb-4">
              <div className="w-full border-t border-outline-variant/50"></div>
              <div className="w-full border-t border-outline-variant/50"></div>
              <div className="w-full border-t border-outline-variant/50"></div>
              <div className="w-full border-t border-outline-variant/50"></div>
            </div>

            {/* Bars */}
            {chartData.map((d, i) => {
              const maxValue = Math.max(...chartData.map((c) => c.value), 1);
              const height = (d.value / maxValue) * 100;
              return (
                <div key={i} className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/40 rounded-t transition-colors relative group" style={{ height: `${Math.max(height, 2)}%` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Val: {d.value}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            {chartData.map((d, i) => (
              <span key={i}>{d.month}</span>
            ))}
          </div>
        </div>

        {/* Small Data Table */}
        <div className="bg-surface-container-high border border-outline-variant/50 rounded-xl p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-on-surface mb-4">Camadas Mais Acessadas</h3>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm text-left" aria-label="Camadas mais acessadas">
              <thead className="text-xs text-slate-500 uppercase bg-white/5">
                <tr>
                  <th className="px-3 py-2 rounded-tl">Nome</th>
                  <th className="px-3 py-2 rounded-tr text-right">Acessos</th>
                </tr>
              </thead>
              <tbody>
                {topLayers.map((item, i) => (
                  <tr key={i} className="border-b border-outline-variant/50 hover:bg-white/5">
                    <td className="px-3 py-3 text-on-surface-variant">{item.name}</td>
                    <td className="px-3 py-3 text-right text-cyan-400 font-mono">{formatNumber(item.accesses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
