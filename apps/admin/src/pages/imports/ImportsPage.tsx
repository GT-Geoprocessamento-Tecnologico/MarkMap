import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@geonexo/ui";
import {
  exportDataset,
  listDatasets,
  parseGeoJSON,
  removeDataset,
  saveDataset,
  type DatasetRecord,
} from "../../lib/datasets/dataset-store";
import {
  listMeshes,
  removeMesh,
  saveMesh,
  type MeshRecord,
} from "../../lib/mesh/mesh-store";
import { PdfPreview, sha256Blob } from "../../lib/pdf/pdf-preview";
import { localRepository, type OriginalRecord } from "../../lib/local-repositories";

const formatSize = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

export default function ImportsPage() {
  const { toast } = useToast();
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [meshes, setMeshes] = useState<MeshRecord[]>([]);
  const [pdfs, setPdfs] = useState<OriginalRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDatasets(await listDatasets());
    setMeshes(await listMeshes());
    setPdfs((await localRepository.listOriginals()).filter((record) => record.mediaType === "application/pdf"));
  }, []);
  useEffect(() => {
    void refresh().catch((cause) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os datasets.",
      ),
    );
  }, [refresh]);
  const filteredDatasets = useMemo(
    () =>
      datasets.filter((dataset) =>
        dataset.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [datasets, searchTerm],
  );

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
        const sha256 = await sha256Blob(file);
        await localRepository.saveOriginal({ blobId: sha256, blob: file, mediaType: "application/pdf", bytes: file.size, sha256, originalName: file.name });
      } else if (/\.glb$/i.test(file.name)) {
        await saveMesh({ file });
      } else {
        await saveDataset(await parseGeoJSON(file));
      }
      await refresh();
      toast({
        title: "Importação concluída",
        description: `${file.name} foi salvo neste dispositivo.`,
        variant: "success",
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Não foi possível importar o arquivo.";
      setError(message);
      toast({
        title: "Importação não concluída",
        description: message,
        variant: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };
  const handleDelete = async (dataset: DatasetRecord) => {
    try {
      await removeDataset(dataset.id);
      await refresh();
      toast({
        title: "Dataset removido",
        description: `${dataset.name} foi removido deste dispositivo.`,
      });
    } catch (cause) {
      toast({
        title: "Remoção não concluída",
        description:
          cause instanceof Error ? cause.message : "Falha ao remover.",
        variant: "error",
      });
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto bg-background p-4 text-on-surface md:p-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-cyan-500"
          >
            dataset
          </span>
          Conjuntos de dados
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Importe GeoJSON validado e disponível offline neste dispositivo.
        </p>
      </header>
      <div className="relative mb-6 flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container p-6 text-center">
        <input
          type="file"
          accept=".geojson,.json,.pdf,.glb,application/pdf"
          onChange={handleUpload}
          disabled={isUploading}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          aria-label="Selecionar GeoJSON, PDF ou GLB"
        />
        <span className="material-symbols-outlined mb-3 text-4xl text-cyan-500">
          cloud_upload
        </span>
        <h2 className="font-bold">
          {isUploading ? "Validando arquivo…" : "Selecione GeoJSON, PDF ou GLB"}
        </h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          GeoJSON e PDF até 25 MiB. PDFs são visualizados localmente; o
          posicionamento geográfico só é informado quando os metadados passam
          pelas validações. GLB é validado e salvo localmente.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      <input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Buscar dataset por nome…"
        className="mb-4 w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm"
      />
      <div className="grid min-w-0 gap-3 xl:hidden" aria-label="Datasets locais">
        {filteredDatasets.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-center text-sm text-on-surface-variant">
            Nenhum dataset local.
          </div>
        ) : (
          filteredDatasets.map((dataset) => (
            <article
              key={dataset.id}
              className="min-w-0 rounded-2xl border border-outline-variant bg-surface-container p-4"
            >
              <h2 className="break-all font-semibold text-on-surface">
                {dataset.name}
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-on-surface-variant">Tamanho</dt>
                  <dd>{formatSize(dataset.sizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-on-surface-variant">Feições</dt>
                  <dd>{dataset.featuresCount}</dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-on-surface-variant">Importado</dt>
                  <dd className="break-words text-xs">
                    {new Date(dataset.uploadedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/workspace?datasetId=${encodeURIComponent(dataset.id)}`}
                  className="flex min-h-[44px] items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-400"
                  aria-label={`Visualizar ${dataset.name} no mapa`}
                >
                  Ver no mapa
                </a>
                <button
                  type="button"
                  onClick={() => void exportDataset(dataset.id)}
                  className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface-variant"
                  aria-label={`Exportar ${dataset.name}`}
                >
                  Exportar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(dataset)}
                  className="min-h-[44px] rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-400"
                  aria-label={`Excluir ${dataset.name}`}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      <div className="hidden xl:block overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
            <tr>
              <th className="p-4">Arquivo</th>
              <th className="p-4">Tamanho</th>
              <th className="p-4">Feições</th>
              <th className="p-4">Importado</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50">
            {filteredDatasets.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-sm text-on-surface-variant"
                >
                  Nenhum dataset local.
                </td>
              </tr>
            ) : (
              filteredDatasets.map((dataset) => (
                <tr key={dataset.id}>
                  <td className="p-4 font-semibold">{dataset.name}</td>
                  <td className="p-4 text-xs">
                    {formatSize(dataset.sizeBytes)}
                  </td>
                  <td className="p-4 text-xs">{dataset.featuresCount}</td>
                  <td className="p-4 text-xs">
                    {new Date(dataset.uploadedAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/workspace?datasetId=${encodeURIComponent(dataset.id)}`}
                        className="rounded-lg p-2 text-cyan-600"
                        title="Visualizar no mapa"
                        aria-label="Visualizar no mapa"
                      >
                        <span className="material-symbols-outlined">
                          visibility
                        </span>
                      </a>
                      <button
                        onClick={() => void exportDataset(dataset.id)}
                        className="rounded-lg p-2 text-on-surface-variant"
                        title="Exportar GeoJSON"
                        aria-label="Exportar GeoJSON"
                      >
                        <span className="material-symbols-outlined">
                          download
                        </span>
                      </button>
                      <button
                        onClick={() => void handleDelete(dataset)}
                        className="rounded-lg p-2 text-red-600"
                        title="Excluir dataset"
                        aria-label="Excluir dataset"
                      >
                        <span className="material-symbols-outlined">
                          delete
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <section className="mt-6 rounded-2xl border border-outline-variant bg-surface-container p-4">
        <h2 className="font-bold">Malhas 3D locais</h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          GLB validado pelo armazenamento local. Abra uma malha no estúdio para
          visualizar.
        </p>
        <div className="mt-3 space-y-2">
          {meshes.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Nenhuma malha local.
            </p>
          ) : (
            meshes.map((mesh) => (
              <div
                key={mesh.id}
                className="flex items-center justify-between rounded-xl border border-outline-variant p-3"
              >
                <span className="text-sm font-semibold">{mesh.name}</span>
                <span className="flex gap-2">
                  <a
                    href={`/mesh?meshId=${encodeURIComponent(mesh.id)}`}
                    className="rounded-lg p-2 text-cyan-600"
                    title="Visualizar malha"
                    aria-label="Visualizar malha"
                  >
                    <span className="material-symbols-outlined">
                      view_in_ar
                    </span>
                  </a>
                  <button
                    onClick={() =>
                      void removeMesh(mesh.id)
                        .then(refresh)
                        .catch((cause) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Não foi possível remover a malha.",
                          ),
                        )
                    }
                    className="rounded-lg p-2 text-red-600"
                    title="Excluir malha"
                    aria-label="Excluir malha"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      {pdfs.map((pdf) => <PdfPreview key={pdf.blobId} record={pdf} />)}
    </div>
  );
}
