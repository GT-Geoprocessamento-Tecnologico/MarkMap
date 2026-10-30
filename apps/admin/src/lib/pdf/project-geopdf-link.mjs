const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertGeoPdfProjectIds(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 64 || value.some(id => typeof id !== 'string' || !UUID.test(id)) ||
      new Set(value).size !== value.length) throw new Error('Referências do GeoPDF inválidas.');
  return value;
}
export function assignedProjectGeoPdf(records, projectId) {
  if (typeof projectId !== 'string' || !UUID.test(projectId)) throw new Error('Projeto inválido.');
  return records.find(row => row.mediaType === 'application/pdf' && assertGeoPdfProjectIds(row.projectGeoPdfIds).includes(projectId)) ?? null;
}
export function reassignProjectGeoPdf(records, projectId, blobId) {
  if (typeof projectId !== 'string' || !UUID.test(projectId)) throw new Error('Projeto inválido.');
  if (blobId !== null && (typeof blobId !== 'string' || !records.some(row => row.blobId === blobId && row.mediaType === 'application/pdf')))
    throw new Error('GeoPDF local não encontrado.');
  return records.map(row => {
    if (row.mediaType !== 'application/pdf') return row;
    const old = assertGeoPdfProjectIds(row.projectGeoPdfIds);
    const ids = old.filter(id => id !== projectId);
    if (blobId === row.blobId) ids.push(projectId);
    if (ids.length > 64) throw new Error('Limite de projetos vinculados ao GeoPDF excedido.');
    if (ids.length === old.length && ids.every((id, i) => id === old[i])) return row;
    return { ...row, projectGeoPdfIds: ids };
  });
}
