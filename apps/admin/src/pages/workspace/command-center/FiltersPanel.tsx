import React from "react";

interface FiltersPanelProps {
  filterText: string;
  filterType: string;
  activeGeoJson: GeoJSON.FeatureCollection;
  onSetFilterText: (text: string) => void;
  onSetFilterType: (type: string) => void;
  onClearFilters: () => void;
  labelClass: string;
  subtitleClass: string;
}

export function FiltersPanel({
  filterText,
  filterType,
  activeGeoJson,
  onSetFilterText,
  onSetFilterType,
  onClearFilters,
  labelClass,
  subtitleClass,
}: FiltersPanelProps) {
  return (
    <div className="p-5 space-y-4">
      <p className={`${subtitleClass} uppercase tracking-wider`}>
        Filtrar feições no mapa
      </p>
      <div>
        <label className={`${labelClass} block mb-1.5`}>Busca por nome</label>
        <input
          aria-label="Buscar nas propriedades das feições"
          type="text"
          value={filterText}
          onChange={(e) => onSetFilterText(e.target.value)}
          placeholder="Ex: Fazenda, Sítio..."
          className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm placeholder:text-on-surface-variant focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
        />
      </div>
      <div>
        <label className={`${labelClass} block mb-1.5`}>Tipo de feição</label>
        <select
          aria-label="Tipo de feição"
          value={filterType}
          onChange={(e) => onSetFilterType(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-surface-container text-on-surface text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 transition-all"
        >
          <option value="todos">Todos os tipos</option>
          <option value="Point">Pontos</option>
          <option value="LineString">Linhas</option>
          <option value="Polygon">Polígonos</option>
          <option value="Multi">Multi-geometrias</option>
        </select>
      </div>
      <div className="h-px bg-surface-variant" />
      {filterText && (
        <div className="space-y-2">
          <p className={subtitleClass}>Resultados para "{filterText}":</p>
          {activeGeoJson.features.slice(0, 100).map((feature, index) => (
            <div
              key={String(feature.id ?? index)}
              className="px-3 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant"
            >
              <p className="text-on-surface font-semibold text-sm">
                {String(
                  feature.properties?.name ??
                    feature.id ??
                    `Feição ${index + 1}`,
                )}
              </p>
              <p className="text-on-surface-variant text-xs">
                {JSON.stringify(feature.properties)}
              </p>
            </div>
          ))}
          {activeGeoJson.features.length === 0 && (
            <p className="text-on-surface-variant text-sm text-center py-4">
              Nenhuma feição encontrada.
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onClearFilters}
        className="w-full py-2.5 rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant text-sm font-medium hover:bg-surface-variant transition-colors"
      >
        Limpar filtros
      </button>
    </div>
  );
}
