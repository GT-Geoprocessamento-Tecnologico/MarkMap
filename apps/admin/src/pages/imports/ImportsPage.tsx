import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@markmap/ui";
import {
  exportDataset,
  exportDatasetGeoJSON,
  listDatasets,
  parseDatasetFile,
  removeDataset,
  renameDataset,
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
import { isGeoTiffSignature, readGeoTiffMetadata } from "@markmap/maps";
import { readBlobBytes } from "../../lib/blob-bytes";
import { localRepository, type OriginalRecord } from "../../lib/local-repositories";
import { subscribeImportCatalogChanges } from "../../lib/storage/import-catalog-events.mjs";
import { AppIcon } from "../../components/AppIcon";
import { TrackElevationProfile } from "../../components/elevation/TrackElevationProfile";

const formatSize = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

export default function ImportsPage() {
  const { toast } = useToast();
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [meshes, setMeshes] = useState<MeshRecord[]>([]);
  const [pdfs, setPdfs] = useState<OriginalRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [profileDatasetId, setProfileDatasetId] = useState<string | null>(null);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [editingDatasetName, setEditingDatasetName] = useState("");
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [busyDatasetId, setBusyDatasetId] = useState<string | null>(null);
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null);
  const [editingOriginalName, setEditingOriginalName] = useState("");
  const [deleteConfirmationOriginalId, setDeleteConfirmationOriginalId] = useState<string | null>(null);
  const [busyOriginalId, setBusyOriginalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDatasets(await listDatasets());
    setMeshes(await listMeshes());
    setPdfs((await localRepository.listOriginals()).filter((record) => record.mediaType === "application/pdf" || record.mediaType === "image/tiff"));
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
  useEffect(() => subscribeImportCatalogChanges(() => {
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao atualizar arquivos locais."));
  }), [refresh]);
  const profileDataset = datasets.find((dataset) => dataset.id === profileDatasetId);
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
      } else if (/\.(tif|tiff)$/i.test(file.name) || file.type === "image/tiff") {
        const bytes = await readBlobBytes(file);
        if (!isGeoTiffSignature(bytes)) throw new Error("O arquivo não possui assinatura GeoTIFF válida.");
        await readGeoTiffMetadata(bytes);
        const sha256 = await sha256Blob(file);
        await localRepository.saveOriginal({ blobId: sha256, blob: file, mediaType: "image/tiff", bytes: file.size, sha256, originalName: file.name });
      } else if (/\.glb$/i.test(file.name)) {
        await saveMesh({ file });
      } else {
        await saveDataset(await parseDatasetFile(file));
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
  const handleRename = async (dataset: DatasetRecord) => {
    if (busyDatasetId) return;
    setBusyDatasetId(dataset.id);
    try {
      await renameDataset(dataset.id, editingDatasetName, dataset.name);
      await refresh();
      setEditingDatasetId(null);
      toast({ title: "Dataset renomeado", description: "Dados e arquivo original preservados." });
    } catch (cause) {
      toast({
        title: "Renomeação não concluída",
        description: cause instanceof Error ? cause.message : "Verifique o nome do arquivo.",
        variant: "error",
      });
    } finally {
      setBusyDatasetId(null);
    }
  };
  const handleDelete = async (dataset: DatasetRecord) => {
    if (busyDatasetId || deleteConfirmationId !== dataset.id) return;
    setBusyDatasetId(dataset.id);
    try {
      await removeDataset(dataset.id);
      await refresh();
      setDeleteConfirmationId(null);
      toast({
        title: "Dataset excluído",
        description: `${dataset.name}, seus dados e sua cópia local foram excluídos do MarkMap.`,
      });
    } catch (cause) {
      toast({
        title: "Remoção não concluída",
        description:
          cause instanceof Error ? cause.message : "Falha ao remover.",
        variant: "error",
      });
    } finally {
      setBusyDatasetId(null);
    }
  };
  const handleRenameOriginal = async (record: OriginalRecord) => {
    if (busyOriginalId) return;
    setBusyOriginalId(record.blobId);
    try {
      await localRepository.renameImportedOriginal(record.blobId, editingOriginalName, record.originalName ?? "", record.createdAt);
      await refresh();
      setEditingOriginalId(null);
      toast({ title: "Arquivo renomeado", description: "Original, georreferência e vínculos preservados.", variant: "success" });
    } catch (cause) {
      toast({ title: "Renomeação não concluída", description: cause instanceof Error ? cause.message : "Nome inválido.", variant: "error" });
    } finally {
      setBusyOriginalId(null);
    }
  };

  const handleDeleteOriginal = async (record: OriginalRecord) => {
    if (busyOriginalId || deleteConfirmationOriginalId !== record.blobId) return;
    setBusyOriginalId(record.blobId);
    try {
      await localRepository.deleteImportedOriginal(record.blobId, {
        sha256: record.sha256,
        originalName: record.originalName,
        projectGeoPdfIds: record.projectGeoPdfIds,
        createdAt: record.createdAt,
      });
      await refresh();
      setDeleteConfirmationOriginalId(null);
      toast({ title: "Arquivo excluído do MarkMap", description: "Cópia offline e referências removidas deste dispositivo.", variant: "success" });
    } catch (cause) {
      toast({ title: "Exclusão não concluída", description: cause instanceof Error ? cause.message : "Falha no armazenamento.", variant: "error" });
    } finally {
      setBusyOriginalId(null);
    }
  };

  const originalActions = (record: OriginalRecord) => (
    <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label={`Ações do arquivo ${record.originalName ?? record.blobId}`}>
      {editingOriginalId === record.blobId ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium">Novo nome do arquivo
            <input type="text" maxLength={120} value={editingOriginalName}
              onChange={(event) => setEditingOriginalName(event.target.value)}
              className="mt-1 block min-h-[44px] min-w-0 rounded-lg border border-outline-variant bg-background px-3" />
          </label>
          <button type="button" disabled={Boolean(busyOriginalId)} onClick={() => void handleRenameOriginal(record)}
            className="min-h-[44px] rounded-lg bg-secondary px-3 text-sm font-semibold text-on-secondary">Salvar nome</button>
          <button type="button" disabled={Boolean(busyOriginalId)} onClick={() => setEditingOriginalId(null)}
            className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-sm">Cancelar</button>
        </div>
      ) : <button type="button" disabled={Boolean(busyOriginalId)}
          onClick={() => { setEditingOriginalId(record.blobId); setEditingOriginalName(record.originalName ?? ""); setDeleteConfirmationOriginalId(null); }}
          className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-sm font-semibold"
          aria-label={`Renomear ${record.originalName ?? record.blobId}`}>Renomear</button>}
      {deleteConfirmationOriginalId === record.blobId ? (
        <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label="Confirmação de exclusão">
          <p className="w-full text-sm text-on-surface-variant">
            Excluir do dispositivo remove a cópia offline deste arquivo, sua georreferência e sua visualização no mapa.
            {record.projectGeoPdfIds?.length ? ` ${record.projectGeoPdfIds.length} projeto(s) perderão a associação ao GeoPDF.` : ""}
            {" "}Projetos, pontos, fotos, backups exportados e o arquivo fora do aplicativo permanecem intactos.
          </p>
          <button type="button" disabled={Boolean(busyOriginalId)} onClick={() => void handleDeleteOriginal(record)}
            className="min-h-[44px] rounded-lg border border-red-500 px-3 text-sm font-semibold text-red-600"
            aria-label={`Confirmar exclusão de ${record.originalName ?? record.blobId}`}>Confirmar exclusão do dispositivo</button>
          <button type="button" disabled={Boolean(busyOriginalId)} onClick={() => setDeleteConfirmationOriginalId(null)}
            className="min-h-[44px] rounded-lg border border-outline-variant px-3 text-sm">Cancelar</button>
        </div>
      ) : <button type="button" disabled={Boolean(busyOriginalId)}
          onClick={() => { setDeleteConfirmationOriginalId(record.blobId); setEditingOriginalId(null); }}
          className="min-h-[44px] rounded-lg border border-red-500/30 px-3 text-sm font-semibold text-red-600"
          aria-label={`Excluir ${record.originalName ?? record.blobId}`}>Excluir do dispositivo</button>}
    </div>
  );

  const handleExport = async (dataset: DatasetRecord, original = false) => {
    try {
      if (original) await exportDataset(dataset.id);
      else await exportDatasetGeoJSON(dataset.id);
    } catch (cause) {
      toast({
        title: "Exportação não concluída",
        description: cause instanceof Error ? cause.message : "Não foi possível exportar o arquivo.",
        variant: "error",
      });
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto bg-background p-4 text-on-surface md:p-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <AppIcon name="data" size="lg" />
          Conjuntos de dados
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Importe GeoJSON, GPX, KML e KMZ para trabalhar offline neste dispositivo.
        </p>
      </header>
      <div className="relative mb-6 flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container p-6 text-center">
        <input
          type="file"
          onChange={handleUpload}
          disabled={isUploading}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          aria-label="Selecionar GeoJSON, GPX, KML, KMZ, GeoTIFF, PDF ou GLB"
        />
        <AppIcon name="upload" size="lg" className="mb-3" />
        <h2 className="font-bold">
          {isUploading ? "Validando arquivo…" : "Selecione GeoJSON, GPX, KML, KMZ, GeoTIFF, PDF ou GLB"}
        </h2>
        <p className="mt-1 text-xs text-on-surface-variant">
          GeoJSON, GPX, KML, KMZ, GeoTIFF e PDF até 25 MiB. Trilhas e pontos são convertidos em GeoJSON local. PDFs são visualizados localmente; o
          posicionamento geográfico só é informado quando os metadados passam
          pelas validações. GLB é validado e salvo localmente.
        </p>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}
      <input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Buscar dataset por nome…"
        className="mb-4 w-full rounded-xl border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      />
      <div className="min-w-0 rounded-2xl border border-outline-variant bg-surface-container">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Datasets locais</caption>
          <thead className="border-b border-outline-variant text-xs uppercase text-on-surface-variant">
            <tr>
              <th scope="col" className="p-0 lg:p-4">
                <span className="sr-only lg:not-sr-only">Arquivo</span>
              </th>
              <th scope="col" className="p-0 lg:p-4">
                <span className="sr-only lg:not-sr-only">Tamanho</span>
              </th>
              <th scope="col" className="p-0 lg:p-4">
                <span className="sr-only lg:not-sr-only">Feições</span>
              </th>
              <th scope="col" className="p-0 lg:p-4">
                <span className="sr-only lg:not-sr-only">Importado</span>
              </th>
              <th scope="col" className="p-0 text-right lg:p-4">
                <span className="sr-only lg:not-sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDatasets.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="block p-8 text-center text-sm text-on-surface-variant lg:table-cell"
                >
                  Nenhum dataset local.
                </td>
              </tr>
            ) : (
              filteredDatasets.map((dataset) => (
                <tr
                  key={dataset.id}
                  className="block border-b border-outline-variant/50 last:border-b-0 lg:table-row"
                >
                  <th
                    scope="row"
                    className="block p-4 text-left align-top font-semibold text-on-surface break-words lg:table-cell lg:align-baseline"
                  >
                    {editingDatasetId === dataset.id ? (
                      <div className="flex min-w-0 flex-col gap-2">
                        <label className="block min-w-0 text-sm font-medium">
                          Novo nome do arquivo
                          <input type="text" value={editingDatasetName} maxLength={120}
                            onChange={(event) => setEditingDatasetName(event.target.value)}
                            className="mt-1 block w-full min-w-0 max-w-full rounded-lg border border-outline-variant bg-background p-2"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={Boolean(busyDatasetId)}
                            onClick={() => void handleRename(dataset)}
                            className="min-h-[44px] rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary">
                            Salvar nome
                          </button>
                          <button type="button" disabled={Boolean(busyDatasetId)}
                            onClick={() => setEditingDatasetId(null)}
                            className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-sm">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : <span className="block break-words [overflow-wrap:anywhere]">{dataset.name}</span>}
                  </th>
                  <td className="flex items-baseline justify-between gap-4 px-4 py-2 lg:table-cell lg:p-4">
                    <span className="text-xs font-medium uppercase text-on-surface-variant lg:hidden">
                      Tamanho
                    </span>
                    <span className="text-xs">
                      {formatSize(dataset.sizeBytes)}
                    </span>
                  </td>
                  <td className="flex items-baseline justify-between gap-4 px-4 py-2 lg:table-cell lg:p-4">
                    <span className="text-xs font-medium uppercase text-on-surface-variant lg:hidden">
                      Feições
                    </span>
                    <span className="text-xs">{dataset.featuresCount}</span>
                  </td>
                  <td className="flex items-baseline justify-between gap-4 px-4 py-2 lg:table-cell lg:p-4">
                    <span className="text-xs font-medium uppercase text-on-surface-variant lg:hidden">
                      Importado
                    </span>
                    <span className="whitespace-nowrap text-xs">
                      {new Date(dataset.uploadedAt).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 pb-4 lg:table-cell lg:p-4 lg:text-right">
                    <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:justify-end">
                      <a
                        href={`/workspace?datasetId=${encodeURIComponent(dataset.id)}`}
                        title="Visualizar no mapa"
                        aria-label="Visualizar no mapa"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15 lg:px-2"
                      >
                        <AppIcon name="view" size="md" />
                        <span className="lg:hidden">Visualizar no mapa</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleExport(dataset)}
                        title="Exportar GeoJSON"
                        aria-label="Exportar GeoJSON"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant lg:px-2"
                      >
                        <AppIcon name="download" size="md" />
                        <span className="lg:hidden">Exportar GeoJSON</span>
                      </button>
                      <button type="button" onClick={() => setProfileDatasetId((id) => id === dataset.id ? null : dataset.id)}
                        title="Perfil de elevação local" aria-label={`Perfil de elevação de ${dataset.name}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
                        Elevação
                      </button>
                      {dataset.format !== "GeoJSON" && (
                        <button type="button" onClick={() => void handleExport(dataset, true)}
                          title="Exportar arquivo original" aria-label="Exportar arquivo original"
                          className="inline-flex min-h-[44px] items-center rounded-lg border border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
                          Original
                        </button>
                      )}
                      <button type="button"
                        disabled={Boolean(busyDatasetId)}
                        onClick={() => { setEditingDatasetId(dataset.id); setEditingDatasetName(dataset.name); setDeleteConfirmationId(null); }}
                        aria-label={`Renomear ${dataset.name}`}
                        className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold">
                        Renomear
                      </button>
                      {deleteConfirmationId === dataset.id ? (
                        <>
                          <p className="w-full text-xs text-on-surface-variant">A cópia local, geometria e visualização serão removidas do MarkMap. O arquivo fora do aplicativo permanece intacto.</p>
                          <button type="button" disabled={Boolean(busyDatasetId)}
                            onClick={() => void handleDelete(dataset)}
                            aria-label={`Confirmar exclusão de ${dataset.name}`}
                            className="min-h-[44px] rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-500">
                            Confirmar exclusão
                          </button>
                          <button type="button" disabled={Boolean(busyDatasetId)}
                            onClick={() => setDeleteConfirmationId(null)}
                            className="min-h-[44px] rounded-lg border border-outline-variant px-3 py-2 text-xs">
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button type="button"
                          disabled={Boolean(busyDatasetId)}
                          onClick={() => { setDeleteConfirmationId(dataset.id); setEditingDatasetId(null); }}
                          title="Excluir dataset"
                          aria-label={`Excluir ${dataset.name}`}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-500">
                          <AppIcon name="delete" size="md" />
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {profileDataset && <TrackElevationProfile features={profileDataset.geojson.features} />}
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
                    <AppIcon name="mesh" size="md" />
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
                    <AppIcon name="delete" size="md" />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      {pdfs.map((pdf) => pdf.mediaType === "application/pdf" ?
        <PdfPreview key={pdf.blobId} record={pdf} actions={originalActions(pdf)} /> : (
        <div key={pdf.blobId} className="mt-3 rounded-xl border border-outline-variant p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{pdf.originalName ?? "GeoTIFF local"}</span>
            <a href={`/workspace?geotiffId=${encodeURIComponent(pdf.blobId)}`} className="min-h-[44px] rounded-lg border border-cyan-500/30 p-2 text-cyan-600" aria-label="Visualizar GeoTIFF">Visualizar</a>
          </div>
          <div className="mt-3">{originalActions(pdf)}</div>
        </div>
      ))}
    </div>
  );
}
