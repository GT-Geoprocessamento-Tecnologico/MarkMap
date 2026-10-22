/**
 * UI-safe guidance for regional installer failures. Never discard checkpoints,
 * installed packages or user projects automatically to recover storage.
 */
export function isRegionalQuotaError(error) {
  if (!error || typeof error !== 'object') return false;
  const name = typeof error.name === 'string' ? error.name : '';
  const message = typeof error.message === 'string' ? error.message : '';
  return name === 'QuotaExceededError' ||
    /\b(?:quota|storage quota|insufficient storage|no space left|armazenamento insuficiente)\b/i.test(message);
}

export function describeRegionInstallError(code) {
  switch (code) {
    case 'aborted':
      return { kind: 'cancel', title: 'Download interrompido',
        message: 'Os blocos completos já salvos foram mantidos. Use a mesma URL para retomar.', retryable: true };
    case 'insufficient-space':
      return { kind: 'quota', title: 'Armazenamento insuficiente',
        message: 'Falta espaço temporário neste dispositivo. Revise o uso em Armazenamento local, libere espaço com segurança e tente retomar. Seus projetos e o mapa ativo não foram apagados.', retryable: true };
    case 'app-budget-exceeded':
    case 'package-too-large':
      return { kind: 'quota', title: 'Limite de mapas offline',
        message: 'O pacote não cabe no orçamento local de mapas. Revise os mapas instalados antes de tentar novamente; nenhum mapa foi excluído automaticamente.', retryable: false };
    case 'network-error':
    case 'invalid-response':
    case 'invalid-content-range':
      return { kind: 'network', title: 'Conexão interrompida',
        message: 'Verifique a conexão e tente novamente com a mesma URL. Os blocos completos podem ser reutilizados.', retryable: true };
    case 'stale-active-generation':
      return { kind: 'version', title: 'Mapa alterado em outra aba',
        message: 'Outra aba alterou o mapa ativo. Consulte a nova versão antes de confirmar; o mapa atual não foi sobrescrito.', retryable: false };
    case 'outdated-checkpoint':
      return { kind: 'version', title: 'Pacote alterado na origem',
        message: 'O download salvo pertence a outra versão. Confirme a fonte antes de iniciar uma nova versão; o mapa instalado permanece preservado.', retryable: false };
    case 'install-busy-other-tab':
    case 'install-busy':
      return { kind: 'busy', title: 'Instalação em andamento',
        message: 'Esta região está sendo processada em outra aba ou operação. Conclua ou cancele a operação antes de tentar novamente.', retryable: true };
    case 'checksum-mismatch':
    case 'invalid-pmtiles-header':
    case 'pmtiles-length-mismatch':
      return { kind: 'integrity', title: 'Integridade não confirmada',
        message: 'O conteúdo recebido não corresponde ao manifest. Verifique a fonte antes de tentar novamente; o pacote não foi ativado.', retryable: false };
    case 'storage-unavailable':
      return { kind: 'storage', title: 'Armazenamento indisponível',
        message: 'Não foi possível acessar os checkpoints locais. Verifique o armazenamento do navegador e tente novamente, sem limpar seus projetos.', retryable: true };
    default:
      return { kind: 'error', title: 'Instalação não concluída',
        message: 'Confira a URL e os arquivos do pacote regional. O mapa ativo não deve ser substituído sem validação.', retryable: false };
  }
}
