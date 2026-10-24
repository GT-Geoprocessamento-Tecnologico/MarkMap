/** Public-facing local map errors. Never echo a raw asset URL or filesystem path. */
export function describeOfflineMapFailure(input) {
  const event = input && typeof input === 'object' ? input : {};
  const error = event.error && typeof event.error === 'object' ? event.error : input;
  const name = typeof error?.name === 'string' ? error.name : '';
  const code = typeof error?.code === 'string' ? error.code : '';
  const detail = typeof error?.message === 'string' ? error.message.slice(0, 500).toLowerCase() : '';

  // Aborting a previous MapLibre instance is expected during map changes.
  if (name === 'AbortError' || code === 'aborted' || /\b(aborted|cancelled|canceled)\b/.test(detail)) return null;

  if (code === 'stale-active-generation' || /stale.*generation|generation.*changed/.test(detail)) {
    return { kind: 'updated', message: 'O mapa local foi atualizado. Tente carregar novamente a versão instalada.' };
  }
  if (['invalid-range', 'truncated-range', 'incomplete-read'].includes(code) ||
      /offline tile range|incomplete offline map asset read/.test(detail)) {
    return { kind: 'incomplete', message: 'Os dados do mapa regional estão incompletos. Tente novamente ou verifique o pacote em Configurações.' };
  }
  if (['missing-asset', 'invalid-asset', 'asset-too-large', 'invalid-url'].includes(code) ||
      /offline package asset (not found|is unavailable|exceeds|is too large)|invalid offline package asset url/.test(detail)) {
    return { kind: 'resource', message: 'Um recurso do mapa regional está indisponível ou inválido. Verifique a instalação em Configurações.' };
  }
  if (name === 'QuotaExceededError' || /quotaexceeded|out of memory/.test(detail)) {
    return { kind: 'resources', message: 'O dispositivo não conseguiu carregar o mapa. Confira o espaço e os recursos disponíveis.' };
  }
  if (/webgl|context lost|failed to create.*context/.test(detail)) {
    return { kind: 'rendering', message: 'O motor gráfico não conseguiu desenhar o mapa. Reabra a visualização ou tente novamente.' };
  }
  if (/network|failed to fetch|offline|fetch failed/.test(detail)) {
    return { kind: 'network', message: 'Não foi possível obter um recurso cartográfico. O trabalho de campo salvo permanece local.' };
  }
  return { kind: 'unknown', message: 'Não foi possível carregar a cartografia. Tente novamente ou use o fundo simples offline.' };
}
