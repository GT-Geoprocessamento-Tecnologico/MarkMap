import React, { useState } from 'react';
import { useToast } from '@geonexo/ui';

interface Dataset {
  id: string;
  name: string;
  format: 'GeoJSON' | 'Shapefile' | 'KML' | 'GeoTIFF' | 'GeoPackage';
  size: string;
  featuresCount: number;
  uploadedAt: string;
  status: 'Processado' | 'Em Processamento' | 'Erro';
  crs: string;
}

const INITIAL_DATASETS: Dataset[] = [
  {
    id: 'ds-1',
    name: 'propriedades_rurais_sp.geojson',
    format: 'GeoJSON',
    size: '14.2 MB',
    featuresCount: 1420,
    uploadedAt: '2026-09-29 14:30',
    status: 'Processado',
    crs: 'EPSG:4326',
  },
  {
    id: 'ds-2',
    name: 'bacia_hidrografica_parana.shp',
    format: 'Shapefile',
    size: '48.6 MB',
    featuresCount: 380,
    uploadedAt: '2026-09-28 11:15',
    status: 'Processado',
    crs: 'EPSG:31982',
  },
  {
    id: 'ds-3',
    name: 'modelo_elevacao_terreno.tif',
    format: 'GeoTIFF',
    size: '124.0 MB',
    featuresCount: 1,
    uploadedAt: '2026-09-27 16:45',
    status: 'Processado',
    crs: 'EPSG:4326',
  },
  {
    id: 'ds-4',
    name: 'duto_gasoduto_trecho3.kml',
    format: 'KML',
    size: '3.1 MB',
    featuresCount: 45,
    uploadedAt: '2026-09-26 09:20',
    status: 'Processado',
    crs: 'EPSG:4326',
  },
];

export default function ImportsPage() {
  const { toast } = useToast();
  const [datasets, setDatasets] = useState<Dataset[]>(INITIAL_DATASETS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string>('todos');
  const [isUploading, setIsUploading] = useState(false);

  const filteredDatasets = datasets.filter((ds) => {
    const matchesSearch = ds.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFormat = selectedFormat === 'todos' || ds.format === selectedFormat;
    return matchesSearch && matchesFormat;
  });

  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const file = files[0];

    setTimeout(() => {
      const ext = file.name.split('.').pop()?.toUpperCase() || 'GeoJSON';
      const newDs: Dataset = {
        id: `ds-${Date.now()}`,
        name: file.name,
        format: (ext === 'TIF' || ext === 'TIFF' ? 'GeoTIFF' : ext === 'SHP' ? 'Shapefile' : 'GeoJSON') as any,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        featuresCount: Math.floor(Math.random() * 500) + 10,
        uploadedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'Processado',
        crs: 'EPSG:4326',
      };

      setDatasets((prev) => [newDs, ...prev]);
      setIsUploading(false);
      toast({
        title: 'Upload concluído com sucesso!',
        description: `O arquivo ${file.name} foi validado e importado.`,
        variant: 'success',
      });
    }, 1200);
  };

  const handleDeleteDataset = (id: string, name: string) => {
    setDatasets((prev) => prev.filter((d) => d.id !== id));
    toast({
      title: 'Conjunto de dados removido',
      description: `${name} foi removido com sucesso.`,
      variant: 'default',
    });
  };

  return (
    <div className="flex flex-col h-full bg-background text-on-surface p-4 md:p-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-cyan-500">dataset</span>
            Conjuntos de Dados (Datasets)
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Gerencie, valide e importe arquivos espaciais GeoJSON, Shapefile, KML e GeoTIFF.
          </p>
        </div>
      </div>

      {/* Upload Box */}
      <div className="mb-6 p-6 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container hover:border-cyan-400/50 transition-all flex flex-col items-center justify-center text-center group relative overflow-hidden">
        <input
          type="file"
          accept=".geojson,.json,.kml,.zip,.shp,.tif,.tiff"
          onChange={handleSimulateUpload}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer z-10"
        />
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <span className="material-symbols-outlined text-3xl">cloud_upload</span>
        </div>
        <h2 className="text-base font-bold text-on-surface">
          {isUploading ? 'Processando e Validando Arquivo...' : 'Arraste e solte seu arquivo espacial aqui'}
        </h2>
        <p className="text-xs text-on-surface-variant mt-1 max-w-md">
          Suporta GeoJSON, Shapefile (.zip), KML, GeoTIFF e GeoPackage. Máximo de 250 MB por arquivo.
        </p>
        <button className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all">
          {isUploading ? 'Aguarde...' : 'Selecionar Arquivo do Dispositivo'}
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar conjunto de dados por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
          />
        </div>

        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:border-cyan-400 transition-all"
        >
          <option value="todos">Todos os Formatos</option>
          <option value="GeoJSON">GeoJSON</option>
          <option value="Shapefile">Shapefile</option>
          <option value="KML">KML</option>
          <option value="GeoTIFF">GeoTIFF</option>
        </select>
      </div>

      {/* Datasets List Table */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-high border-b border-outline-variant text-xs font-mono uppercase text-on-surface-variant">
              <tr>
                <th className="p-4">Nome do Arquivo</th>
                <th className="p-4">Formato</th>
                <th className="p-4">Tamanho</th>
                <th className="p-4">Feições</th>
                <th className="p-4">CRS</th>
                <th className="p-4">Data de Importação</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {filteredDatasets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-on-surface-variant text-xs font-mono">
                    Nenhum conjunto de dados encontrado.
                  </td>
                </tr>
              ) : (
                filteredDatasets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-surface-container-high/50 transition-colors">
                    <td className="p-4 font-semibold text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-cyan-500 text-base">description</span>
                      {ds.name}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {ds.format}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-on-surface-variant">{ds.size}</td>
                    <td className="p-4 font-mono text-xs text-on-surface-variant">{ds.featuresCount}</td>
                    <td className="p-4 font-mono text-xs text-on-surface-variant">{ds.crs}</td>
                    <td className="p-4 font-mono text-xs text-on-surface-variant">{ds.uploadedAt}</td>
                    <td className="p-4 text-xs font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {ds.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            toast({
                              title: 'Visualizando camada',
                              description: `Abrindo preview de ${ds.name}`,
                              variant: 'default',
                            })
                          }
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-cyan-400 hover:bg-surface-container-high transition-colors"
                          title="Visualizar no mapa"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDataset(ds.id, ds.name)}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-surface-container-high transition-colors"
                          title="Excluir dataset"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}