/**
 * Contrato de inicialização limpa. Nunca materializar fixtures demonstrativas
 * em entidades reais do IndexedDB (inclusive quando VITE_API_MODE=mock).
 * Os dados locais existentes, outbox e originais jamais são apagados.
 *
 * Nome conservado para compatibilidade com hooks legados.
 */
export function ensureDemoWorkspace(): Promise<void> {
  return Promise.resolve();
}
