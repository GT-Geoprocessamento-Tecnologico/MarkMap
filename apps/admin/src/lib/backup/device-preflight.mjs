/**
 * Conservative status of storage that a T3a workspace backup never includes.
 * This inspects coverage metadata only; no records, secrets, or bytes leave the device.
 */
const SECTIONS = Object.freeze([
  { id: 'local-engine', label: 'Datasets e camadas locais' },
  { id: 'meshes', label: 'Malhas 3D' },
  { id: 'large-blobs', label: 'Arquivos grandes e metadados' },
  { id: 'offline-maps', label: 'Mapas offline e seus recursos' },
]);

export function summarizeDeviceBackupCoverage(settled) {
  if (!Array.isArray(settled) || settled.length !== SECTIONS.length) {
    throw new Error('Inspecao de backup incompleta: quatro bancos precisam ser consultados.');
  }

  const sections = SECTIONS.map(({ id, label }, i) => {
    const outcome = settled[i];
    const coverage = outcome?.status === 'fulfilled' ? outcome.value?.coverage : null;
    // A pending section is known to contain local records, none of which T3a exports.
    if (coverage?.status === 'pending' && coverage.recordCount === null &&
        typeof coverage.reason === 'string' && coverage.reason.trim()) {
      return { id, label, status: 'not-included', message: 'Dados encontrados, fora desta cópia parcial.' };
    }
    if (coverage?.status === 'absent' && coverage.recordCount === 0) {
      return { id, label, status: 'empty', message: 'Nenhum registro detectado nesta verificação.' };
    }
    // A rejected read, unknown version, or unexpected schema must never mean "empty".
    return { id, label, status: 'unknown', message: 'Verificação inconclusiva; podem existir dados não copiados.' };
  });

  return {
    kind: 'markmap-backup-device-preflight-v1',
    // T3a is ALWAYS partial, including when all four other databases appear empty.
    fullBackup: false,
    sections,
    missingSections: sections.filter((section) => section.status === 'not-included').length,
    uncertainSections: sections.filter((section) => section.status === 'unknown').length,
  };
}
