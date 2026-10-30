/** The map editor must never select imported dataset vertices as project points. */
export function projectPointTitle(feature) {
  const name = feature?.properties?.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  const label = feature?.properties?.label;
  if (typeof label === 'string' && label.trim()) return label.trim();
  return 'Ponto sem nome';
}

export function filterProjectPoints(features, query = '') {
  const text = query.trim().toLocaleLowerCase('pt-BR');
  return features.filter((feature) => {
    if (!feature || typeof feature.id !== 'string' ||
        typeof feature.layerId !== 'string' || feature.geometry?.type !== 'Point') return false;
    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2 ||
        !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return false;
    if (!text) return true;
    const description = feature.properties?.description;
    return [projectPointTitle(feature), typeof description === 'string' ? description : '']
      .some((item) => item.toLocaleLowerCase('pt-BR').includes(text));
  });
}

/** Preserve unknown valid GIS attributes rather than replacing point properties. */
export function updatedPointProperties(previous, rawName, rawDescription) {
  const name = rawName.trim();
  const description = rawDescription.trim();
  if (!name || name.length > 120) throw new Error('Informe um nome com até 120 caracteres.');
  if (description.length > 1200) throw new Error('A descrição deve ter até 1.200 caracteres.');
  const next = { ...previous, name };
  if (description) next.description = description;
  else delete next.description;
  return next;
}