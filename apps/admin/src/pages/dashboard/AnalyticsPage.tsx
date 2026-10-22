import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { layerSchema } from "@markmap/contracts";
import { useProjects } from "../../lib/hooks/projects";
import { localRepository } from "../../lib/local-repositories";

const csvCell = (value: string) =>
  `"${(/^[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
export default function AnalyticsPage() {
  const projects = useProjects({ limit: 100 });
  const ids = useMemo(
    () => (projects.data?.items ?? []).map((project) => project.id),
    [projects.data],
  );
  const layers = useQuery({
    queryKey: ["analytics-layers", ids, "bounded", 100],
    queryFn: async () => {
      // Apenas registros reais do IndexedDB do workspace, nunca dados mock.
      const owned = new Set(ids);
      const entities = await localRepository.listEntities("layer");
      const allRows = entities.flatMap((entity) => {
        if (entity.payload?.entity !== "layer") return [];
        const layer = layerSchema.parse(entity.payload.data);
        return owned.has(layer.projectId) ? [layer] : [];
      });
      return { rows: allRows.slice(0, 10_000), truncated: allRows.length > 10_000 };
    },
    enabled: projects.isSuccess && ids.length > 0,
  });
  const rows = layers.data?.rows ?? [];
  const loading = projects.isLoading || (ids.length > 0 && layers.isLoading);
  const error = projects.isError || (ids.length > 0 && layers.isError);
  const exportCsv = () => {
    const data = [
      ["Camada", "Tipo", "Criada em"],
      ...rows.map((row) => [
        row.name,
        row.geometryType ?? row.kind,
        row.createdAt,
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF", data.map((row) => row.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "geonexo-camadas.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <section className="min-w-0 space-y-6 bg-background p-4 text-on-surface md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Análises e Métricas</h1>
          <p className="text-sm text-on-surface-variant">
            Resumo dos projetos e camadas consultados.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/"
            className="rounded-lg border border-outline-variant px-4 py-2"
          >
            Voltar
          </Link>
          <button
            disabled={loading || error || rows.length === 0}
            onClick={exportCsv}
            className="rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan px-4 py-2 font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            Exportar CSV
          </button>
        </div>
      </header>
      {(projects.data?.nextCursor || layers.data?.truncated) && (
        <p
          role="status"
          className="rounded-xl border border-outline-variant p-3 text-sm"
        >
          Resumo parcial: até 100 projetos e 10.000 camadas locais.
          As métricas e o CSV consideram somente os dados consultados.
        </p>
      )}
      {error ? (
        <p role="alert">
          Não foi possível carregar os dados.{" "}
          <button
            onClick={() => {
              void projects.refetch();
              void layers.refetch();
            }}
          >
            Tentar novamente
          </button>
        </p>
      ) : loading ? (
        <p role="status">Carregando dados…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Projetos consultados", ids.length],
              ["Camadas consultadas", rows.length],
              [
                "Tipos de geometria",
                new Set(rows.map((row) => row.geometryType ?? row.kind)).size,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-outline-variant bg-surface-container p-5"
              >
                <p className="text-sm text-on-surface-variant">{label}</p>
                <p className="mt-2 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div
            role="region"
            aria-label="Camadas consultadas"
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-outline-variant"
          >
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr>
                  <th className="p-4">Camada</th>
                  <th className="p-4">Geometria</th>
                  <th className="p-4">Criação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-outline-variant">
                    <td className="p-4">{row.name}</td>
                    <td className="p-4">{row.geometryType ?? row.kind}</td>
                    <td className="p-4">
                      {new Date(row.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="p-4 text-on-surface-variant">
                Nenhuma camada cadastrada nos projetos consultados.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
